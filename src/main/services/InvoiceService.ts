import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gte, lte, desc, asc, count, or, ilike, ne, gt, lt } from 'drizzle-orm';
import * as schema from '../database/schema';
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
  includeHistorical?: boolean;
  search?: string;
  status?: string;
}

// Keep old interface for backwards compatibility
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  includeHistorical?: boolean;
}

export class InvoiceService extends BaseService<
  typeof schema.invoices,
  schema.Invoice,
  schema.InsertInvoice
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.invoices);
  }

  /**
   * Find all invoices, optionally filtering out historical ones
   * By default, excludes historical invoices for better performance
   */
  async findAllFiltered(includeHistorical: boolean = false): Promise<schema.Invoice[]> {
    if (includeHistorical) {
      return this.db
        .select()
        .from(schema.invoices)
        .orderBy(desc(schema.invoices.createdAt));
    }
    return this.db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.isHistorical, 0))
      .orderBy(desc(schema.invoices.createdAt));
  }

  /**
   * Find invoices with pagination, search, and filter support
   * Returns paginated results with total count for efficient data loading
   */
  async findPaginated(params: InvoiceQueryParams = {}): Promise<PaginatedResult<schema.Invoice>> {
    const { page = 1, pageSize = 50, includeHistorical = false, search, status } = params;
    const offset = (page - 1) * pageSize;

    // Build where conditions array
    const conditions = [];

    // Historical filter
    if (!includeHistorical) {
      conditions.push(eq(schema.invoices.isHistorical, 0));
    }

    // Status filter
    if (status && status !== 'all') {
      conditions.push(eq(schema.invoices.status, status));
    }

    // Search filter - search across invoice number, client name, reference
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(schema.invoices.invoiceNumber, searchTerm),
          ilike(schema.invoices.clientName, searchTerm),
          ilike(schema.invoices.reference, searchTerm)
        )
      );
    }

    // Combine conditions
    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await this.db
      .select({ count: count() })
      .from(schema.invoices)
      .where(whereCondition);

    const total = Number(countResult[0]?.count ?? 0);

    // Get paginated data
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

  async findByLegacyId(legacyId: number, isHistorical: boolean = false): Promise<schema.Invoice | null> {
    const results = await this.db
      .select()
      .from(schema.invoices)
      .where(
        and(
          eq(schema.invoices.legacyId, legacyId),
          eq(schema.invoices.isHistorical, isHistorical ? 1 : 0)
        )
      )
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

  async findByEmployee(employeeId: number): Promise<schema.Invoice[]> {
    return this.db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.employeeId, employeeId))
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
          gte(schema.invoices.createdAt, startDate),
          lte(schema.invoices.createdAt, endDate)
        )
      )
      .orderBy(desc(schema.invoices.createdAt));
  }

  async findUnpaid(): Promise<schema.Invoice[]> {
    return this.db
      .select()
      .from(schema.invoices)
      .where(
        and(
          eq(schema.invoices.status, 'unpaid'),
          eq(schema.invoices.isHistorical, 0)
        )
      )
      .orderBy(desc(schema.invoices.createdAt));
  }

  async recordPayment(id: number, amount: number): Promise<schema.Invoice | null> {
    const invoice = await this.findById(id);
    if (!invoice) return null;

    const newAmountPaid = invoice.amountPaid + amount;
    const newBalance = invoice.total - newAmountPaid;
    const newStatus = newBalance <= 0 ? 'paid' : newBalance < invoice.total ? 'partial' : 'unpaid';

    return this.update(id, {
      amountPaid: newAmountPaid,
      balance: newBalance,
      status: newStatus,
    });
  }

  /**
   * Get adjacent (previous and next) non-draft invoice IDs for navigation
   * Previous = newer invoice (higher createdAt), Next = older invoice (lower createdAt)
   */
  async getAdjacentInvoices(invoiceId: number): Promise<AdjacentInvoices> {
    // First get the current invoice's createdAt
    const currentInvoice = await this.findById(invoiceId);
    if (!currentInvoice) {
      return { previousId: null, nextId: null };
    }

    const currentCreatedAt = currentInvoice.createdAt;

    // Get previous invoice (newer - higher createdAt, non-draft)
    const previousResult = await this.db
      .select({ id: schema.invoices.id })
      .from(schema.invoices)
      .where(
        and(
          ne(schema.invoices.status, 'DRAFT'),
          gt(schema.invoices.createdAt, currentCreatedAt)
        )
      )
      .orderBy(asc(schema.invoices.createdAt))
      .limit(1);

    // Get next invoice (older - lower createdAt, non-draft)
    const nextResult = await this.db
      .select({ id: schema.invoices.id })
      .from(schema.invoices)
      .where(
        and(
          ne(schema.invoices.status, 'DRAFT'),
          lt(schema.invoices.createdAt, currentCreatedAt)
        )
      )
      .orderBy(desc(schema.invoices.createdAt))
      .limit(1);

    return {
      previousId: previousResult[0]?.id ?? null,
      nextId: nextResult[0]?.id ?? null,
    };
  }

  /**
   * Get adjacent (previous and next) non-draft invoices with full data for caching
   * Previous = newer invoice (higher createdAt), Next = older invoice (lower createdAt)
   */
  async getAdjacentInvoicesWithData(invoiceId: number): Promise<AdjacentInvoicesWithData> {
    // First get the current invoice's createdAt
    const currentInvoice = await this.findById(invoiceId);
    if (!currentInvoice) {
      return { previousId: null, nextId: null, previousInvoice: null, nextInvoice: null };
    }

    const currentCreatedAt = currentInvoice.createdAt;

    // Get previous invoice (newer - higher createdAt, non-draft) with full data
    const previousResult = await this.db
      .select()
      .from(schema.invoices)
      .where(
        and(
          ne(schema.invoices.status, 'DRAFT'),
          gt(schema.invoices.createdAt, currentCreatedAt)
        )
      )
      .orderBy(asc(schema.invoices.createdAt))
      .limit(1);

    // Get next invoice (older - lower createdAt, non-draft) with full data
    const nextResult = await this.db
      .select()
      .from(schema.invoices)
      .where(
        and(
          ne(schema.invoices.status, 'DRAFT'),
          lt(schema.invoices.createdAt, currentCreatedAt)
        )
      )
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
}

export class InvoiceItemService extends BaseService<
  typeof schema.invoiceItems,
  schema.InvoiceItem,
  schema.InsertInvoiceItem
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.invoiceItems);
  }

  async findByInvoice(invoiceId: number): Promise<schema.InvoiceItem[]> {
    return this.db
      .select()
      .from(schema.invoiceItems)
      .where(eq(schema.invoiceItems.invoiceId, invoiceId));
  }

  async findByLegacyId(legacyId: number): Promise<schema.InvoiceItem | null> {
    const results = await this.db
      .select()
      .from(schema.invoiceItems)
      .where(eq(schema.invoiceItems.legacyId, legacyId))
      .limit(1);
    return results[0] || null;
  }

  async bulkCreate(items: schema.InsertInvoiceItem[]): Promise<schema.InvoiceItem[]> {
    return this.db
      .insert(schema.invoiceItems)
      .values(items)
      .returning();
  }

  async deleteByInvoice(invoiceId: number): Promise<boolean> {
    await this.db
      .delete(schema.invoiceItems)
      .where(eq(schema.invoiceItems.invoiceId, invoiceId));
    return true;
  }
}
