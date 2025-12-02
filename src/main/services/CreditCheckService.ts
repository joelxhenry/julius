import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, or, ne, lt } from 'drizzle-orm';
import * as schema from '../database/schema';

export interface CreditCheckResult {
  clientId: number;
  clientName: string;
  canCreateInvoice: boolean;
  requiresAdminOverride: boolean;
  reasons: CreditIssue[];
  creditLimit: number;
  currentBalance: number;
  overdueAmount: number;
  overdueInvoiceCount: number;
  isBadCredit: boolean;
}

export interface CreditIssue {
  type: 'overdue_invoices' | 'exceeded_credit_limit' | 'bad_credit_flag';
  message: string;
  severity: 'warning' | 'block';
}

export interface ArrearsInfo {
  clientId: number;
  clientName: string;
  totalOutstanding: number;
  overdueAmount: number;
  overdueInvoices: schema.Invoice[];
  daysOldest: number;
  creditLimit: number;
  isOverCreditLimit: boolean;
  isBadCredit: boolean;
}

export class CreditCheckService {
  private db: NodePgDatabase<typeof schema>;

  constructor(db: NodePgDatabase<typeof schema>) {
    this.db = db;
  }

  async checkClientCredit(clientId: number): Promise<CreditCheckResult> {
    // Get client data
    const client = await this.db
      .select()
      .from(schema.clients)
      .where(eq(schema.clients.id, clientId))
      .limit(1);

    if (!client[0]) {
      throw new Error('Client not found');
    }

    const clientData = client[0];
    const creditLimit = parseFloat(clientData.creditLimit || '0');
    const isBadCredit = clientData.isBadCredit ?? false;

    // Get unpaid invoices for this client
    const unpaidInvoices = await this.db
      .select()
      .from(schema.invoices)
      .where(
        and(
          eq(schema.invoices.clientId, clientId),
          or(
            eq(schema.invoices.status, 'active'),
            eq(schema.invoices.status, 'partially_paid')
          ),
          eq(schema.invoices.isArchived, false)
        )
      );

    // Calculate current balance (total unpaid amount)
    let currentBalance = 0;
    let overdueAmount = 0;
    let overdueInvoiceCount = 0;
    const today = new Date();
    const defaultCreditTermsDays = 30;

    for (const invoice of unpaidInvoices) {
      const total = parseFloat(invoice.total || '0');
      const totalPaid = parseFloat(invoice.totalPaid || '0');
      const outstanding = total - totalPaid;
      currentBalance += outstanding;

      // Check if invoice is overdue
      const invDate = new Date(invoice.invDate);
      const creditTerms = parseInt(invoice.creditTerms || clientData.creditTerms || String(defaultCreditTermsDays), 10);
      const dueDate = new Date(invDate);
      dueDate.setDate(dueDate.getDate() + creditTerms);

      if (today > dueDate) {
        overdueAmount += outstanding;
        overdueInvoiceCount++;
      }
    }

    const reasons: CreditIssue[] = [];
    let requiresAdminOverride = false;

    // Check for bad credit flag
    if (isBadCredit) {
      reasons.push({
        type: 'bad_credit_flag',
        message: 'This client has been flagged as having bad credit.',
        severity: 'block',
      });
      requiresAdminOverride = true;
    }

    // Check for overdue invoices
    if (overdueInvoiceCount > 0) {
      reasons.push({
        type: 'overdue_invoices',
        message: `Client has ${overdueInvoiceCount} overdue invoice(s) totaling $${overdueAmount.toFixed(2)}.`,
        severity: 'block',
      });
      requiresAdminOverride = true;
    }

    // Check if over credit limit
    if (creditLimit > 0 && currentBalance >= creditLimit) {
      reasons.push({
        type: 'exceeded_credit_limit',
        message: `Client has exceeded their credit limit. Balance: $${currentBalance.toFixed(2)}, Limit: $${creditLimit.toFixed(2)}.`,
        severity: 'block',
      });
      requiresAdminOverride = true;
    }

    return {
      clientId,
      clientName: clientData.clientName,
      canCreateInvoice: !requiresAdminOverride,
      requiresAdminOverride,
      reasons,
      creditLimit,
      currentBalance,
      overdueAmount,
      overdueInvoiceCount,
      isBadCredit,
    };
  }

  async getClientArrearsInfo(clientId: number): Promise<ArrearsInfo> {
    // Get client data
    const client = await this.db
      .select()
      .from(schema.clients)
      .where(eq(schema.clients.id, clientId))
      .limit(1);

    if (!client[0]) {
      throw new Error('Client not found');
    }

    const clientData = client[0];
    const creditLimit = parseFloat(clientData.creditLimit || '0');
    const isBadCredit = clientData.isBadCredit ?? false;

    // Get all unpaid invoices for this client
    const unpaidInvoices = await this.db
      .select()
      .from(schema.invoices)
      .where(
        and(
          eq(schema.invoices.clientId, clientId),
          or(
            eq(schema.invoices.status, 'active'),
            eq(schema.invoices.status, 'partially_paid')
          ),
          eq(schema.invoices.isArchived, false)
        )
      );

    let totalOutstanding = 0;
    let overdueAmount = 0;
    const overdueInvoices: schema.Invoice[] = [];
    let oldestOverdueDays = 0;
    const today = new Date();
    const defaultCreditTermsDays = 30;

    for (const invoice of unpaidInvoices) {
      const total = parseFloat(invoice.total || '0');
      const totalPaid = parseFloat(invoice.totalPaid || '0');
      const outstanding = total - totalPaid;
      totalOutstanding += outstanding;

      // Check if invoice is overdue
      const invDate = new Date(invoice.invDate);
      const creditTerms = parseInt(invoice.creditTerms || clientData.creditTerms || String(defaultCreditTermsDays), 10);
      const dueDate = new Date(invDate);
      dueDate.setDate(dueDate.getDate() + creditTerms);

      if (today > dueDate) {
        overdueAmount += outstanding;
        overdueInvoices.push(invoice);

        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysOverdue > oldestOverdueDays) {
          oldestOverdueDays = daysOverdue;
        }
      }
    }

    return {
      clientId,
      clientName: clientData.clientName,
      totalOutstanding,
      overdueAmount,
      overdueInvoices,
      daysOldest: oldestOverdueDays,
      creditLimit,
      isOverCreditLimit: creditLimit > 0 && totalOutstanding >= creditLimit,
      isBadCredit,
    };
  }
}
