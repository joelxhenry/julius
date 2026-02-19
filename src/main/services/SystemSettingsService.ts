import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from '../database/schema';

/**
 * Known system settings keys
 */
export const SystemSettingKeys = {
  TAX_RATE: 'tax_rate',
  COMPANY_NAME: 'company_name',
  COMPANY_ADDRESS: 'company_address',
  COMPANY_PHONE: 'company_phone',
  COMPANY_EMAIL: 'company_email',
  COMPANY_TRN: 'company_trn',
  CURRENCY_CODE: 'currency_code',
  CURRENCY_SYMBOL: 'currency_symbol',
  DEFAULT_CREDIT_TERMS: 'default_credit_terms',
  DEFAULT_CREDIT_LIMIT: 'default_credit_limit',
  INVOICE_PREFIX: 'invoice_prefix',
  QUOTATION_PREFIX: 'quotation_prefix',
  CREDIT_NOTE_PREFIX: 'credit_note_prefix',
  // File storage settings
  FILE_STORAGE_TYPE: 'file_storage_type',
  FILE_STORAGE_PATH: 'file_storage_path',
  // Interface settings
  RECENT_INVOICES_LIMIT: 'recent_invoices_limit',
  RECENT_QUOTATIONS_LIMIT: 'recent_quotations_limit',
  // Printing settings
  PRINT_FORMAT_INVOICE: 'print_format_invoice',
  PRINT_FORMAT_QUOTATION: 'print_format_quotation',
  PRINT_FORMAT_CREDIT_NOTE: 'print_format_credit_note',
  PRINT_FORMAT_PAYMENT_RECEIPT: 'print_format_payment_receipt',
  THERMAL_PAPER_WIDTH: 'thermal_paper_width',
  THERMAL_PRINTER_NAME: 'thermal_printer_name',
} as const;

export type SystemSettingKey = (typeof SystemSettingKeys)[keyof typeof SystemSettingKeys];

/**
 * System settings groups
 */
export const SystemSettingGroups = {
  TAX: 'tax',
  COMPANY: 'company',
  CURRENCY: 'currency',
  DEFAULTS: 'defaults',
  DOCUMENTS: 'documents',
  STORAGE: 'storage',
  INTERFACE: 'interface',
  PRINTING: 'printing',
} as const;

export type SystemSettingGroup = (typeof SystemSettingGroups)[keyof typeof SystemSettingGroups];

/**
 * Service for managing system settings stored in the database
 */
export class SystemSettingsService {
  constructor(private db: NodePgDatabase<typeof schema>) {}

  /**
   * Get all system settings
   */
  async getAll(): Promise<schema.SystemSetting[]> {
    return this.db.select().from(schema.systemSettings);
  }

  /**
   * Get all visible system settings
   */
  async getVisible(): Promise<schema.SystemSetting[]> {
    return this.db
      .select()
      .from(schema.systemSettings)
      .where(eq(schema.systemSettings.visible, true));
  }

  /**
   * Get settings by group
   */
  async getByGroup(group: string): Promise<schema.SystemSetting[]> {
    return this.db
      .select()
      .from(schema.systemSettings)
      .where(eq(schema.systemSettings.group, group));
  }

  /**
   * Get a single setting by key
   */
  async getByKey(key: string): Promise<schema.SystemSetting | null> {
    const results = await this.db
      .select()
      .from(schema.systemSettings)
      .where(eq(schema.systemSettings.key, key))
      .limit(1);
    return results[0] || null;
  }

  /**
   * Get the value of a setting by key
   */
  async getValue(key: string): Promise<string | null> {
    const setting = await this.getByKey(key);
    return setting?.value ?? null;
  }

  /**
   * Get the tax rate as a number
   */
  async getTaxRate(): Promise<number> {
    const value = await this.getValue(SystemSettingKeys.TAX_RATE);
    if (value === null) {
      return 0.15; // Default 15% GCT
    }
    const rate = parseFloat(value);
    return isNaN(rate) ? 0.15 : rate;
  }

  /**
   * Set a setting value
   */
  async setValue(key: string, value: string): Promise<schema.SystemSetting | null> {
    // Check if setting exists
    const existing = await this.getByKey(key);

    if (existing) {
      // Check if readonly
      if (existing.readonly) {
        throw new Error(`Setting "${key}" is read-only and cannot be modified`);
      }

      // Update existing
      const results = await this.db
        .update(schema.systemSettings)
        .set({ value })
        .where(eq(schema.systemSettings.key, key))
        .returning();
      return results[0] || null;
    }

    return null; // Setting doesn't exist
  }

  /**
   * Create a new setting
   */
  async create(data: schema.InsertSystemSetting): Promise<schema.SystemSetting> {
    const results = await this.db
      .insert(schema.systemSettings)
      .values(data)
      .returning();
    return results[0];
  }

  /**
   * Create or update a setting (upsert)
   */
  async upsert(
    key: string,
    value: string,
    group: string,
    description?: string,
    readonly = false,
    visible = true
  ): Promise<schema.SystemSetting> {
    const existing = await this.getByKey(key);

    if (existing) {
      if (existing.readonly) {
        throw new Error(`Setting "${key}" is read-only and cannot be modified`);
      }
      const results = await this.db
        .update(schema.systemSettings)
        .set({ value, description, visible })
        .where(eq(schema.systemSettings.key, key))
        .returning();
      return results[0];
    }

    return this.create({ key, value, group, description, readonly, visible });
  }

