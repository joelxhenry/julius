import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gte, lte, desc, asc, count, or, ilike, gt, lt, sql } from 'drizzle-orm';
import * as schema from '../database/schema';
import { InvoiceStatus } from '../database/schema/invoices';
import { BaseService } from './BaseService';
import { PaginatedResult } from './types';
import { STORE_CREDIT_METHOD_CODE } from '../../shared/constants/payments';

// The service db or an open transaction — both expose the same query builder,
// so stock-mutation helpers can run against either.
type DbExecutor =
  | NodePgDatabase<typeof schema>
  | Parameters<Parameters<NodePgDatabase<typeof schema>['transaction']>[0]>[0];

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
  startDate?: string;
  endDate?: string;
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
  transactionReference?: string;
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
    const { page = 1, pageSize = 50, includeArchived = false, search, status, clientId, startDate, endDate } = params;
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

    if (startDate) {
      conditions.push(gte(schema.invoices.invDate, startDate));
    }

    if (endDate) {
      conditions.push(lte(schema.invoices.invDate, endDate));
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

  async findRecentInvoices(
    limit: number = 20,
    sortField: string = 'invDate',
    sortDirection: 'asc' | 'desc' = 'desc',
    startDate?: string,
    endDate?: string
  ): Promise<schema.Invoice[]> {
    const sortColumn = this.getSortColumn(sortField);
    const orderFn = sortDirection === 'asc' ? asc : desc;

    const conditions = [eq(schema.invoices.isArchived, false)];
    if (startDate) {
      conditions.push(gte(schema.invoices.invDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(schema.invoices.invDate, endDate));
    }

    return this.db
      .select()
      .from(schema.invoices)
      .where(and(...conditions))
      .orderBy(orderFn(sortColumn))
      .limit(limit);
  }

  private getSortColumn(field: string) {
    switch (field) {
      case 'invDate':
        return schema.invoices.invDate;
      case 'total':
        return schema.invoices.total;
      case 'status':
        return schema.invoices.status;
      default:
        return schema.invoices.invDate;
    }
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
      // All transactions go through variants (including base variants)
      const inventoryTransactions: schema.InventoryTransaction[] = [];
      for (const item of lineItems) {
        if (!item.sku || parseFloat(item.quantity) <= 0) continue;

        // First check if SKU is already a variant
        const [variant] = await tx
          .select({ id: schema.variants.id, parentSku: schema.variants.parentSku, variantSku: schema.variants.variantSku })
          .from(schema.variants)
          .where(eq(schema.variants.variantSku, item.sku))
          .limit(1);

        if (variant) {
          // SKU is a variant - use directly
          const [invTrans] = await tx
            .insert(schema.inventoryTransactions)
            .values({
              sku: variant.parentSku,
              variantSku: variant.variantSku,
              activity: 'SALE',
              reference: invNumber!,
              quantity: -parseFloat(item.quantity),
              activityDate: invoiceData.invDate,
            })
            .returning();

          inventoryTransactions.push(invTrans);

          // Update variant quantity
          await tx.execute(sql`
            UPDATE variants
            SET quantity = quantity - ${parseFloat(item.quantity)},
                updated_at = NOW()
            WHERE variant_sku = ${item.sku}
          `);
        } else {
          // SKU is not a variant - check if it's an inventory item and resolve to base variant
          const [inventoryItem] = await tx
            .select({ sku: schema.inventory.sku })
            .from(schema.inventory)
            .where(eq(schema.inventory.sku, item.sku))
            .limit(1);

          if (!inventoryItem) {
            warnings.push(`SKU ${item.sku} not found - inventory not reduced`);
            continue;
          }

          // Look up the base variant for this inventory item
          const [baseVariant] = await tx
            .select({ variantSku: schema.variants.variantSku })
            .from(schema.variants)
            .where(and(eq(schema.variants.parentSku, item.sku), eq(schema.variants.isBase, true)))
            .limit(1);

          if (baseVariant) {
            // Use base variant for transaction
            const [invTrans] = await tx
              .insert(schema.inventoryTransactions)
              .values({
                sku: item.sku,
                variantSku: baseVariant.variantSku,
                activity: 'SALE',
                reference: invNumber!,
                quantity: -parseFloat(item.quantity),
                activityDate: invoiceData.invDate,
              })
              .returning();

            inventoryTransactions.push(invTrans);

            // Update base variant quantity
            await tx.execute(sql`
              UPDATE variants
              SET quantity = quantity - ${parseFloat(item.quantity)},
                  updated_at = NOW()
              WHERE variant_sku = ${baseVariant.variantSku}
            `);
          } else {
            // Fallback: No base variant found, record against inventory directly
            warnings.push(`No base variant found for ${item.sku} - using legacy inventory`);
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

            // Update inventory quantity
            await tx.execute(sql`
              UPDATE inventory
              SET quantity = quantity - ${parseFloat(item.quantity)},
                  updated_at = NOW()
              WHERE sku = ${item.sku}
            `);
          }
        }
      }

      // 6. Create payment records
      const paymentDate = new Date().toISOString().split('T')[0];
      const createdPayments: schema.Payment[] = [];

      // Store-credit entries are funded from the client's credit notes (FIFO,
      // oldest note first), not cash. Preload the available notes and validate
      // there is enough credit before drawing any of it down.
      const storeCreditNeeded = paymentEntries
        .filter((e) => e.paymentMethodCode === STORE_CREDIT_METHOD_CODE)
        .reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0);

      const creditPool: Array<{
        id: number;
        crNumber: string;
        crDate: string;
        total: number;
        used: number;
        available: number;
      }> = [];

      if (storeCreditNeeded > 0.001) {
        if (!invoiceData.clientId) {
          throw new Error('Store credit payments require a client');
        }
        const notes = await tx
          .select()
          .from(schema.creditNotes)
          .where(
            and(
              eq(schema.creditNotes.clientId, invoiceData.clientId),
              eq(schema.creditNotes.status, 'A'),
              eq(schema.creditNotes.isArchived, false)
            )
          );
        creditPool.push(
          ...notes
            .map((cn) => {
              const total = parseFloat(cn.total || '0');
              const used = parseFloat(cn.totalUsed || '0');
              return { id: cn.id, crNumber: cn.crNumber, crDate: cn.crDate, total, used, available: total - used };
            })
            .filter((c) => c.available > 0.001)
            .sort((a, b) => (a.crDate !== b.crDate ? (a.crDate < b.crDate ? -1 : 1) : a.id - b.id))
        );
        const totalAvailable = creditPool.reduce((sum, c) => sum + c.available, 0);
        if (storeCreditNeeded > totalAvailable + 0.01) {
          throw new Error(
            `Available store credit ($${totalAvailable.toFixed(2)}) is less than the store-credit payment ($${storeCreditNeeded.toFixed(2)})`
          );
        }
      }

      for (const entry of paymentEntries) {
        if (entry.paymentMethodCode === STORE_CREDIT_METHOD_CODE) {
          // Draw this entry's amount from credit notes FIFO. Each chunk becomes a
          // CREDIT payment row tied to the funding note and reduces its balance.
          let need = parseFloat(entry.amount || '0');
          for (const cn of creditPool) {
            if (need <= 0.001) break;
            if (cn.available <= 0.001) continue;
            const chunk = Math.min(need, cn.available);
            const chunkStr = chunk.toFixed(2);

            const [payment] = await tx
              .insert(schema.payments)
              .values({
                documentType: 'CREDIT',
                documentNumber: invNumber!,
                invoiceNumber: invNumber!,
                creditNoteNumber: cn.crNumber,
                amount: chunkStr,
                payerName,
                paymentDesc: `Applied credit note ${cn.crNumber}`,
                paymentDesc2: entry.notes || null,
                transactionReference: entry.transactionReference || null,
                paymentDate,
                processedById,
              })
              .returning();
            createdPayments.push(payment);

            const newUsed = cn.used + chunk;
            await tx
              .update(schema.creditNotes)
              .set({
                totalUsed: newUsed.toFixed(2),
                status: newUsed >= cn.total - 0.001 ? 'U' : 'A',
              })
              .where(eq(schema.creditNotes.id, cn.id));

            cn.used = newUsed;
            cn.available -= chunk;
            need -= chunk;
          }
          if (need > 0.01) {
            // Should not happen — validated above — but guard against races.
            throw new Error('Insufficient store credit to cover the payment');
          }
        } else {
          // Cash / card / etc. — method code in paymentDesc, notes in paymentDesc2.
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
              transactionReference: entry.transactionReference || null,
              paymentDate,
              processedById,
            })
            .returning();

          createdPayments.push(payment);
        }
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

  async searchInvoices(
    query: string,
    limit: number = 20,
    sortField: string = 'invDate',
    sortDirection: 'asc' | 'desc' = 'desc',
    startDate?: string,
    endDate?: string
  ): Promise<schema.Invoice[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const searchTerm = `%${query.trim()}%`;
    const sortColumn = this.getSortColumn(sortField);
    const orderFn = sortDirection === 'asc' ? asc : desc;

    const conditions = [
      or(
        ilike(schema.invoices.invNumber, searchTerm),
        ilike(schema.invoices.clientName, searchTerm),
        ilike(schema.invoices.reference, searchTerm)
      ),
    ];
    if (startDate) {
      conditions.push(gte(schema.invoices.invDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(schema.invoices.invDate, endDate));
    }

    return this.db
      .select()
      .from(schema.invoices)
      .where(and(...conditions))
      .orderBy(orderFn(sortColumn))
      .limit(limit);
  }

  async updateInvoiceStatus(id: number, status: InvoiceStatus): Promise<schema.Invoice | null> {
    return this.update(id, {
      status,
      updatedAt: new Date(),
    });
  }

  /**
   * Re-evaluate an invoice's status from its current line items. Call this after
   * any line-item mutation (create/delete) so the stored status stays in sync:
   *   - zero line items                     -> 'cancelled'
   *   - line items exist and status is       -> restored to a payment-based status
   *     'cancelled' (i.e. re-populated)         (paid / partially_paid / active)
   * Any other status with line items present is left untouched, so this never
   * clobbers a paid/partially_paid/archived invoice that still has line items.
   */
  async syncStatusFromLineItems(invNumber: string): Promise<schema.Invoice | null> {
    const [invoice] = await this.db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.invNumber, invNumber))
      .limit(1);
    if (!invoice) return null;

    const [{ value: lineItemCount }] = await this.db
      .select({ value: count() })
      .from(schema.documentLineItems)
      .where(
        and(
          eq(schema.documentLineItems.documentType, 'INVOICE'),
          eq(schema.documentLineItems.documentNumber, invNumber)
        )
      );
    const hasLineItems = Number(lineItemCount) > 0;

    if (!hasLineItems) {
      // No line items left -> cancel (unless already cancelled).
      if (invoice.status === 'cancelled') return invoice;
      return this.updateInvoiceStatus(invoice.id, 'cancelled');
    }

    // Line items are present again -> restore a previously cancelled invoice to a
    // payment-appropriate status. Leave every other status as-is.
    if (invoice.status === 'cancelled') {
      const total = parseFloat(invoice.total || '0');
      const totalPaid = parseFloat(invoice.totalPaid || '0');
      const restored: InvoiceStatus =
        total > 0 && totalPaid >= total ? 'paid' : totalPaid > 0 ? 'partially_paid' : 'active';
      return this.updateInvoiceStatus(invoice.id, restored);
    }

    return invoice;
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

      // Resolve the stock a sale would actually decrement (variant-aware), not the
      // legacy inventory row — line items are usually variant SKUs.
      const stock = await this.getEffectiveStock(this.db, item.sku);
      if (!stock) continue; // unknown SKU — nothing to warn about

      // Check if quantity exceeds available
      if (item.quantity > stock.onHand) {
        // Get alternates
        const alternates = await this.db
          .select({
            alternateSku: schema.inventoryAlternates.alternateNo,
          })
          .from(schema.inventoryAlternates)
          .where(eq(schema.inventoryAlternates.partNo, item.sku));

        const alternatesWithStock = [];
        for (const alt of alternates) {
          const altStock = await this.getEffectiveStock(this.db, alt.alternateSku);
          if (altStock && altStock.onHand >= item.quantity) {
            const [altItem] = await this.db
              .select()
              .from(schema.inventory)
              .where(eq(schema.inventory.sku, alt.alternateSku))
              .limit(1);

            alternatesWithStock.push({
              sku: alt.alternateSku,
              description: altItem?.description1 || altItem?.description2 || 'No description',
              availableQty: altStock.onHand,
            });
          }
        }

        warnings.push({
          sku: item.sku,
          requestedQty: item.quantity,
          availableQty: stock.onHand,
          hasAlternates: alternatesWithStock.length > 0,
          alternates: alternatesWithStock,
        });
      }
    }

    return warnings;
  }

  /**
   * Resolve a SKU to the stock location a sale would actually decrement,
   * mirroring deductStockForItem: a matching variant, else the inventory item's
   * base variant, else the legacy inventory row. Returns the current on-hand
   * quantity and where it lives, or null when the SKU is unknown.
   */
  private async getEffectiveStock(
    exec: DbExecutor,
    sku: string
  ): Promise<{ variantSku: string | null; parentSku: string; onHand: number } | null> {
    // Direct variant match
    const [variant] = await exec
      .select({
        variantSku: schema.variants.variantSku,
        parentSku: schema.variants.parentSku,
        quantity: schema.variants.quantity,
      })
      .from(schema.variants)
      .where(eq(schema.variants.variantSku, sku))
      .limit(1);
    if (variant) {
      return { variantSku: variant.variantSku, parentSku: variant.parentSku, onHand: variant.quantity };
    }

    // Inventory item — resolve to its base variant when present
    const [inventoryItem] = await exec
      .select({ sku: schema.inventory.sku, quantity: schema.inventory.quantity })
      .from(schema.inventory)
      .where(eq(schema.inventory.sku, sku))
      .limit(1);
    if (!inventoryItem) return null;

    const [baseVariant] = await exec
      .select({ variantSku: schema.variants.variantSku, quantity: schema.variants.quantity })
      .from(schema.variants)
      .where(and(eq(schema.variants.parentSku, sku), eq(schema.variants.isBase, true)))
      .limit(1);
    if (baseVariant) {
      return { variantSku: baseVariant.variantSku, parentSku: inventoryItem.sku, onHand: baseVariant.quantity };
    }

    return { variantSku: null, parentSku: inventoryItem.sku, onHand: inventoryItem.quantity };
  }

  /**
   * Set the on-hand quantity for a SKU to an absolute value and record the
   * correction in the activity log. Used by the negative-stock admin override so
   * a manager can book in stock that physically arrived but was never entered.
   * Resolves the same location a sale decrements (variant, base variant, or
   * legacy inventory) so the number shown on the invoice screen and the number
   * corrected here always agree. Returns the new on-hand quantity.
   */
  async adjustStockBySku(
    sku: string,
    newQty: number,
    employeeId?: number
  ): Promise<{ sku: string; onHand: number }> {
    if (!sku) throw new Error('SKU is required');
    if (!Number.isFinite(newQty)) throw new Error('A valid quantity is required');

    return this.db.transaction(async (tx) => {
      const stock = await this.getEffectiveStock(tx, sku);
      if (!stock) throw new Error(`SKU ${sku} not found in inventory or variants`);

      const delta = newQty - stock.onHand;

      if (stock.variantSku) {
        await tx.execute(
          sql`UPDATE variants SET quantity = ${newQty}, updated_at = NOW() WHERE variant_sku = ${stock.variantSku}`
        );
      } else {
        await tx.execute(
          sql`UPDATE inventory SET quantity = ${newQty}, updated_at = NOW() WHERE sku = ${stock.parentSku}`
        );
      }

      // Record the correction so the adjustment is auditable (skip no-ops).
      if (delta !== 0) {
        await tx.insert(schema.inventoryTransactions).values({
          sku: stock.parentSku,
          variantSku: stock.variantSku,
          activity: 'ADJUSTMENT',
          reference: employeeId ? `STOCK-OVERRIDE:${employeeId}` : 'STOCK-OVERRIDE',
          quantity: delta,
          activityDate: new Date().toISOString().split('T')[0],
        });
      }

      return { sku, onHand: newQty };
    });
  }

  /**
   * Deduct stock for a single line item and record the SALE transaction.
   * Resolves the SKU to a variant (directly, or via the inventory item's base
   * variant) and falls back to legacy inventory when no variant exists.
   * `exec` is either the service db or an open transaction, so the same
   * resolution logic is shared by create and reissue.
   */
  private async deductStockForItem(
    exec: DbExecutor,
    item: { sku: string | null; quantity: number },
    reference: string,
    activityDate: string
  ): Promise<void> {
    if (!item.sku || item.quantity <= 0) return;

    // First check if this SKU is already a variant
    const variant = await exec
      .select({ id: schema.variants.id, parentSku: schema.variants.parentSku, variantSku: schema.variants.variantSku })
      .from(schema.variants)
      .where(eq(schema.variants.variantSku, item.sku))
      .limit(1);

    if (variant.length > 0) {
      // SKU is a variant - use directly
      await exec.insert(schema.inventoryTransactions).values({
        sku: variant[0].parentSku,
        variantSku: variant[0].variantSku,
        activity: 'SALE',
        reference,
        quantity: -item.quantity,
        activityDate,
      });
      await exec.execute(
        sql`UPDATE variants SET quantity = quantity - ${item.quantity}, updated_at = NOW() WHERE variant_sku = ${item.sku}`
      );
      return;
    }

    // SKU is not a variant - check if it's an inventory item and resolve to base variant
    const inventoryItem = await exec
      .select({ sku: schema.inventory.sku })
      .from(schema.inventory)
      .where(eq(schema.inventory.sku, item.sku))
      .limit(1);

    if (inventoryItem.length === 0) {
      // SKU not found in inventory or variants - skip
      console.warn(`SKU ${item.sku} not found in inventory or variants`);
      return;
    }

    // Look up the base variant for this inventory item
    const baseVariant = await exec
      .select({ variantSku: schema.variants.variantSku })
      .from(schema.variants)
      .where(and(eq(schema.variants.parentSku, item.sku), eq(schema.variants.isBase, true)))
      .limit(1);

    if (baseVariant.length > 0) {
      // Use base variant for transaction
      await exec.insert(schema.inventoryTransactions).values({
        sku: item.sku,
        variantSku: baseVariant[0].variantSku,
        activity: 'SALE',
        reference,
        quantity: -item.quantity,
        activityDate,
      });
      await exec.execute(
        sql`UPDATE variants SET quantity = quantity - ${item.quantity}, updated_at = NOW() WHERE variant_sku = ${baseVariant[0].variantSku}`
      );
    } else {
      // Fallback: No base variant found, record against inventory directly
      // This handles legacy data before migration
      console.warn(`No base variant found for inventory item ${item.sku}`);
      await exec.insert(schema.inventoryTransactions).values({
        sku: item.sku,
        activity: 'SALE',
        reference,
        quantity: -item.quantity,
        activityDate,
      });
      await exec.execute(
        sql`UPDATE inventory SET quantity = quantity - ${item.quantity}, updated_at = NOW() WHERE sku = ${item.sku}`
      );
    }
  }

  /**
   * Create inventory transactions when invoice is issued
   * Reduces inventory quantities and creates transaction records
   * All transactions now go through variants (including base variants)
   * For all items: sku = parent SKU (for FK), variantSku = variant SKU (required)
   */
  async createInventoryTransactions(
    invNumber: string,
    lineItems: Array<{ sku: string | null; quantity: number }>,
    invDate: string
  ): Promise<void> {
    for (const item of lineItems) {
      await this.deductStockForItem(this.db, item, invNumber, invDate);
    }
  }

  /**
   * Reconcile inventory for an edited invoice. Editing an issued invoice
   * replaces its line items, so the original SALE deductions must be undone and
   * re-applied from the new line items — otherwise stock stays deducted at the
   * old quantities and the activity log keeps the stale SALE rows.
   *
   * Runs atomically: the invoice's existing SALE transactions are reversed
   * (stock restored) and deleted, then fresh SALE transactions are created for
   * the current line items. Passing an empty line-item list (a cancel-via-edit)
   * simply restores all stock and leaves no SALE rows.
   */
  async reissueInventoryTransactions(
    invNumber: string,
    lineItems: Array<{ sku: string | null; quantity: number }>,
    invDate: string
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const saleFilter = and(
        eq(schema.inventoryTransactions.reference, invNumber),
        eq(schema.inventoryTransactions.activity, 'SALE')
      );

      // 1. Reverse the original deductions using the stored SALE rows (the source
      //    of truth for what was actually taken). SALE quantities are negative,
      //    so subtracting them adds the stock back.
      const existing = await tx.select().from(schema.inventoryTransactions).where(saleFilter);

      for (const t of existing) {
        if (t.variantSku) {
          await tx.execute(
            sql`UPDATE variants SET quantity = quantity - ${t.quantity}, updated_at = NOW() WHERE variant_sku = ${t.variantSku}`
          );
        } else {
          await tx.execute(
            sql`UPDATE inventory SET quantity = quantity - ${t.quantity}, updated_at = NOW() WHERE sku = ${t.sku}`
          );
        }
      }

      await tx.delete(schema.inventoryTransactions).where(saleFilter);

      // 2. Apply fresh deductions for the current line items.
      for (const item of lineItems) {
        await this.deductStockForItem(tx, item, invNumber, invDate);
      }
    });
  }
}
