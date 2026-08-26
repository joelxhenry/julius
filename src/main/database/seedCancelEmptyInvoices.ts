import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, ne, notExists, inArray, sql } from 'drizzle-orm';
import * as schema from './schema/index';

/**
 * Backfill: any invoice that has no INVOICE line items is a cancelled invoice.
 *
 * An invoice is "cancelled" precisely when it carries no line items (payments, if
 * any, are settled separately via returns/credit notes). This seed brings existing
 * data in line with that rule by marking every non-cancelled invoice that currently
 * has zero line items as 'cancelled'.
 *
 * Idempotent: invoices already marked 'cancelled' are skipped, so re-running is a
 * no-op once the data is consistent.
 */
export async function seedCancelEmptyInvoices(db: NodePgDatabase<typeof schema>): Promise<void> {
  // Invoices with no matching INVOICE line items and not already cancelled.
  const emptyInvoices = await db
    .select({ id: schema.invoices.id, invNumber: schema.invoices.invNumber })
    .from(schema.invoices)
    .where(
      and(
        ne(schema.invoices.status, 'cancelled'),
        notExists(
          db
            .select({ one: sql`1` })
            .from(schema.documentLineItems)
            .where(
              and(
                eq(schema.documentLineItems.documentType, 'INVOICE'),
                eq(schema.documentLineItems.documentNumber, schema.invoices.invNumber)
              )
            )
        )
      )
    );

  if (emptyInvoices.length === 0) {
    console.log('seedCancelEmptyInvoices: no invoices without line items found, nothing to cancel');
    return;
  }

  await db
    .update(schema.invoices)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(
      inArray(
        schema.invoices.id,
        emptyInvoices.map((inv) => inv.id)
      )
    );

  console.log(
    `seedCancelEmptyInvoices: cancelled ${emptyInvoices.length} invoice(s) with no line items ` +
      `(${emptyInvoices.map((inv) => inv.invNumber).join(', ')})`
  );
}