  /**
   * Delete a setting by key
   */
  async deleteByKey(key: string): Promise<boolean> {
    const existing = await this.getByKey(key);
    if (existing?.readonly) {
      throw new Error(`Setting "${key}" is read-only and cannot be deleted`);
    }

    await this.db
      .delete(schema.systemSettings)
      .where(eq(schema.systemSettings.key, key));
    return true;
  }

  /**
   * Initialize default settings if they don't exist
   */
  async initializeDefaults(): Promise<void> {
    const defaults: Array<{
      key: string;
      value: string;
      group: string;
      description: string;
      readonly: boolean;
      visible: boolean;
    }> = [
      {
        key: SystemSettingKeys.TAX_RATE,
        value: '0.15',
        group: SystemSettingGroups.TAX,
        description: 'GCT tax rate (decimal, e.g., 0.15 for 15%)',
        readonly: false,
        visible: true,
      },
      {
        key: SystemSettingKeys.CURRENCY_CODE,
        value: 'JMD',
        group: SystemSettingGroups.CURRENCY,
        description: 'Currency code (ISO 4217)',
        readonly: false,
        visible: true,
      },
      {
        key: SystemSettingKeys.CURRENCY_SYMBOL,
        value: '$',
        group: SystemSettingGroups.CURRENCY,
        description: 'Currency symbol',
        readonly: false,
        visible: true,
      },
      {
        key: SystemSettingKeys.DEFAULT_CREDIT_TERMS,
        value: 'NET30',
        group: SystemSettingGroups.DEFAULTS,
        description: 'Default credit terms for new clients',
        readonly: false,
        visible: true,
      },
      {
        key: SystemSettingKeys.DEFAULT_CREDIT_LIMIT,
        value: '50000',
        group: SystemSettingGroups.DEFAULTS,
        description: 'Default credit limit for new clients',
        readonly: false,
        visible: true,
      },
      {
        key: SystemSettingKeys.INVOICE_PREFIX,
        value: 'INV',
        group: SystemSettingGroups.DOCUMENTS,
        description: 'Prefix for invoice numbers',
        readonly: false,
        visible: true,
      },
      {
        key: SystemSettingKeys.QUOTATION_PREFIX,
        value: 'QUO',
        group: SystemSettingGroups.DOCUMENTS,
        description: 'Prefix for quotation numbers',
        readonly: false,
        visible: true,
      },
      {
        key: SystemSettingKeys.CREDIT_NOTE_PREFIX,
        value: 'CN',
        group: SystemSettingGroups.DOCUMENTS,
        description: 'Prefix for credit note numbers',
        readonly: false,
        visible: true,
      },
      // File storage settings
      {
        key: SystemSettingKeys.FILE_STORAGE_TYPE,
        value: 'local',
        group: SystemSettingGroups.STORAGE,
        description: 'File storage type: local or lan',
        readonly: false,
        visible: true,
      },
      {
        key: SystemSettingKeys.FILE_STORAGE_PATH,
        value: '',
        group: SystemSettingGroups.STORAGE,
        description: 'Network path for LAN storage (e.g., \\\\SERVER\\share)',
        readonly: false,
        visible: true,
      },
      // Interface settings
      {
        key: SystemSettingKeys.RECENT_INVOICES_LIMIT,
        value: '8',
        group: SystemSettingGroups.INTERFACE,
        description: 'Maximum number of recent invoices to display on the new invoice page',
        readonly: false,
        visible: true,
      },
      {
        key: SystemSettingKeys.RECENT_QUOTATIONS_LIMIT,
        value: '3',
        group: SystemSettingGroups.INTERFACE,
        description: 'Maximum number of recent quotations to display on the new quotation page',
        readonly: false,
        visible: true,
      },
      // Printing settings
      {
        key: SystemSettingKeys.PRINT_FORMAT_INVOICE,
        value: 'standard',
        group: SystemSettingGroups.PRINTING,
        description: 'Print format for invoices (standard or thermal)',
        readonly: false,
        visible: true,
      },
      {
        key: SystemSettingKeys.PRINT_FORMAT_QUOTATION,
        value: 'standard',
        group: SystemSettingGroups.PRINTING,
        description: 'Print format for quotations (standard or thermal)',
        readonly: false,
        visible: true,
      },
      {
        key: SystemSettingKeys.PRINT_FORMAT_CREDIT_NOTE,
        value: 'standard',
        group: SystemSettingGroups.PRINTING,
        description: 'Print format for credit notes (standard or thermal)',
        readonly: false,
        visible: true,
      },
      {
        key: SystemSettingKeys.PRINT_FORMAT_PAYMENT_RECEIPT,
        value: 'standard',
        group: SystemSettingGroups.PRINTING,
        description: 'Print format for payment receipts (standard or thermal)',
        readonly: false,
        visible: true,
      },
      {
        key: SystemSettingKeys.THERMAL_PAPER_WIDTH,
        value: '80mm',
        group: SystemSettingGroups.PRINTING,
        description: 'Thermal paper width (80mm or 58mm)',
        readonly: false,
        visible: true,
      },
      {
        key: SystemSettingKeys.THERMAL_PRINTER_NAME,
        value: '',
        group: SystemSettingGroups.PRINTING,
        description: 'Default thermal printer name (empty for system dialog)',
        readonly: false,
        visible: true,
      },
    ];

    for (const setting of defaults) {
      const existing = await this.getByKey(setting.key);
      if (!existing) {
        await this.create(setting);
      }
    }
  }
}
