import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, gte, lte, eq, count, sql, inArray, desc } from 'drizzle-orm';
import * as schema from '../database/schema';

// ── Param / Result types ────────────────────────────────────────────

export interface DateRangeParams {
  startDate?: string;
  endDate?: string;
}

export interface SalesSummaryResult {
  totalInvoices: number;
  totalRevenue: number;
  totalTax: number;
  totalPaymentsReceived: number;
  totalOutstanding: number;
  byPaymentMethod: Array<{ method: string; total: number; count: number }>;
}

export interface AgingBucket {
  label: string;
  total: number;
  count: number;
}

export interface AgingLineItem {
  invoiceId: number;
  invNumber: string;
  invDate: string;
  clientName: string | null;
  total: number;
  totalPaid: number;
  balance: number;
  daysOutstanding: number;
  bucket: string;
}

export interface ReceivablesAgingResult {
  buckets: AgingBucket[];
  invoices: AgingLineItem[];
  grandTotal: number;
}

export interface SalespersonRow {
  employeeId: number;
  name: string;
  invoiceCount: number;
  invoiceTotal: number;
  quoteCount: number;
  quoteTotal: number;
  creditNoteCount: number;
  creditNoteTotal: number;
  netSales: number;
}

export interface SalespersonPerformanceResult {
  rows: SalespersonRow[];
  totals: Omit<SalespersonRow, 'employeeId' | 'name'>;
}

export interface PaymentCollectionItem {
  paymentId: number;
  paymentDate: string | null;
  invoiceNumber: string | null;
  clientName: string | null;
  paymentMethod: string | null;
  amount: number;
  processedBy: string | null;
}

export interface PaymentMethodSummary {
  method: string;
  total: number;
  count: number;
}

export interface PaymentCollectionResult {
  payments: PaymentCollectionItem[];
  totalCollected: number;
  byMethod: PaymentMethodSummary[];
}

// ── Service ─────────────────────────────────────────────────────────

export class ReportService {
  private db: NodePgDatabase<typeof schema>;

  constructor(db: NodePgDatabase<typeof schema>) {
    this.db = db;
  }

  // ── 1. Sales Summary ───────────────────────────────────────────

  async getSalesSummary(params: DateRangeParams): Promise<SalesSummaryResult> {
    const { startDate, endDate } = params;

    // Invoice totals
    const invConditions = [];
    if (startDate) invConditions.push(gte(schema.invoices.invDate, startDate));
    if (endDate) invConditions.push(lte(schema.invoices.invDate, endDate));

    const invResult = await this.db
      .select({
        count: count(),
        totalRevenue: sql<string>`COALESCE(SUM(CAST(${schema.invoices.total} AS numeric)), 0)`,
        totalTax: sql<string>`COALESCE(SUM(CAST(${schema.invoices.tax} AS numeric)), 0)`,
        totalPaid: sql<string>`COALESCE(SUM(CAST(${schema.invoices.totalPaid} AS numeric)), 0)`,
      })
      .from(schema.invoices)
      .where(invConditions.length ? and(...invConditions) : undefined);

    // Payment method breakdown (only INVOICE payments)
    const payConditions = [eq(schema.payments.documentType, 'INVOICE')];
    if (startDate) payConditions.push(gte(schema.payments.paymentDate, startDate));
    if (endDate) payConditions.push(lte(schema.payments.paymentDate, endDate));

    const payBreakdown = await this.db
      .select({
        method: schema.payments.paymentDesc,
        total: sql<string>`COALESCE(SUM(CAST(${schema.payments.amount} AS numeric)), 0)`,
        count: count(),
      })
      .from(schema.payments)
      .where(and(...payConditions))
      .groupBy(schema.payments.paymentDesc);

    const totalRevenue = Number(invResult[0]?.totalRevenue ?? 0);
    const totalPaid = Number(invResult[0]?.totalPaid ?? 0);

    return {
      totalInvoices: Number(invResult[0]?.count ?? 0),
      totalRevenue,
      totalTax: Number(invResult[0]?.totalTax ?? 0),
      totalPaymentsReceived: totalPaid,
      totalOutstanding: totalRevenue - totalPaid,
      byPaymentMethod: payBreakdown.map((r) => ({
        method: r.method || 'Unknown',
        total: Number(r.total ?? 0),
        count: Number(r.count ?? 0),
      })),
    };
  }

