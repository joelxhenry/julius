import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import * as schema from '../database/schema';
import { BaseService } from './BaseService';

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
