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
  includeArchived?: boolean;
  search?: string;
  status?: string;
  clientId?: number;
}

export class InvoiceService extends BaseService<
  typeof schema.invoices,
  schema.Invoice,
  schema.InsertInvoice
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.invoices);
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
    const newStatus = newTotalPaid >= total ? 'P' : 'A'; // P = Paid, A = Active

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
      .where(
        and(
          ne(schema.invoices.status, 'DRAFT'),
          gt(schema.invoices.createdAt, currentCreatedAt)
        )
      )
      .orderBy(asc(schema.invoices.createdAt))
      .limit(1);

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

  async getAdjacentInvoicesWithData(invoiceId: number): Promise<AdjacentInvoicesWithData> {
    const currentInvoice = await this.findById(invoiceId);
    if (!currentInvoice) {
      return { previousId: null, nextId: null, previousInvoice: null, nextInvoice: null };
    }

    const currentCreatedAt = currentInvoice.createdAt;

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
