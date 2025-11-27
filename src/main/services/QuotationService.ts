import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import * as schema from '../database/schema';
import { BaseService } from './BaseService';

export class QuotationService extends BaseService<
  typeof schema.quotations,
  schema.Quotation,
  schema.InsertQuotation
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.quotations);
  }

  async findByClient(clientId: number): Promise<schema.Quotation[]> {
    return this.db
      .select()
      .from(schema.quotations)
      .where(eq(schema.quotations.clientId, clientId))
      .orderBy(desc(schema.quotations.createdAt));
  }

  async findByEmployee(employeeId: number): Promise<schema.Quotation[]> {
    return this.db
      .select()
      .from(schema.quotations)
      .where(eq(schema.quotations.employeeId, employeeId))
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
          gte(schema.quotations.createdAt, startDate),
          lte(schema.quotations.createdAt, endDate)
        )
      )
      .orderBy(desc(schema.quotations.createdAt));
  }

  async convertToInvoice(id: number): Promise<schema.Quotation | null> {
    return this.update(id, { status: 'converted' });
  }

  async expire(id: number): Promise<schema.Quotation | null> {
    return this.update(id, { status: 'expired' });
  }
}

export class QuotationItemService extends BaseService<
  typeof schema.quotationItems,
  schema.QuotationItem,
  schema.InsertQuotationItem
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.quotationItems);
  }

  async findByQuotation(quotationId: number): Promise<schema.QuotationItem[]> {
    return this.db
      .select()
      .from(schema.quotationItems)
      .where(eq(schema.quotationItems.quotationId, quotationId));
  }

  async bulkCreate(items: schema.InsertQuotationItem[]): Promise<schema.QuotationItem[]> {
    return this.db
      .insert(schema.quotationItems)
      .values(items)
      .returning();
  }

  async deleteByQuotation(quotationId: number): Promise<boolean> {
    await this.db
      .delete(schema.quotationItems)
      .where(eq(schema.quotationItems.quotationId, quotationId));
    return true;
  }
}
