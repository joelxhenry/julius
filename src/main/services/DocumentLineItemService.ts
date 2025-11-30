import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc } from 'drizzle-orm';
import * as schema from '../database/schema';
import { BaseService } from './BaseService';

export type DocumentType = 'INVOICE' | 'QUOTE' | 'CREDIT';

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
}
