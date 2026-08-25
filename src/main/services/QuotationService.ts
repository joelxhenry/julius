import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gte, lte, desc, asc, count, or, ilike, ne, gt, lt, sql } from 'drizzle-orm';
import * as schema from '../database/schema';
import { BaseService } from './BaseService';
import { PaginatedResult } from './types';

export interface ConvertToInvoiceResult {
  invoice: schema.Invoice;
  quotation: schema.Quotation;
}

export interface AdjacentQuotations {
  previousId: number | null;
  nextId: number | null;
}

export interface QuotationQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  clientId?: number;
  includeArchived?: boolean;
  archivedOnly?: boolean;
  startDate?: string;
  endDate?: string;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
}

export class QuotationService extends BaseService<
  typeof schema.quotations,
  schema.Quotation,
  schema.InsertQuotation
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.quotations);
  }

  async findPaginated(params: QuotationQueryParams = {}): Promise<PaginatedResult<schema.Quotation>> {
    const {
      page = 1,
      pageSize = 50,
      search,
      status,
      clientId,
      includeArchived = false,
      archivedOnly = false,
      startDate,
      endDate,
      sortField = 'quoteDate',
      sortDirection = 'desc',
    } = params;
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (archivedOnly) {
      conditions.push(eq(schema.quotations.isArchived, true));
    } else if (!includeArchived) {
      conditions.push(eq(schema.quotations.isArchived, false));
    }

    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(schema.quotations.quoteNum, searchTerm),
          ilike(schema.quotations.reference, searchTerm),
          ilike(schema.quotations.clientName, searchTerm)
        )
      );
    }

    if (status && status !== 'all') {
      conditions.push(eq(schema.quotations.status, status));
    }

    if (clientId) {
      conditions.push(eq(schema.quotations.clientId, clientId));
    }

    if (startDate) {
      conditions.push(gte(schema.quotations.quoteDate, startDate));
    }

    if (endDate) {
      conditions.push(lte(schema.quotations.quoteDate, endDate));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await this.db
      .select({ count: count() })
      .from(schema.quotations)
      .where(whereCondition);

    const total = Number(countResult[0]?.count ?? 0);

    const sortColumn = this.getSortColumn(sortField);
    const orderFn = sortDirection === 'asc' ? asc : desc;

    const data = await this.db
      .select()
      .from(schema.quotations)
      .where(whereCondition)
      .orderBy(orderFn(sortColumn))
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

  private getSortColumn(field: string) {
    switch (field) {
      case 'quoteDate':
        return schema.quotations.quoteDate;
      case 'total':
        return schema.quotations.total;
      case 'status':
        // Status column doesn't exist in quotations schema, fall back to createdAt
        return schema.quotations.createdAt;
      default:
        return schema.quotations.quoteDate;
    }
  }

  async findByQuoteNum(quoteNum: string): Promise<schema.Quotation | null> {
    const results = await this.db
      .select()
      .from(schema.quotations)
      .where(eq(schema.quotations.quoteNum, quoteNum))
      .limit(1);
    return results[0] || null;
  }

  async findByClient(clientId: number): Promise<schema.Quotation[]> {
    return this.db
      .select()
      .from(schema.quotations)
      .where(eq(schema.quotations.clientId, clientId))
      .orderBy(desc(schema.quotations.createdAt));
  }

  async findBySalesperson(salespersonId: number): Promise<schema.Quotation[]> {
    return this.db
      .select()
      .from(schema.quotations)
      .where(eq(schema.quotations.salespersonId, salespersonId))
      .orderBy(desc(schema.quotations.createdAt));
  }

  async findByStatus(status: string): Promise<schema.Quotation[]> {
    return this.db
      .select()
      .from(schema.quotations)
      .where(eq(schema.quotations.status, status))
      .orderBy(desc(schema.quotations.createdAt));
  }

  async findByDateRange(startDate: string, endDate: string): Promise<schema.Quotation[]> {
    return this.db
      .select()
      .from(schema.quotations)
      .where(
        and(
          gte(schema.quotations.quoteDate, startDate),
          lte(schema.quotations.quoteDate, endDate)
        )
      )
      .orderBy(desc(schema.quotations.quoteDate));
  }

  /**
   * Convert a quotation to an invoice
   * Creates a new invoice with status 'active' and copies all line items
   */
  async convertToInvoice(id: number): Promise<ConvertToInvoiceResult | null> {
    const quotation = await this.findById(id);
    if (!quotation) return null;

    // Generate invoice number
    const invNumResult = await this.db.execute(sql`SELECT nextval('seq_invoice_number') as next_num`);
    const invNumber = (invNumResult.rows[0] as { next_num: string }).next_num.toString();

    // Create invoice from quotation data
    const [invoice] = await this.db
      .insert(schema.invoices)
      .values({
        invNumber,
        invDate: new Date().toISOString().split('T')[0],
        clientId: quotation.clientId,
        clientName: quotation.clientName,
        salespersonId: quotation.salespersonId,
        salespersonName: quotation.salespersonName,
        reference: `Quote #${quotation.quoteNum}`,
        notes: quotation.notes,
        subTotal: quotation.subTotal,
        tax: quotation.tax,
        total: quotation.total,
        totalPaid: '0.00',
        status: 'active',
        isArchived: false,
      })
      .returning();

    // Copy line items from quotation to invoice
    const quoteLineItems = await this.db
      .select()
      .from(schema.documentLineItems)
      .where(
        and(
          eq(schema.documentLineItems.documentType, 'QUOTE'),
          eq(schema.documentLineItems.documentNumber, quotation.quoteNum)
        )
      )
      .orderBy(schema.documentLineItems.lineNumber);

    if (quoteLineItems.length > 0) {
      const invoiceLineItems = quoteLineItems.map((item) => ({
        documentType: 'INVOICE' as const,
        documentNumber: invNumber,
        lineNumber: item.lineNumber,
        sku: item.sku,
        isVariant: item.isVariant,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        isTaxable: item.isTaxable,
        amount: item.amount,
      }));

      await this.db.insert(schema.documentLineItems).values(invoiceLineItems);
    }

    // Update quotation status to converted
    const updatedQuotation = await this.update(id, { status: 'converted' });

    return {
      invoice,
      quotation: updatedQuotation!,
    };
  }

  async expire(id: number): Promise<schema.Quotation | null> {
    return this.update(id, { status: 'expired' });
  }

  async archive(id: number): Promise<schema.Quotation | null> {
    return this.update(id, { isArchived: true });
  }

  /**
   * Get adjacent quotations for navigation (excluding archived)
   */
  async getAdjacentQuotations(quotationId: number): Promise<AdjacentQuotations> {
    const currentQuotation = await this.findById(quotationId);
    if (!currentQuotation) {
      return { previousId: null, nextId: null };
    }

    const currentCreatedAt = currentQuotation.createdAt;

    // Previous = newer (created after current)
    const previousResult = await this.db
      .select({ id: schema.quotations.id })
      .from(schema.quotations)
      .where(
        and(
          eq(schema.quotations.isArchived, false),
          gt(schema.quotations.createdAt, currentCreatedAt)
        )
      )
      .orderBy(asc(schema.quotations.createdAt))
      .limit(1);

    // Next = older (created before current)
    const nextResult = await this.db
      .select({ id: schema.quotations.id })
      .from(schema.quotations)
      .where(
        and(
          eq(schema.quotations.isArchived, false),
          lt(schema.quotations.createdAt, currentCreatedAt)
        )
      )
      .orderBy(desc(schema.quotations.createdAt))
      .limit(1);

    return {
      previousId: previousResult[0]?.id ?? null,
      nextId: nextResult[0]?.id ?? null,
    };
  }

  /**
   * Find recent quotations for quick access on the create page
   * Filters to non-archived quotations only
   */
  async findRecentQuotations(limit: number = 3): Promise<schema.Quotation[]> {
    return this.db
      .select()
      .from(schema.quotations)
      .where(eq(schema.quotations.isArchived, false))
      .orderBy(desc(schema.quotations.createdAt))
      .limit(limit);
  }
}
