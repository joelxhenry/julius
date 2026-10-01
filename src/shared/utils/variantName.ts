/**
 * Builds the display name for a variant: the base product's name always
 * prepends the variant-specific name (e.g. "Brake Pad Set - Red"), mirroring
 * how the variant SKU always carries the parent SKU as its prefix.
 *
 * The base variant (one per inventory item, isBase: true) stores the parent's
 * own name as its variantName, so it's shown as-is rather than doubled up.
 */
export function formatVariantName(
  baseName: string | null | undefined,
  variantName: string | null | undefined,
  isBase?: boolean
): string {
  const base = (baseName ?? '').trim();
  const variant = (variantName ?? '').trim();

  if (isBase || !variant || variant === base) return base || variant;
  if (!base) return variant;
  return `${base} - ${variant}`;
}
