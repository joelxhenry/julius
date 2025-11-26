import { FieldMapping } from '../types/migration.types';

export class Transformer {
  /**
   * Transform a record according to field mappings
   */
  transform(record: any, mappings: FieldMapping[]): any {
    const transformed: any = {};

    for (const mapping of mappings) {
      const sourceValue = record[mapping.source];

      // Apply transformation
      let transformedValue = this.applyTransform(sourceValue, mapping);

      // Store in target field
      transformed[mapping.target] = transformedValue;
    }

    return transformed;
  }

  /**
   * Transform multiple records
   */
  transformBatch(records: any[], mappings: FieldMapping[]): any[] {
    return records.map((record) => this.transform(record, mappings));
  }

  /**
   * Apply transformation to a value
   */
  private applyTransform(value: any, mapping: FieldMapping): any {
    // Handle null/undefined
    if (value === null || value === undefined || value === '') {
      return null;
    }

    // Apply custom transform if provided
    if (mapping.transform) {
      return mapping.transform(value);
    }

    // Default transformations based on type
    switch (mapping.type) {
      case 'integer':
        return this.toInteger(value);
      case 'real':
        return this.toReal(value);
      case 'boolean':
        return this.toBoolean(value);
      case 'date':
        return this.toISODate(value);
      case 'string':
        return this.toString(value);
      default:
        return value;
    }
  }

  /**
   * Type conversion functions
   */
  private toInteger(value: any): number | null {
    if (typeof value === 'number') {
      return Math.floor(value);
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '') return null;
      const num = parseInt(trimmed, 10);
      return isNaN(num) ? null : num;
    }
    return null;
  }

  private toReal(value: any): number | null {
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '') return null;
      const num = parseFloat(trimmed);
      return isNaN(num) ? null : num;
    }
    return null;
  }

  private toBoolean(value: any): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toUpperCase();
      return ['T', 'Y', 'YES', 'TRUE', '1'].includes(normalized);
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    return false;
  }

  private toISODate(value: any): string | null {
    if (!value) return null;

    // If already a Date object
    if (value instanceof Date) {
      return value.toISOString();
    }

    // If string, try to parse
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '') return null;

      // Handle DBF date format (YYYYMMDD)
      if (/^\d{8}$/.test(trimmed)) {
        const year = trimmed.substring(0, 4);
        const month = trimmed.substring(4, 6);
        const day = trimmed.substring(6, 8);
        const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
        return isNaN(date.getTime()) ? null : date.toISOString();
      }

      // Try parsing as ISO or other formats
      const date = new Date(trimmed);
      return isNaN(date.getTime()) ? null : date.toISOString();
    }

    return null;
  }

  private toString(value: any): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'string') {
      return value.trim();
    }
    return String(value);
  }

  /**
   * Specific field transformers
   */

  /**
   * Transform email to lowercase and trimmed
   */
  transformEmail(value: any): string | null {
    if (!value) return null;
    const str = String(value).toLowerCase().trim();
    return str === '' ? null : str;
  }

  /**
   * Transform phone number (remove formatting)
   */
  transformPhone(value: any): string | null {
    if (!value) return null;
    const str = String(value).trim();
    // Keep only digits, +, and common separators
    return str.replace(/[^\d+\-().\s]/g, '').trim();
  }

  /**
   * Transform SKU to uppercase
   */
  transformSKU(value: any): string | null {
    if (!value) return null;
    return String(value).toUpperCase().trim();
  }

  /**
   * Transform money value (ensure 2 decimal places)
   */
  transformMoney(value: any): number | null {
    const num = this.toReal(value);
    if (num === null) return null;
    return Math.round(num * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Transform percentage (0-100 to 0-1)
   */
  transformPercentage(value: any): number | null {
    const num = this.toReal(value);
    if (num === null) return null;
    // If value is > 1, assume it's in percentage form (0-100)
    return num > 1 ? num / 100 : num;
  }

  /**
   * Transform ID field (ensure it's a positive integer or null)
   */
  transformId(value: any): number | null {
    const id = this.toInteger(value);
    if (id === null || id <= 0) return null;
    return id;
  }

  /**
   * Transform description/notes (trim and handle empty)
   */
  transformText(value: any): string | null {
    if (!value) return null;
    const str = String(value).trim();
    return str === '' ? null : str;
  }

  /**
   * Transform status code (uppercase, trim)
   */
  transformStatusCode(value: any): string | null {
    if (!value) return null;
    return String(value).toUpperCase().trim();
  }

  /**
   * Transform quantity (ensure non-negative integer)
   */
  transformQuantity(value: any): number {
    const num = this.toInteger(value);
    if (num === null || num < 0) return 0;
    return num;
  }

  /**
   * Clean whitespace from all string fields in a record
   */
  cleanStringFields(record: any): any {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(record)) {
      if (typeof value === 'string') {
        cleaned[key] = value.trim();
      } else {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }

  /**
   * Remove null/undefined fields from record
   */
  removeNullFields(record: any): any {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(record)) {
      if (value !== null && value !== undefined) {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }
}
