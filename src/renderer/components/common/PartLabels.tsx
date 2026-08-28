import { Text } from '@mantine/core';
import { normalizeToArray } from '../../../shared/utils/arrayFields';

interface PartLabelsProps {
  category?: string | string[] | null;
  model?: string | string[] | null;
  size?: 'xs' | 'sm';
}

/**
 * Subtle, compact category + model labels for a part, shown under the
 * description on line items so make/category are always visible without the
 * visual weight of badges. Renders nothing when both are empty.
 */
export function PartLabels({ category, model, size = 'xs' }: PartLabelsProps) {
  const parts = [...normalizeToArray(category), ...normalizeToArray(model)];
  if (parts.length === 0) return null;

  return (
    <Text size={size} c="dimmed" lineClamp={1} style={{ fontSize: 11 }}>
      {parts.join(' · ')}
    </Text>
  );
}
