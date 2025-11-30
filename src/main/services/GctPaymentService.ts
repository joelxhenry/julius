import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc } from 'drizzle-orm';
import * as schema from '../database/schema';
import { BaseService } from './BaseService';

export class GctPaymentService extends BaseService<
  typeof schema.gctPayments,
  schema.GctPayment,
  schema.InsertGctPayment
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.gctPayments);
  }

  async findByPeriod(month: number, year: number): Promise<schema.GctPayment | null> {
    const results = await this.db
      .select()
      .from(schema.gctPayments)
      .where(
        and(
          eq(schema.gctPayments.month, month),
          eq(schema.gctPayments.year, year)
        )
      )
      .limit(1);
    return results[0] || null;
  }

  async findByYear(year: number): Promise<schema.GctPayment[]> {
    return this.db
      .select()
      .from(schema.gctPayments)
      .where(eq(schema.gctPayments.year, year))
      .orderBy(schema.gctPayments.month);
  }

  async findRecent(limit = 12): Promise<schema.GctPayment[]> {
    return this.db
      .select()
      .from(schema.gctPayments)
      .orderBy(desc(schema.gctPayments.year), desc(schema.gctPayments.month))
      .limit(limit);
  }

  async upsert(data: schema.InsertGctPayment): Promise<schema.GctPayment> {
    const existing = await this.findByPeriod(data.month!, data.year!);
    if (existing) {
      const updated = await this.update(existing.id, data);
      return updated!;
    }
    return this.create(data);
  }
}
