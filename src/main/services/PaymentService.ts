import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import * as schema from '../database/schema';
import { BaseService } from './BaseService';

export class PaymentService extends BaseService<
  typeof schema.payments,
  schema.Payment,
  schema.InsertPayment
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.payments);
  }

  async findByInvoice(invoiceId: number): Promise<schema.Payment[]> {
    return this.db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.invoiceId, invoiceId))
      .orderBy(desc(schema.payments.paidAt));
  }

  async findByLegacyId(legacyId: number): Promise<schema.Payment | null> {
    const results = await this.db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.legacyId, legacyId))
      .limit(1);
    return results[0] || null;
  }

  async findByPaymentMethod(paymentMethodId: number): Promise<schema.Payment[]> {
    return this.db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.paymentMethodId, paymentMethodId))
      .orderBy(desc(schema.payments.paidAt));
  }

  async findByDateRange(startDate: string, endDate: string): Promise<schema.Payment[]> {
    return this.db
      .select()
      .from(schema.payments)
      .where(
        and(
          gte(schema.payments.paidAt, startDate),
          lte(schema.payments.paidAt, endDate)
        )
      )
      .orderBy(desc(schema.payments.paidAt));
  }

  async getTotalByDateRange(startDate: string, endDate: string): Promise<number> {
    const payments = await this.findByDateRange(startDate, endDate);
    return payments.reduce((sum, payment) => sum + payment.amount, 0);
  }
}

export class PaymentMethodService extends BaseService<
  typeof schema.paymentMethods,
  schema.PaymentMethod,
  schema.InsertPaymentMethod
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.paymentMethods);
  }

  async findByName(name: string): Promise<schema.PaymentMethod | null> {
    const results = await this.db
      .select()
      .from(schema.paymentMethods)
      .where(eq(schema.paymentMethods.name, name))
      .limit(1);
    return results[0] || null;
  }

  async findActive(): Promise<schema.PaymentMethod[]> {
    return this.db
      .select()
      .from(schema.paymentMethods)
      .where(eq(schema.paymentMethods.active, true));
  }

  async activate(id: number): Promise<schema.PaymentMethod | null> {
    return this.update(id, { active: true });
  }

  async deactivate(id: number): Promise<schema.PaymentMethod | null> {
    return this.update(id, { active: false });
  }
}
