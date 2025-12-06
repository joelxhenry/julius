import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gte, lte, desc, count, or, ilike } from 'drizzle-orm';
import * as schema from '../database/schema';
import { BaseService } from './BaseService';
import { PaginatedResult } from './types';

export type PaymentDocumentType = 'INVOICE' | 'CREDIT' | 'BILL';

export interface PaymentQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  documentType?: PaymentDocumentType;
  clientId?: number;
}

export class PaymentService extends BaseService<
  typeof schema.payments,
  schema.Payment,
  schema.InsertPayment
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.payments);
  }

  async findPaginated(params: PaymentQueryParams = {}): Promise<PaginatedResult<schema.Payment>> {
    const { page = 1, pageSize = 50, search, documentType, clientId } = params;
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(schema.payments.documentNumber, searchTerm),
          ilike(schema.payments.payerName, searchTerm),
          ilike(schema.payments.paymentDesc, searchTerm)
        )
      );
    }

    if (documentType) {
      conditions.push(eq(schema.payments.documentType, documentType));
    }

    // If clientId is provided, we need to join with invoices to filter by client
    if (clientId) {
      // Build where conditions for join query
      const joinConditions = [eq(schema.invoices.clientId, clientId)];
      if (conditions.length > 0) {
        joinConditions.push(and(...conditions)!);
      }

      const finalWhereCondition = joinConditions.length > 1 ? and(...joinConditions) : joinConditions[0];

      // Count with join
      const countResult = await this.db
        .select({ count: count() })
        .from(schema.payments)
        .leftJoin(schema.invoices, eq(schema.payments.invoiceNumber, schema.invoices.invNumber))
        .where(finalWhereCondition);

      const total = Number(countResult[0]?.count ?? 0);

      // Data with join - select all payment fields
      const data = await this.db
        .select()
        .from(schema.payments)
        .leftJoin(schema.invoices, eq(schema.payments.invoiceNumber, schema.invoices.invNumber))
        .where(finalWhereCondition)
        .orderBy(desc(schema.payments.paymentDate))
        .limit(pageSize)
        .offset(offset);

      // Extract just the payment data from the join result
      const paymentData = data.map((row) => row.payments);

      return {
        data: paymentData,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }

    // Regular query without clientId filter
    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await this.db
      .select({ count: count() })
      .from(schema.payments)
      .where(whereCondition);

    const total = Number(countResult[0]?.count ?? 0);

    const data = await this.db
      .select()
      .from(schema.payments)
      .where(whereCondition)
      .orderBy(desc(schema.payments.paymentDate))
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

  async findByDocumentType(documentType: PaymentDocumentType): Promise<schema.Payment[]> {
    return this.db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.documentType, documentType))
      .orderBy(desc(schema.payments.paymentDate));
  }

  async findByInvoice(invoiceNumber: string): Promise<schema.Payment[]> {
    return this.db
      .select()
      .from(schema.payments)
      .where(
        and(
          eq(schema.payments.documentType, 'INVOICE'),
          eq(schema.payments.invoiceNumber, invoiceNumber)
        )
      )
      .orderBy(desc(schema.payments.paymentDate));
  }

  async findByCreditNote(creditNoteNumber: string): Promise<schema.Payment[]> {
    return this.db
      .select()
      .from(schema.payments)
      .where(
        and(
          eq(schema.payments.documentType, 'CREDIT'),
          eq(schema.payments.creditNoteNumber, creditNoteNumber)
        )
      )
      .orderBy(desc(schema.payments.paymentDate));
  }

  async findByBill(billNumber: string): Promise<schema.Payment[]> {
    return this.db
      .select()
      .from(schema.payments)
      .where(
        and(
          eq(schema.payments.documentType, 'BILL'),
          eq(schema.payments.billNumber, billNumber)
        )
      )
      .orderBy(desc(schema.payments.paymentDate));
  }

  async findByDateRange(startDate: string, endDate: string): Promise<schema.Payment[]> {
    return this.db
      .select()
      .from(schema.payments)
      .where(
        and(
          gte(schema.payments.paymentDate, startDate),
          lte(schema.payments.paymentDate, endDate)
        )
      )
      .orderBy(desc(schema.payments.paymentDate));
  }

  async getTotalByDateRange(startDate: string, endDate: string): Promise<number> {
    const payments = await this.findByDateRange(startDate, endDate);
    return payments.reduce((sum, payment) => {
      return sum + parseFloat(payment.amount || '0');
    }, 0);
  }

  async createInvoicePayment(
    invoiceNumber: string,
    amount: string,
    payerName?: string,
    paymentDesc?: string
  ): Promise<schema.Payment> {
    return this.create({
      documentType: 'INVOICE',
      documentNumber: invoiceNumber,
      invoiceNumber,
      amount,
      payerName,
      paymentDesc,
      paymentDate: new Date().toISOString().split('T')[0],
    });
  }

  async createBillPayment(
    billNumber: string,
    amount: string,
    payerName?: string,
    paymentDesc?: string
  ): Promise<schema.Payment> {
    return this.create({
      documentType: 'BILL',
      documentNumber: billNumber,
      billNumber,
      amount,
      payerName,
      paymentDesc,
      paymentDate: new Date().toISOString().split('T')[0],
    });
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

  async findByCode(code: string): Promise<schema.PaymentMethod | null> {
    const results = await this.db
      .select()
      .from(schema.paymentMethods)
      .where(eq(schema.paymentMethods.code, code))
      .limit(1);
    return results[0] || null;
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
