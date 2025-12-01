import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc, gte, lte, sql, count, sum } from 'drizzle-orm';
import * as schema from '../database/schema';
import { BaseService } from './BaseService';
import { PaginatedResult } from './types';

export type DocumentType = 'INVOICE' | 'QUOTE' | 'CREDIT';

export interface DocumentLineItemQueryParams {
  page?: number;
  pageSize?: number;
  sku?: string;
  documentType?: DocumentType;
  startDate?: string;
  endDate?: string;
}

export interface SalesSummary {
  totalUnitsSold: number;
  totalRevenue: number;
  averagePrice: number;
  transactionCount: number;
}

export class DocumentLineItemService extends BaseService<
  typeof schema.documentLineItems,
  schema.DocumentLineItem,
  schema.InsertDocumentLineItem
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.documentLineItems);
  }

  async findByDocument(documentType: DocumentType, documentNumber: string): Promise<schema.DocumentLineItem[]> {
    return this.db
      .select()
      .from(schema.documentLineItems)
      .where(
        and(
          eq(schema.documentLineItems.documentType, documentType),
          eq(schema.documentLineItems.documentNumber, documentNumber)
        )
      )
      .orderBy(schema.documentLineItems.lineNumber);
  }

  async findByInvoice(invoiceNumber: string): Promise<schema.DocumentLineItem[]> {
    return this.findByDocument('INVOICE', invoiceNumber);
  }

  async findByQuotation(quoteNumber: string): Promise<schema.DocumentLineItem[]> {
    return this.findByDocument('QUOTE', quoteNumber);
  }

  async findByCreditNote(creditNoteNumber: string): Promise<schema.DocumentLineItem[]> {
    return this.findByDocument('CREDIT', creditNoteNumber);
  }

  async createBulk(items: schema.InsertDocumentLineItem[]): Promise<schema.DocumentLineItem[]> {
    if (items.length === 0) return [];
    return this.db
      .insert(schema.documentLineItems)
      .values(items)
      .returning();
  }

  async deleteByDocument(documentType: DocumentType, documentNumber: string): Promise<boolean> {
    await this.db
      .delete(schema.documentLineItems)
      .where(
        and(
          eq(schema.documentLineItems.documentType, documentType),
          eq(schema.documentLineItems.documentNumber, documentNumber)
        )
      );
    return true;
  }

  async getNextLineNumber(documentType: DocumentType, documentNumber: string): Promise<number> {
    const items = await this.findByDocument(documentType, documentNumber);
    if (items.length === 0) return 1;
    return Math.max(...items.map(i => i.lineNumber)) + 1;
  }

  /**
   * Get sales history for a specific SKU (from invoices only)
   */
  async getVariantSales(
    sku: string,
    params: DocumentLineItemQueryParams = {}
  ): Promise<PaginatedResult<schema.DocumentLineItem & { invoice?: schema.Invoice }>> {
    const { page = 1, pageSize = 50, startDate, endDate } = params;
    const offset = (page - 1) * pageSize;

    const conditions = [
      eq(schema.documentLineItems.sku, sku),
      eq(schema.documentLineItems.documentType, 'INVOICE'),
    ];

    // For date filtering, we need to join with invoices
    let query = this.db
      .select({
        lineItem: schema.documentLineItems,
        invoice: schema.invoices,
      })
      .from(schema.documentLineItems)
      .leftJoin(
        schema.invoices,
        eq(schema.documentLineItems.documentNumber, schema.invoices.invNumber)
      )
      .where(and(...conditions));

    // Apply date filters on invoice date if provided
    if (startDate || endDate) {
      const dateConditions = [...conditions];
      if (startDate) {
        dateConditions.push(gte(schema.invoices.invDate, startDate));
      }
      if (endDate) {
        dateConditions.push(lte(schema.invoices.invDate, endDate));
      }
      query = this.db
        .select({
          lineItem: schema.documentLineItems,
          invoice: schema.invoices,
        })
        .from(schema.documentLineItems)
        .leftJoin(
          schema.invoices,
          eq(schema.documentLineItems.documentNumber, schema.invoices.invNumber)
        )
        .where(and(...dateConditions));
    }

    // Get total count
    const countResult = await this.db
      .select({ count: count() })
      .from(schema.documentLineItems)
      .where(and(...conditions));

    const total = Number(countResult[0]?.count ?? 0);

    // Get paginated data
    const results = await query
      .orderBy(desc(schema.invoices.invDate), desc(schema.documentLineItems.id))
      .limit(pageSize)
      .offset(offset);

    // Transform results
    const data = results.map((r) => ({
      ...r.lineItem,
      invoice: r.invoice || undefined,
    }));

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Get sales summary for a specific SKU
   */
  async getInventorySalesSummary(
    sku: string,
    params: { startDate?: string; endDate?: string } = {}
  ): Promise<SalesSummary> {
    const { startDate, endDate } = params;

    const conditions = [
      eq(schema.documentLineItems.sku, sku),
      eq(schema.documentLineItems.documentType, 'INVOICE'),
    ];

    let whereClause = and(...conditions);

    // If date filters, join with invoices
    if (startDate || endDate) {
      const dateConditions = [...conditions];
      if (startDate) {
        dateConditions.push(gte(schema.invoices.invDate, startDate));
      }
      if (endDate) {
        dateConditions.push(lte(schema.invoices.invDate, endDate));
      }

      const results = await this.db
        .select({
          totalUnits: sql<string>`COALESCE(SUM(CAST(${schema.documentLineItems.quantity} AS numeric)), 0)`,
          totalRevenue: sql<string>`COALESCE(SUM(CAST(${schema.documentLineItems.amount} AS numeric)), 0)`,
          transactionCount: count(),
        })
        .from(schema.documentLineItems)
        .leftJoin(
          schema.invoices,
          eq(schema.documentLineItems.documentNumber, schema.invoices.invNumber)
        )
        .where(and(...dateConditions));

      const result = results[0];
      const totalUnits = Number(result?.totalUnits ?? 0);
      const totalRevenue = Number(result?.totalRevenue ?? 0);
      const transactionCount = Number(result?.transactionCount ?? 0);

      return {
        totalUnitsSold: totalUnits,
        totalRevenue,
        averagePrice: transactionCount > 0 ? totalRevenue / totalUnits : 0,
        transactionCount,
      };
    }

    // Without date filters
    const results = await this.db
      .select({
        totalUnits: sql<string>`COALESCE(SUM(CAST(${schema.documentLineItems.quantity} AS numeric)), 0)`,
        totalRevenue: sql<string>`COALESCE(SUM(CAST(${schema.documentLineItems.amount} AS numeric)), 0)`,
        transactionCount: count(),
      })
      .from(schema.documentLineItems)
      .where(whereClause);

    const result = results[0];
    const totalUnits = Number(result?.totalUnits ?? 0);
    const totalRevenue = Number(result?.totalRevenue ?? 0);
    const transactionCount = Number(result?.transactionCount ?? 0);

    return {
      totalUnitsSold: totalUnits,
      totalRevenue,
      averagePrice: transactionCount > 0 ? totalRevenue / totalUnits : 0,
      transactionCount,
    };
  }
}
