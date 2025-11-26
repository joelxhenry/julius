import { ValidationResult, FieldMapping } from '../types/migration.types';

export class Validator {
  /**
   * Validate a record against field mappings
   */
  validate(record: any, mappings: FieldMapping[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const mapping of mappings) {
      const value = record[mapping.source];

      // Required field validation
      if (mapping.required && this.isEmpty(value)) {
        errors.push(`Required field '${mapping.source}' is missing or empty`);
        continue;
      }

      // Skip validation for empty optional fields
      if (this.isEmpty(value)) {
        continue;
      }

      // Type validation - skip if field has transform function and is not required
      // The transform will handle type conversion
      if (mapping.required || !mapping.transform) {
        const typeError = this.validateType(value, mapping.type, mapping.source);
        if (typeError) {
          errors.push(typeError);
        }
      }

      // Custom validation
      if (mapping.validate) {
        const isValid = mapping.validate(value);
        if (!isValid) {
          errors.push(`Validation failed for field '${mapping.source}' with value: ${value}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate multiple records
   */
  validateBatch(records: any[], mappings: FieldMapping[]): ValidationResult[] {
    return records.map((record) => this.validate(record, mappings));
  }

  /**
   * Check if value is empty
   */
  private isEmpty(value: any): boolean {
    return value === null || value === undefined || value === '';
  }

  /**
   * Validate value against expected type
   */
  private validateType(value: any, expectedType: string, fieldName: string): string | null {
    switch (expectedType) {
      case 'integer':
        if (!this.isInteger(value)) {
          return `Field '${fieldName}' expects integer, got: ${value}`;
        }
        break;

      case 'real':
        if (!this.isNumeric(value)) {
          return `Field '${fieldName}' expects numeric value, got: ${value}`;
        }
        break;

      case 'boolean':
        if (!this.isBoolean(value)) {
          return `Field '${fieldName}' expects boolean value, got: ${value}`;
        }
        break;

      case 'date':
        if (!this.isDate(value)) {
          return `Field '${fieldName}' expects date value, got: ${value}`;
        }
        break;

      case 'string':
        if (typeof value !== 'string') {
          return `Field '${fieldName}' expects string, got: ${typeof value}`;
        }
        break;
    }

    return null;
  }

  /**
   * Type checking helpers
   */
  private isInteger(value: any): boolean {
    if (typeof value === 'number') {
      return Number.isInteger(value);
    }
    if (typeof value === 'string') {
      const num = Number(value);
      return !isNaN(num) && Number.isInteger(num);
    }
    return false;
  }

  private isNumeric(value: any): boolean {
    if (typeof value === 'number') {
      return !isNaN(value);
    }
    if (typeof value === 'string') {
      const num = Number(value);
      return !isNaN(num);
    }
    return false;
  }

  private isBoolean(value: any): boolean {
    if (typeof value === 'boolean') {
      return true;
    }
    if (typeof value === 'string') {
      const normalized = value.toUpperCase();
      return ['T', 'F', 'Y', 'N', 'TRUE', 'FALSE', 'YES', 'NO', '1', '0'].includes(normalized);
    }
    if (typeof value === 'number') {
      return value === 0 || value === 1;
    }
    return false;
  }

  private isDate(value: any): boolean {
    if (value instanceof Date) {
      return !isNaN(value.getTime());
    }
    if (typeof value === 'string') {
      // Check for YYYYMMDD format (DBF date format)
      if (/^\d{8}$/.test(value)) {
        return true;
      }
      // Check for ISO 8601 format
      const date = new Date(value);
      return !isNaN(date.getTime());
    }
    return false;
  }

  /**
   * Validate email format
   */
  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone format (basic validation)
   */
  validatePhone(phone: string): boolean {
    // Remove common separators
    const cleaned = phone.replace(/[\s\-().]/g, '');
    // Check if it's a reasonable phone number length (7-15 digits)
    return /^\d{7,15}$/.test(cleaned);
  }

  /**
   * Validate SKU format
   */
  validateSKU(sku: string): boolean {
    // Allow alphanumeric with hyphens/underscores, 3-50 characters
    return /^[A-Z0-9_-]{3,50}$/i.test(sku);
  }

  /**
   * Validate positive number
   */
  validatePositive(value: number): boolean {
    return typeof value === 'number' && value >= 0;
  }

  /**
   * Validate non-negative number
   */
  validateNonNegative(value: number): boolean {
    return typeof value === 'number' && value >= 0;
  }
}
