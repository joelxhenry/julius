/**
 * Helper functions for handling multi-value fields stored as JSON strings
 * Supports backward compatibility with legacy single-value strings
 */

/**
 * Normalize a value to an array
 * Handles: null, undefined, single string, JSON array string, actual array
 */
export function normalizeToArray(value: string | string[] | null | undefined): string[] {
  if (value === null || value === undefined || value === '') {
    return [];
  }

  // Already an array
  if (Array.isArray(value)) {
    return value.filter((v) => v && v.trim());
  }

  // Try parsing as JSON array
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.filter((v) => typeof v === 'string' && v.trim());
        }
      } catch {
        // Not valid JSON, treat as legacy string
      }
    }
    // Legacy single value - return as single-element array
    return trimmed ? [trimmed] : [];
  }

  return [];
}

/**
 * Convert an array to JSON string for storage
 */
export function arrayToJsonString(values: string[]): string | null {
  if (!values || values.length === 0) {
    return null;
  }
  // Filter out empty values and trim
  const cleaned = values.map((v) => v.trim()).filter((v) => v);
  if (cleaned.length === 0) {
    return null;
  }
  return JSON.stringify(cleaned);
}

/**
 * Get display string for array fields (comma-separated)
 */
export function arrayToDisplayString(value: string | string[] | null | undefined): string {
  const arr = normalizeToArray(value);
  return arr.join(', ');
}
