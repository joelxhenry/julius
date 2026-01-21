import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gte, lte, desc, asc, count, or, ilike, gt, lt, sql } from 'drizzle-orm';
import * as schema from '../database/schema';
import { InvoiceStatus } from '../database/schema/invoices';
import { BaseService } from './BaseService';
import { PaginatedResult } from './types';

export interface AdjacentInvoices {
  previousId: number | null;
  nextId: number | null;
}

export interface AdjacentInvoicesWithData {
  previousId: number | null;
  nextId: number | null;
  previousInvoice: schema.Invoice | null;
  nextInvoice: schema.Invoice | null;
}

export interface InvoiceQueryParams {
  page?: number;
  pageSize?: number;
  includeArchived?: boolean;
  search?: string;
  status?: string;
  clientId?: number;
}

export interface InvoiceLineItemInput {
  lineNumber: number;
  sku: string | null;
  description: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  isTaxable: boolean;
  amount: string;
}

export interface PaymentEntryInput {
  paymentMethodCode: string;
  amount: string;
  notes?: string;
}

export interface CreateInvoiceWithPaymentParams {
  invoiceData: schema.InsertInvoice;
  lineItems: InvoiceLineItemInput[];
  paymentEntries: PaymentEntryInput[];
  processedById: number;
  payerName: string;
}

export interface CreateInvoiceWithPaymentResult {
  invoice: schema.Invoice;
  lineItems: schema.DocumentLineItem[];
  payments: schema.Payment[];
  inventoryTransactions: schema.InventoryTransaction[];
  warnings: string[];
}

export class InvoiceService extends BaseService<
  typeof schema.invoices,
  schema.Invoice,
  schema.InsertInvoice
