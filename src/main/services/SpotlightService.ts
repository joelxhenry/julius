import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { or, ilike, desc, eq } from 'drizzle-orm';
import * as schema from '../database/schema';

export interface SpotlightResult {
  id: number;
  type: 'invoice' | 'client' | 'inventory' | 'quotation';
  title: string;
  subtitle: string;
  status?: string;
  url: string;
}

export interface SpotlightSearchParams {
  query: string;
  limit?: number;
  types?: ('invoice' | 'client' | 'inventory' | 'quotation')[];
}

export class SpotlightService {
  private db: NodePgDatabase<typeof schema>;

  constructor(db: NodePgDatabase<typeof schema>) {
    this.db = db;
  }

  async search(params: SpotlightSearchParams): Promise<SpotlightResult[]> {
    const { query, limit = 10, types } = params;

    if (!query || query.trim().length < 2) {
      return [];
    }

    const searchTerm = `%${query.trim()}%`;
    const results: SpotlightResult[] = [];
    const defaultTypes: ('invoice' | 'client' | 'inventory' | 'quotation')[] = ['invoice', 'client', 'inventory', 'quotation'];
    const searchTypes = Array.isArray(types) && types.length > 0 ? types : defaultTypes;
    const limitPerType = Math.ceil(limit / searchTypes.length);

    console.log('Spotlight search starting:', { query, searchTerm, searchTypes, limitPerType });

    // Search invoices
    if (searchTypes.includes('invoice')) {
      try {
        const invoices = await this.db
          .select()
          .from(schema.invoices)
          .where(
            or(
              ilike(schema.invoices.invNumber, searchTerm),
              ilike(schema.invoices.clientName, searchTerm),
              ilike(schema.invoices.reference, searchTerm)
            )
          )
          .orderBy(desc(schema.invoices.createdAt))
          .limit(limitPerType);

        for (const inv of invoices) {
          results.push({
            id: inv.id,
            type: 'invoice',
            title: `Invoice #${inv.invNumber}`,
            subtitle: `${inv.clientName || 'No client'} - $${inv.total}`,
            status: inv.status,
            url: `/invoices/${inv.id}`,
          });
        }
      } catch (err) {
        console.error('Spotlight invoice search error:', err);
      }
    }

    // Search clients
    if (searchTypes.includes('client')) {
      try {
        const clients = await this.db
          .select()
          .from(schema.clients)
          .where(
            or(
              ilike(schema.clients.clientName, searchTerm),
              ilike(schema.clients.clNumber, searchTerm),
              ilike(schema.clients.phone, searchTerm),
              ilike(schema.clients.contact, searchTerm)
            )
          )
          .orderBy(desc(schema.clients.createdAt))
          .limit(limitPerType);

        for (const client of clients) {
          results.push({
            id: client.id,
            type: 'client',
            title: client.clientName,
            subtitle: client.phone || client.contact || 'No contact info',
            url: `/clients/${client.id}`,
          });
        }
      } catch (err) {
        console.error('Spotlight client search error:', err);
      }
    }

    // Search inventory
    if (searchTypes.includes('inventory')) {
      try {
        // Search variants (linked to parent inventory)
        const variantsWithParent = await this.db
          .select({
            variant: schema.variants,
            parent: schema.inventory,
          })
          .from(schema.variants)
          .innerJoin(schema.inventory, eq(schema.variants.parentSku, schema.inventory.sku))
          .where(
            or(
              ilike(schema.variants.variantSku, searchTerm),
              ilike(schema.variants.variantName, searchTerm),
              ilike(schema.variants.description, searchTerm)
            )
          )
          .orderBy(desc(schema.variants.createdAt))
          .limit(limitPerType);

        for (const { variant, parent } of variantsWithParent) {
          results.push({
            id: parent.id,
            type: 'inventory',
            title: `${variant.variantSku}`,
            subtitle: variant.variantName || variant.description || `Variant of ${parent.sku}`,
            url: `/inventory/${parent.id}`,
          });
        }
      } catch (err) {
        console.error('Spotlight inventory search error:', err);
      }
    }

    // Search quotations
    if (searchTypes.includes('quotation')) {
      try {
        const quotations = await this.db
          .select()
          .from(schema.quotations)
          .where(
            or(
              ilike(schema.quotations.quoteNum, searchTerm),
              ilike(schema.quotations.clientName, searchTerm),
              ilike(schema.quotations.reference, searchTerm)
            )
          )
          .orderBy(desc(schema.quotations.createdAt))
          .limit(limitPerType);

        for (const quote of quotations) {
          results.push({
            id: quote.id,
            type: 'quotation',
            title: `Quote #${quote.quoteNum}`,
            subtitle: `${quote.clientName || 'No client'} - $${quote.total}`,
            status: undefined,
            url: `/quotations/${quote.id}`,
          });
        }
      } catch (err) {
        console.error('Spotlight quotation search error:', err);
      }
    }

    // Sort by relevance (exact matches first) and limit total results
    results.sort((a, b) => {
      const aExact = a.title.toLowerCase().includes(query.toLowerCase()) ? 0 : 1;
      const bExact = b.title.toLowerCase().includes(query.toLowerCase()) ? 0 : 1;
      return aExact - bExact;
    });


    console.log('Spotlight results:', results);

    return results.slice(0, limit);
  }
}
