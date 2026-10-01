import { and, or, sql, SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

/**
 * Strips everything but letters/digits and lowercases, so values that only
 * differ by separators or case (e.g. "90919-01210" vs "9091901210") line up.
 */
function normalizeToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

/**
 * Builds a forgiving free-text match condition across the given columns for
 * product/part search (SKU, description, category, model, ...).
 *
 * Each whitespace-separated word of the query must appear, in some column,
 * once separators/case are stripped from both sides - so word order in a
 * multi-word description doesn't matter and formatting differences (dashes,
 * spaces) in a part number don't prevent a match. It still requires every
 * word to be present somewhere, so unrelated results stay out.
 */
export function buildForgivingSearchCondition(
  rawQuery: string,
  columns: AnyPgColumn[]
): SQL | undefined {
  const tokens = rawQuery
    .trim()
    .split(/\s+/)
    .map(normalizeToken)
    .filter(Boolean);

  if (tokens.length === 0) return undefined;

  const tokenConditions = tokens.map((token) => {
    const pattern = `%${token}%`;
    return or(
      ...columns.map(
        (col) => sql`regexp_replace(${col}, '[^a-zA-Z0-9]', '', 'g') ILIKE ${pattern}`
      )
    )!;
  });

  return and(...tokenConditions);
}

/** Same normalization as {@link buildForgivingSearchCondition}, for in-memory (JS) filtering. */
export function forgivingIncludes(value: string, query: string): boolean {
  return normalizeToken(value).includes(normalizeToken(query));
}
