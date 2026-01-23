import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import * as schema from './schema/index';

/**
 * Migrates legacy single-value category and model fields to JSON array format.
 * This seeder is idempotent - it only converts plain text values, not existing JSON arrays.
 *
 * Legacy value: "Toyota"
 * New format: '["Toyota"]'
 */
export async function seedMultiValueFields(db: NodePgDatabase<typeof schema>): Promise<void> {
  console.log('Running multi-value fields migration seeder...');

  try {
    // Find all inventory items with non-null, non-JSON category or model
    // A JSON array starts with '[', so we check for values that don't start with '['
    const items = await db
      .select({
        id: schema.inventory.id,
        category: schema.inventory.category,
        model: schema.inventory.model,
      })
      .from(schema.inventory)
      .where(
        sql`(${schema.inventory.category} IS NOT NULL AND ${schema.inventory.category} != '' AND ${schema.inventory.category} NOT LIKE '[%')
            OR (${schema.inventory.model} IS NOT NULL AND ${schema.inventory.model} != '' AND ${schema.inventory.model} NOT LIKE '[%')`
      );

    if (items.length === 0) {
      console.log('No legacy single-value fields to migrate');
      return;
    }

    console.log(`Found ${items.length} inventory items with legacy single-value fields to migrate`);

    let categoryMigrated = 0;
    let modelMigrated = 0;

    for (const item of items) {
      const updates: { category?: string | null; model?: string | null } = {};

      // Convert category if it's a legacy value (not already JSON)
      if (item.category && !item.category.startsWith('[')) {
        updates.category = JSON.stringify([item.category]);
        categoryMigrated++;
      }

      // Convert model if it's a legacy value (not already JSON)
      if (item.model && !item.model.startsWith('[')) {
        updates.model = JSON.stringify([item.model]);
        modelMigrated++;
      }

      if (Object.keys(updates).length > 0) {
        await db
          .update(schema.inventory)
          .set(updates)
          .where(sql`${schema.inventory.id} = ${item.id}`);
      }
    }

    console.log(`Migration complete: ${categoryMigrated} categories, ${modelMigrated} models converted to JSON arrays`);
  } catch (error) {
    console.error('Multi-value fields migration seeder failed:', error);
    throw error;
  }
}
