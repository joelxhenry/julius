import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import * as schema from '../database/schema';
import { BaseService } from './BaseService';

export class CreditNoteService extends BaseService<
  typeof schema.creditNotes,
  schema.CreditNote,
  schema.InsertCreditNote
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.creditNotes);
  }

  async findByClient(clientId: number): Promise<schema.CreditNote[]> {
    return this.db
      .select()
      .from(schema.creditNotes)
      .where(eq(schema.creditNotes.clientId, clientId))
      .orderBy(desc(schema.creditNotes.createdAt));
  }

  async findByInvoice(invoiceId: number): Promise<schema.CreditNote[]> {
    return this.db
      .select()
      .from(schema.creditNotes)
      .where(eq(schema.creditNotes.invoiceId, invoiceId))
      .orderBy(desc(schema.creditNotes.createdAt));
  }

  async findByDateRange(startDate: string, endDate: string): Promise<schema.CreditNote[]> {
    return this.db
      .select()
      .from(schema.creditNotes)
      .where(
        and(
          gte(schema.creditNotes.createdAt, startDate),
          lte(schema.creditNotes.createdAt, endDate)
        )
      )
      .orderBy(desc(schema.creditNotes.createdAt));
  }

  async findUnallocated(): Promise<schema.CreditNote[]> {
    return this.db
      .select()
      .from(schema.creditNotes)
      .where(eq(schema.creditNotes.status, 'unallocated'))
      .orderBy(desc(schema.creditNotes.createdAt));
  }

  async markAllocated(id: number): Promise<schema.CreditNote | null> {
    return this.update(id, { status: 'allocated' });
  }
}

export class CreditNoteAllocationService extends BaseService<
  typeof schema.creditNoteAllocations,
  schema.CreditNoteAllocation,
  schema.InsertCreditNoteAllocation
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.creditNoteAllocations);
  }

  async findByCreditNote(creditNoteId: number): Promise<schema.CreditNoteAllocation[]> {
    return this.db
      .select()
      .from(schema.creditNoteAllocations)
      .where(eq(schema.creditNoteAllocations.creditNoteId, creditNoteId));
  }

  async findByInvoice(invoiceId: number): Promise<schema.CreditNoteAllocation[]> {
    return this.db
      .select()
      .from(schema.creditNoteAllocations)
      .where(eq(schema.creditNoteAllocations.invoiceId, invoiceId));
  }

  async getTotalAllocated(creditNoteId: number): Promise<number> {
    const allocations = await this.findByCreditNote(creditNoteId);
    return allocations.reduce((sum, allocation) => sum + allocation.amountApplied, 0);
  }
}