> {
  private paymentService: any;
  private creditNoteService: any;
  private documentLineItemService: any;

  constructor(
    db: NodePgDatabase<typeof schema>,
    paymentService?: any,
    creditNoteService?: any,
    documentLineItemService?: any
  ) {
    super(db, schema.invoices);
    this.paymentService = paymentService;
    this.creditNoteService = creditNoteService;
    this.documentLineItemService = documentLineItemService;
  }

  async create(data: schema.InsertInvoice): Promise<schema.Invoice> {
    // Generate invoice number if not provided
    if (!data.invNumber) {
      const result = await this.db.execute(sql`SELECT nextval('seq_invoice_number') as next_num`);
      const nextNum = (result.rows[0] as any).next_num;
      data.invNumber = nextNum.toString();
    }

    return super.create(data);
  }

  async findAllFiltered(includeArchived: boolean = false): Promise<schema.Invoice[]> {
    if (includeArchived) {
      return this.db
        .select()
        .from(schema.invoices)
        .orderBy(desc(schema.invoices.createdAt));
    }
    return this.db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.isArchived, false))
      .orderBy(desc(schema.invoices.createdAt));
  }

  async findPaginated(params: InvoiceQueryParams = {}): Promise<PaginatedResult<schema.Invoice>> {
    const { page = 1, pageSize = 50, includeArchived = false, search, status, clientId } = params;
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (!includeArchived) {
      conditions.push(eq(schema.invoices.isArchived, false));
    }

    if (clientId) {
      conditions.push(eq(schema.invoices.clientId, clientId));
    }

    if (status && status !== 'all') {
      conditions.push(eq(schema.invoices.status, status));
    }

    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(schema.invoices.invNumber, searchTerm),
          ilike(schema.invoices.clientName, searchTerm),
          ilike(schema.invoices.reference, searchTerm)
        )
      );
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await this.db
      .select({ count: count() })
      .from(schema.invoices)
      .where(whereCondition);

    const total = Number(countResult[0]?.count ?? 0);

    const data = await this.db
      .select()
      .from(schema.invoices)
      .where(whereCondition)
      .orderBy(desc(schema.invoices.createdAt))
      .limit(pageSize)
      .offset(offset);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findByInvNumber(invNumber: string): Promise<schema.Invoice | null> {
    const results = await this.db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.invNumber, invNumber))
      .limit(1);
    return results[0] || null;
  }

  async findByClient(clientId: number): Promise<schema.Invoice[]> {
    return this.db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.clientId, clientId))
      .orderBy(desc(schema.invoices.createdAt));
  }

  async findBySalesperson(salespersonId: number): Promise<schema.Invoice[]> {
    return this.db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.salespersonId, salespersonId))
      .orderBy(desc(schema.invoices.createdAt));
  }

  async findByStatus(status: string): Promise<schema.Invoice[]> {
    return this.db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.status, status))
      .orderBy(desc(schema.invoices.createdAt));
  }

  async findByDateRange(startDate: string, endDate: string): Promise<schema.Invoice[]> {
    return this.db
      .select()
      .from(schema.invoices)
      .where(
        and(
          gte(schema.invoices.invDate, startDate),
          lte(schema.invoices.invDate, endDate)
        )
      )
      .orderBy(desc(schema.invoices.invDate));
  }

  async findUnpaid(): Promise<schema.Invoice[]> {
    // Find invoices where totalPaid < total
    const allInvoices = await this.db
      .select()
      .from(schema.invoices)
      .where(
        and(
          eq(schema.invoices.status, 'A'),
          eq(schema.invoices.isArchived, false)
        )
      );

    return allInvoices.filter(inv => {
      const total = parseFloat(inv.total || '0');
      const totalPaid = parseFloat(inv.totalPaid || '0');
      return totalPaid < total;
    });
  }

  async recordPayment(id: number, amount: string): Promise<schema.Invoice | null> {
    const invoice = await this.findById(id);
    if (!invoice) return null;

    const currentPaid = parseFloat(invoice.totalPaid || '0');
    const newTotalPaid = currentPaid + parseFloat(amount);
    const total = parseFloat(invoice.total || '0');

    // Determine new status based on payment
    let newStatus: string;
    if (newTotalPaid >= total) {
      newStatus = 'paid';
    } else if (newTotalPaid > 0) {
      newStatus = 'partially_paid';
    } else {
      newStatus = 'active';
    }

    return this.update(id, {
      totalPaid: newTotalPaid.toFixed(2),
      status: newStatus,
    });
  }

  async getAdjacentInvoices(invoiceId: number): Promise<AdjacentInvoices> {
    const currentInvoice = await this.findById(invoiceId);
    if (!currentInvoice) {
      return { previousId: null, nextId: null };
    }

    const currentCreatedAt = currentInvoice.createdAt;

    const previousResult = await this.db
      .select({ id: schema.invoices.id })
      .from(schema.invoices)
      .where(gt(schema.invoices.createdAt, currentCreatedAt))
      .orderBy(asc(schema.invoices.createdAt))
      .limit(1);

    const nextResult = await this.db
      .select({ id: schema.invoices.id })
      .from(schema.invoices)
      .where(lt(schema.invoices.createdAt, currentCreatedAt))
      .orderBy(desc(schema.invoices.createdAt))
      .limit(1);

    return {
      previousId: previousResult[0]?.id ?? null,
      nextId: nextResult[0]?.id ?? null,
    };
  }

  async getAdjacentInvoicesWithData(invoiceId: number): Promise<AdjacentInvoicesWithData> {
    const currentInvoice = await this.findById(invoiceId);
    if (!currentInvoice) {
      return { previousId: null, nextId: null, previousInvoice: null, nextInvoice: null };
    }

    const currentCreatedAt = currentInvoice.createdAt;

    const previousResult = await this.db
      .select()
      .from(schema.invoices)
      .where(gt(schema.invoices.createdAt, currentCreatedAt))
      .orderBy(asc(schema.invoices.createdAt))
      .limit(1);

    const nextResult = await this.db
      .select()
      .from(schema.invoices)
      .where(lt(schema.invoices.createdAt, currentCreatedAt))
      .orderBy(desc(schema.invoices.createdAt))
      .limit(1);

    const previousInvoice = previousResult[0] ?? null;
    const nextInvoice = nextResult[0] ?? null;

    return {
      previousId: previousInvoice?.id ?? null,
      nextId: nextInvoice?.id ?? null,
      previousInvoice,
      nextInvoice,
    };
  }

  async findRecentInvoices(limit: number = 20): Promise<schema.Invoice[]> {
    return this.db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.isArchived, false))
      .orderBy(desc(schema.invoices.createdAt))
      .limit(limit);
  }

  async findOverdueInvoices(creditTermsDays: number = 30): Promise<schema.Invoice[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - creditTermsDays);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    return this.db
      .select()
      .from(schema.invoices)
      .where(
        and(
          or(
            eq(schema.invoices.status, 'active'),
            eq(schema.invoices.status, 'partially_paid')
          ),
          eq(schema.invoices.isArchived, false),
          lte(schema.invoices.invDate, cutoffDateStr)
        )
      )
      .orderBy(asc(schema.invoices.invDate));
  }

  async createInvoiceWithPayment(
    params: CreateInvoiceWithPaymentParams
  ): Promise<CreateInvoiceWithPaymentResult> {
    const { invoiceData, lineItems, paymentEntries, processedById, payerName } = params;

    // Validation before transaction
    if (lineItems.length === 0) {
      throw new Error('At least one line item required');
    }
    if (paymentEntries.length === 0) {
      throw new Error('At least one payment entry required');
    }

    const totalPayment = paymentEntries.reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0);
    const invoiceTotal = parseFloat(invoiceData.total || '0');

    if (totalPayment <= 0) {
      throw new Error('Payment must be greater than 0');
    }
    if (totalPayment > invoiceTotal + 0.01) {
      throw new Error(`Payment ($${totalPayment.toFixed(2)}) exceeds total ($${invoiceTotal.toFixed(2)})`);
    }

    // Validate payment methods
    for (const entry of paymentEntries) {
      if (!entry.paymentMethodCode) {
        throw new Error('Payment method is required for all entries');
      }
    }

    // Start atomic transaction
    return await this.db.transaction(async (tx) => {
      const warnings: string[] = [];

      // 1. Generate invoice number
      let invNumber = invoiceData.invNumber;
      if (!invNumber) {
        const result = await tx.execute(sql`SELECT nextval('seq_invoice_number') as next_num`);
        invNumber = (result.rows[0] as any).next_num.toString();
      }

      // 2. Determine status based on payment amount
      let status: InvoiceStatus;
      if (totalPayment >= invoiceTotal - 0.01) {
        status = 'paid';
      } else if (totalPayment > 0) {
        status = 'partially_paid';
      } else {
        status = 'active';
      }

      // 3. Create invoice
      const [invoice] = await tx
        .insert(schema.invoices)
        .values({
          ...invoiceData,
          invNumber,
          status,
          totalPaid: totalPayment.toFixed(2),
        })
        .returning();

      // 4. Create line items (bulk insert)
      const lineItemsData = lineItems.map((item) => ({
        documentType: 'INVOICE' as const,
        documentNumber: invNumber!,
        lineNumber: item.lineNumber,
        sku: item.sku,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        isTaxable: item.isTaxable,
        amount: item.amount,
      }));

      const createdLineItems = await tx.insert(schema.documentLineItems).values(lineItemsData).returning();

      // 5. Create inventory transactions and reduce stock
      const inventoryTransactions: schema.InventoryTransaction[] = [];
      for (const item of lineItems) {
        if (!item.sku || parseFloat(item.quantity) <= 0) continue;

        // Check if SKU exists
        const [inventoryItem] = await tx
          .select()
          .from(schema.inventory)
          .where(eq(schema.inventory.sku, item.sku))
          .limit(1);

        if (!inventoryItem) {
          warnings.push(`SKU ${item.sku} not found - inventory not reduced`);
          continue;
        }

        // Create transaction record
        const [invTrans] = await tx
          .insert(schema.inventoryTransactions)
          .values({
            sku: item.sku,
            activity: 'SALE',
            reference: invNumber!,
            quantity: -parseFloat(item.quantity),
            activityDate: invoiceData.invDate,
          })
          .returning();

        inventoryTransactions.push(invTrans);

        // Update quantity
        await tx.execute(sql`
          UPDATE inventory
          SET quantity = quantity - ${parseFloat(item.quantity)},
              updated_at = NOW()
          WHERE sku = ${item.sku}
        `);
      }

      // 6. Create payment records
      const paymentDate = new Date().toISOString().split('T')[0];
      const createdPayments: schema.Payment[] = [];

      for (const entry of paymentEntries) {
        // Create payment record with payment method in paymentDesc and notes in paymentDesc2
        const [payment] = await tx
          .insert(schema.payments)
          .values({
            documentType: 'INVOICE',
            documentNumber: invNumber!,
            invoiceNumber: invNumber!,
            amount: entry.amount,
            payerName,
            paymentDesc: entry.paymentMethodCode,
            paymentDesc2: entry.notes || null,
            paymentDate,
            processedById,
          })
          .returning();

        createdPayments.push(payment);
      }

      return {
        invoice,
        lineItems: createdLineItems,
        payments: createdPayments,
        inventoryTransactions,
        warnings,
      };
    });
  }

  async searchInvoices(query: string, limit: number = 20): Promise<schema.Invoice[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const searchTerm = `%${query.trim()}%`;

    return this.db
      .select()
      .from(schema.invoices)
      .where(
        or(
          ilike(schema.invoices.invNumber, searchTerm),
          ilike(schema.invoices.clientName, searchTerm),
          ilike(schema.invoices.reference, searchTerm)
        )
      )
      .orderBy(desc(schema.invoices.createdAt))
      .limit(limit);
  }

  async updateInvoiceStatus(id: number, status: InvoiceStatus): Promise<schema.Invoice | null> {
    return this.update(id, {
      status,
      updatedAt: new Date(),
    });
  }

  /**
   * Check inventory availability for line items
   * Returns items that have insufficient stock or alternatives available
   */
  async checkInventoryAvailability(lineItems: Array<{ sku: string | null; quantity: number }>) {
    const warnings: Array<{
      sku: string;
      requestedQty: number;
      availableQty: number;
      hasAlternates: boolean;
      alternates: Array<{ sku: string; description: string; availableQty: number }>;
    }> = [];

    for (const item of lineItems) {
      if (!item.sku) continue;

      // Get inventory item
      const [inventoryItem] = await this.db
        .select()
        .from(schema.inventory)
        .where(eq(schema.inventory.sku, item.sku))
        .limit(1);

      if (!inventoryItem) continue;

      // Check if quantity exceeds available
      if (item.quantity > inventoryItem.quantity) {
        // Get alternates
        const alternates = await this.db
          .select({
            alternateSku: schema.inventoryAlternates.alternateNo,
          })
          .from(schema.inventoryAlternates)
          .where(eq(schema.inventoryAlternates.partNo, item.sku));

        const alternatesWithStock = [];
        for (const alt of alternates) {
          const [altItem] = await this.db
            .select()
            .from(schema.inventory)
            .where(eq(schema.inventory.sku, alt.alternateSku))
            .limit(1);

          if (altItem && altItem.quantity >= item.quantity) {
            alternatesWithStock.push({
              sku: altItem.sku,
              description: altItem.description1 || altItem.description2 || 'No description',
              availableQty: altItem.quantity,
            });
          }
        }

        warnings.push({
          sku: item.sku,
          requestedQty: item.quantity,
          availableQty: inventoryItem.quantity,
          hasAlternates: alternatesWithStock.length > 0,
          alternates: alternatesWithStock,
        });
      }
    }

    return warnings;
  }

  /**
   * Create inventory transactions when invoice is issued
   * Reduces inventory quantities and creates transaction records
   */
  async createInventoryTransactions(
    invNumber: string,
    lineItems: Array<{ sku: string | null; quantity: number }>,
    invDate: string
  ): Promise<void> {
    for (const item of lineItems) {
      if (!item.sku || item.quantity <= 0) continue;

      // Create transaction record
      await this.db.insert(schema.inventoryTransactions).values({
        sku: item.sku,
        activity: 'SALE',
        reference: invNumber,
        quantity: -item.quantity, // Negative for sales
        activityDate: invDate,
      });

      // Update inventory quantity
      await this.db.execute(
        sql`UPDATE inventory SET quantity = quantity - ${item.quantity}, updated_at = NOW() WHERE sku = ${item.sku}`
      );
    }
  }
}
