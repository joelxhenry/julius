import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, sql } from 'drizzle-orm';
import * as schema from './schema/index';

/**
 * Seeds base variants for all inventory items that don't have one.
 * This seeder is idempotent and can be run multiple times safely.
 *
 * It performs the following operations:
 * 1. Creates base variants for inventory items without any variants
 * 2. Creates base variants for inventory items that have variants but no base variant
 * 3. Updates document line items that reference inventory SKU to reference base variant
 * 4. Updates inventory transactions without variantSku to reference base variant
 * 5. Updates inventory receiving without variantSku to reference base variant
 */
export async function seedBaseVariants(db: NodePgDatabase<typeof schema>): Promise<void> {
  console.log('Running base variants seeder...');

  try {
    // Step 1: Create base variants for inventory items without any variants
    const itemsWithoutVariants = await db
      .select({
        sku: schema.inventory.sku,
        description1: schema.inventory.description1,
        quantity: schema.inventory.quantity,
        cost: schema.inventory.cost,
        costCurrency: schema.inventory.costCurrency,
        price: schema.inventory.price,
        priceCurrency: schema.inventory.priceCurrency,
        wholesalePrice: schema.inventory.wholesalePrice,
      })
      .from(schema.inventory)
      .where(
        sql`NOT EXISTS (SELECT 1 FROM variants v WHERE v.parent_sku = ${schema.inventory.sku})`
      );

    if (itemsWithoutVariants.length > 0) {
      console.log(`Creating base variants for ${itemsWithoutVariants.length} inventory items without variants...`);

      for (const inv of itemsWithoutVariants) {
        await db.insert(schema.variants).values({
          parentSku: inv.sku,
          variantSku: `${inv.sku}`,
          variantName: inv.description1 || 'Base',
          description: inv.description1 || undefined,
          quantity: inv.quantity,
          cost: inv.cost,
          costCurrency: inv.costCurrency,
          price: inv.price,
          priceCurrency: inv.priceCurrency,
          wholesalePrice: inv.wholesalePrice || undefined,
          isActive: true,
          isBase: true,
          attributes: {},
        });
      }
      console.log(`Created ${itemsWithoutVariants.length} base variants`);
    }

    // Step 2: Create base variants for items that have variants but no base
    const itemsWithVariantsNoBase = await db
      .select({
        sku: schema.inventory.sku,
        description1: schema.inventory.description1,
        quantity: schema.inventory.quantity,
        cost: schema.inventory.cost,
        costCurrency: schema.inventory.costCurrency,
        price: schema.inventory.price,
        priceCurrency: schema.inventory.priceCurrency,
        wholesalePrice: schema.inventory.wholesalePrice,
      })
      .from(schema.inventory)
      .where(
        sql`EXISTS (SELECT 1 FROM variants v WHERE v.parent_sku = ${schema.inventory.sku})
            AND NOT EXISTS (SELECT 1 FROM variants v WHERE v.parent_sku = ${schema.inventory.sku} AND v.is_base = true)`
      );

    if (itemsWithVariantsNoBase.length > 0) {
      console.log(`Creating base variants for ${itemsWithVariantsNoBase.length} inventory items with variants but no base...`);

      for (const inv of itemsWithVariantsNoBase) {
        await db.insert(schema.variants).values({
          parentSku: inv.sku,
          variantSku: `${inv.sku}-BASE`,
          variantName: 'Base',
          description: inv.description1 || undefined,
          quantity: inv.quantity,
          cost: inv.cost,
          costCurrency: inv.costCurrency,
          price: inv.price,
          priceCurrency: inv.priceCurrency,
          wholesalePrice: inv.wholesalePrice || undefined,
          isActive: true,
          isBase: true,
          attributes: {},
        });
      }
      console.log(`Created ${itemsWithVariantsNoBase.length} base variants`);
    }

    // Step 3: Update document line items referencing inventory SKU to use base variant
    const lineItemsUpdated = await db.execute(sql`
      UPDATE document_line_items dli
      SET sku = v.variant_sku, is_variant = true
      FROM variants v
      WHERE v.parent_sku = dli.sku AND v.is_base = true
        AND dli.is_variant = false AND dli.sku IS NOT NULL
    `);

    if (lineItemsUpdated.rowCount && lineItemsUpdated.rowCount > 0) {
      console.log(`Updated ${lineItemsUpdated.rowCount} document line items to reference base variants`);
    }

    // Step 4: Update inventory transactions without variantSku
    const transactionsUpdated = await db.execute(sql`
      UPDATE inventory_transactions it
      SET variant_sku = v.variant_sku
      FROM variants v
      WHERE v.parent_sku = it.sku AND v.is_base = true AND it.variant_sku IS NULL
    `);

    if (transactionsUpdated.rowCount && transactionsUpdated.rowCount > 0) {
      console.log(`Updated ${transactionsUpdated.rowCount} inventory transactions to reference base variants`);
    }

    // Step 5: Update inventory receiving without variantSku
    const receivingUpdated = await db.execute(sql`
      UPDATE inventory_receiving ir
      SET variant_sku = v.variant_sku
      FROM variants v
      WHERE v.parent_sku = ir.sku AND v.is_base = true AND ir.variant_sku IS NULL
    `);

    if (receivingUpdated.rowCount && receivingUpdated.rowCount > 0) {
      console.log(`Updated ${receivingUpdated.rowCount} inventory receiving records to reference base variants`);
    }

    console.log('Base variants seeder completed successfully');
  } catch (error) {
    console.error('Base variants seeder failed:', error);
    throw error;
  }
}
