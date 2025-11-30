import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, or, ilike, desc, count, and } from 'drizzle-orm';
import * as schema from '../database/schema';
import { BaseService } from './BaseService';
import { PaginatedResult } from './types';

export interface BillQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  supplier?: string;
  status?: string;
}

export class BillService extends BaseService<
  typeof schema.bills,
  schema.Bill,
  schema.InsertBill
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.bills);
  }

  async findPaginated(params: BillQueryParams = {}): Promise<PaginatedResult<schema.Bill>> {
    const { page = 1, pageSize = 50, search, supplier, status } = params;
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(schema.bills.billNo, searchTerm),
          ilike(schema.bills.description, searchTerm),
          ilike(schema.bills.orderNo, searchTerm)
        )
      );
    }

    if (supplier && supplier !== 'all') {
      conditions.push(eq(schema.bills.supplier, supplier));
    }

    if (status && status !== 'all') {
      conditions.push(eq(schema.bills.status, status));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await this.db
      .select({ count: count() })
      .from(schema.bills)
      .where(whereCondition);

    const total = Number(countResult[0]?.count ?? 0);

    const data = await this.db
      .select()
      .from(schema.bills)
      .where(whereCondition)
      .orderBy(desc(schema.bills.id))
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

  async findByBillNo(billNo: string): Promise<schema.Bill | null> {
    const results = await this.db
      .select()
      .from(schema.bills)
      .where(eq(schema.bills.billNo, billNo))
      .limit(1);
    return results[0] || null;
  }

  async findBySupplier(supplier: string): Promise<schema.Bill[]> {
    return this.db
      .select()
      .from(schema.bills)
      .where(eq(schema.bills.supplier, supplier))
      .orderBy(desc(schema.bills.billDate));
  }

  async findUnpaid(): Promise<schema.Bill[]> {
    // Find bills where totalPaid < total
    const allBills = await this.db
      .select()
      .from(schema.bills)
      .where(eq(schema.bills.status, 'A'));

    return allBills.filter(bill => {
      const total = parseFloat(bill.total || '0');
      const totalPaid = parseFloat(bill.totalPaid || '0');
      return totalPaid < total;
    });
  }
}
