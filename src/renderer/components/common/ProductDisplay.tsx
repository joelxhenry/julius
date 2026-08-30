import { Group, Stack, Text, NumberFormatter } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { normalizeToArray } from '../../../shared/utils/arrayFields';
import { CopyButton } from './CopyButton';

/**
 * Minimal shape needed to render a product. Compatible with `InventoryItem`
 * and the various local `Inventory` interfaces used across the pages.
 */
export interface ProductDisplayData {
  sku: string;
  category?: string | string[] | null;
  model?: string | string[] | null;
  price?: string | number | null;
}

interface ProductDisplayProps {
  product: ProductDisplayData;
  /** Text/badge sizing. Defaults to 'sm' to match table rows. */
  size?: 'xs' | 'sm' | 'md';
  /** Show the copy-to-clipboard button next to the part number. Default true. */
  showCopyButton?: boolean;
  /** Optional warning icon (e.g. low stock) shown after the part number. */
  showWarning?: boolean;
}

/**
 * Reusable product display: always shows the part number, category, model
 * and price together. Use anywhere a product needs to be represented so the
 * fields stay consistent across lists, detail pages and line items.
 */
export function ProductDisplay({
  product,
  size = 'sm',
  showCopyButton = true,
  showWarning = false,
}: ProductDisplayProps) {
  const categories = normalizeToArray(product.category);
  const models = normalizeToArray(product.model);
  const hasPrice = product.price !== null && product.price !== undefined && product.price !== '';

  return (
    <Stack gap={4}>
      <Group gap="xs" wrap="nowrap">
        <Text fw={500} size={size}>
          {product.sku}
        </Text>
        {showCopyButton && <CopyButton value={product.sku} size={size} />}
        {showWarning && (
          <IconAlertTriangle size={14} color="var(--mantine-color-orange-6)" />
        )}
      </Group>

      {(categories.length > 0 || models.length > 0) && (
        <Text size={size === 'md' ? 'sm' : 'xs'} c="dimmed" lineClamp={1}>
          {[...categories, ...models].join(' · ')}
        </Text>
      )}

      <Text size={size === 'md' ? 'sm' : 'xs'} fw={500} c="dimmed">
        {hasPrice ? (
          <NumberFormatter
            value={product.price ?? undefined}
            prefix="$"
            thousandSeparator
            decimalScale={2}
          />
        ) : (
          '-'
        )}
      </Text>
    </Stack>
  );
}