  // ── 2. Accounts Receivable Aging ───────────────────────────────

  async getReceivablesAging(): Promise<ReceivablesAgingResult> {
    const unpaid = await this.db
      .select()
      .from(schema.invoices)
      .where(inArray(schema.invoices.status, ['active', 'partially_paid']));

    const today = new Date();
    const bucketMap: Record<string, AgingBucket> = {
      'Current (0-30)': { label: 'Current (0-30)', total: 0, count: 0 },
      '31-60 days': { label: '31-60 days', total: 0, count: 0 },
      '61-90 days': { label: '61-90 days', total: 0, count: 0 },
      '90+ days': { label: '90+ days', total: 0, count: 0 },
    };

    const invoices: AgingLineItem[] = unpaid.map((inv) => {
      const invDate = new Date(inv.invDate);
      const diffMs = today.getTime() - invDate.getTime();
      const daysOutstanding = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      const total = Number(inv.total ?? 0);
      const totalPaid = Number(inv.totalPaid ?? 0);
      const balance = total - totalPaid;

      let bucket: string;
      if (daysOutstanding <= 30) bucket = 'Current (0-30)';
      else if (daysOutstanding <= 60) bucket = '31-60 days';
      else if (daysOutstanding <= 90) bucket = '61-90 days';
      else bucket = '90+ days';

      bucketMap[bucket].total += balance;
      bucketMap[bucket].count += 1;

      return {
        invoiceId: inv.id,
        invNumber: inv.invNumber,
        invDate: inv.invDate,
        clientName: inv.clientName,
        total,
        totalPaid,
        balance,
        daysOutstanding,
        bucket,
      };
    });

    // Sort by days outstanding descending
    invoices.sort((a, b) => b.daysOutstanding - a.daysOutstanding);

    const grandTotal = invoices.reduce((sum, inv) => sum + inv.balance, 0);

    return {
      buckets: Object.values(bucketMap),
      invoices,
      grandTotal,
    };
  }

  // ── 3. Payment Collection ──────────────────────────────────────

  async getPaymentCollection(params: DateRangeParams): Promise<PaymentCollectionResult> {
    const { startDate, endDate } = params;

    const conditions = [eq(schema.payments.documentType, 'INVOICE')];
    if (startDate) conditions.push(gte(schema.payments.paymentDate, startDate));
    if (endDate) conditions.push(lte(schema.payments.paymentDate, endDate));

    // Get payments with joined invoice (for client name) and employee (for processor name)
    const results = await this.db
      .select({
        payment: schema.payments,
        clientName: schema.invoices.clientName,
        processorFirstName: schema.employees.firstName,
        processorLastName: schema.employees.lastName,
        processorCode: schema.employees.code,
      })
      .from(schema.payments)
      .leftJoin(schema.invoices, eq(schema.payments.invoiceNumber, schema.invoices.invNumber))
      .leftJoin(schema.employees, eq(schema.payments.processedById, schema.employees.id))
      .where(and(...conditions))
      .orderBy(desc(schema.payments.paymentDate));

    const payments: PaymentCollectionItem[] = results.map((r) => ({
      paymentId: r.payment.id,
      paymentDate: r.payment.paymentDate,
      invoiceNumber: r.payment.invoiceNumber,
      clientName: r.clientName ?? null,
      paymentMethod: r.payment.paymentDesc,
      amount: Number(r.payment.amount ?? 0),
      processedBy: r.processorFirstName
        ? [r.processorFirstName, r.processorLastName].filter(Boolean).join(' ')
        : r.processorCode ?? null,
    }));

    const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);

    // Group by method
    const methodMap = new Map<string, PaymentMethodSummary>();
    for (const p of payments) {
      const key = p.paymentMethod || 'Unknown';
      const existing = methodMap.get(key);
      if (existing) {
        existing.total += p.amount;
        existing.count += 1;
      } else {
        methodMap.set(key, { method: key, total: p.amount, count: 1 });
      }
    }

    return {
      payments,
      totalCollected,
      byMethod: Array.from(methodMap.values()),
    };
  }
}
