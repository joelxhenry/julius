import { db } from '../../index';
import { clients } from '../../schema/clients';
import { employees } from '../../schema/employees';
import { parts, partVariants } from '../../schema/parts';
import { invoices } from '../../schema/invoices';
import { eq } from 'drizzle-orm';

/**
 * Foreign Key Lookup Cache
 *
 * Handles resolution of text-based foreign keys in DBF files to integer IDs in SQLite.
 * Uses in-memory caching to avoid repeated database queries.
 */
export class ForeignKeyLookup {
  private clientsByName: Map<string, number> = new Map();
  private employeesByCode: Map<string, number> = new Map();
  private employeesByName: Map<string, number> = new Map();
  private partsBySku: Map<string, number> = new Map();
  private partVariantsBySku: Map<string, number> = new Map();
  private invoicesByNumber: Map<string, number> = new Map();
  private quotationsByNumber: Map<string, number> = new Map();
  private creditNotesByNumber: Map<string, number> = new Map();
  private isDryRun: boolean = false;
  private nextMockId: number = 1;

  /**
   * Set dry-run mode
   */
  setDryRun(isDryRun: boolean): void {
    this.isDryRun = isDryRun;
  }

  /**
   * Load all clients into cache
   */
  async loadClients(): Promise<void> {
    if (this.isDryRun) {
      console.log('✓ Skipping client FK lookup (dry-run mode)');
      return;
    }
    
    console.log('Loading clients for FK lookup...');
    const allClients = await db.select().from(clients);

    for (const client of allClients) {
      this.clientsByName.set(client.name.toUpperCase(), client.id);
    }

    console.log(`✓ Loaded ${allClients.length} clients`);
  }

  /**
   * Load all employees into cache
   */
  async loadEmployees(): Promise<void> {
    if (this.isDryRun) {
      console.log('✓ Skipping employee FK lookup (dry-run mode)');
      return;
    }
    
    console.log('Loading employees for FK lookup...');
    const allEmployees = await db.select().from(employees);

    for (const employee of allEmployees) {
      // Map by username (CODE field in DBF)
      if (employee.username) {
        this.employeesByCode.set(employee.username.toUpperCase(), employee.id);
      }
      // Map by full name (FIRST + LAST in DBF)
      const fullName = `${employee.firstName} ${employee.lastName}`.toUpperCase();
      this.employeesByName.set(fullName, employee.id);
    }

    console.log(`✓ Loaded ${allEmployees.length} employees`);
  }

  /**
   * Load all parts (by SKU) into cache
   */
  async loadParts(): Promise<void> {
    if (this.isDryRun) {
      console.log('✓ Skipping parts FK lookup (dry-run mode)');
      return;
    }
    
    console.log('Loading parts for FK lookup...');
    const allParts = await db.select().from(parts);

    for (const part of allParts) {
      if (part.sku) {
        this.partsBySku.set(part.sku.toUpperCase(), part.id);
      }
    }

    console.log(`✓ Loaded ${allParts.length} parts`);
  }

  /**
   * Load all part variants (by SKU) into cache
   */
  async loadPartVariants(): Promise<void> {
    if (this.isDryRun) {
      console.log('✓ Skipping part variants FK lookup (dry-run mode)');
      return;
    }
    
    console.log('Loading part variants for FK lookup...');
    const allVariants = await db
      .select({
        id: partVariants.id,
        partId: partVariants.partId,
        sku: parts.sku,
      })
      .from(partVariants)
      .innerJoin(parts, eq(partVariants.partId, parts.id));

    for (const variant of allVariants) {
      if (variant.sku) {
        this.partVariantsBySku.set(variant.sku.toUpperCase(), variant.id);
      }
    }

    console.log(`✓ Loaded ${allVariants.length} part variants`);
  }

  /**
   * Load all invoices into cache (for credit notes)
   */
  async loadInvoices(): Promise<void> {
    console.log('Loading invoices for FK lookup...');
    const allInvoices = await db.select().from(invoices);

    // Need to store original DBF invoice numbers somewhere
    // For now, we'll use a different approach - see addInvoiceMapping below

    console.log(`✓ Loaded ${allInvoices.length} invoices`);
  }

  /**
   * Lookup client ID by name
   */
  getClientId(clientName: string | null): number | null {
    if (!clientName) return null;
    const normalized = clientName.trim().toUpperCase();
    
    // In dry-run mode, return mock ID
    if (this.isDryRun) {
      if (!this.clientsByName.has(normalized)) {
        this.clientsByName.set(normalized, this.nextMockId++);
      }
      return this.clientsByName.get(normalized) || null;
    }
    
    return this.clientsByName.get(normalized) || null;
  }

  /**
   * Lookup employee ID by code (username)
   */
  getEmployeeIdByCode(employeeCode: string | null): number | null {
    if (!employeeCode) return null;
    const normalized = employeeCode.trim().toUpperCase();
    
    // In dry-run mode, return mock ID
    if (this.isDryRun) {
      if (!this.employeesByCode.has(normalized)) {
        this.employeesByCode.set(normalized, this.nextMockId++);
      }
      return this.employeesByCode.get(normalized) || null;
    }
    
    return this.employeesByCode.get(normalized) || null;
  }

  /**
   * Lookup employee ID by name
   */
  getEmployeeIdByName(firstName: string | null, lastName: string | null): number | null {
    if (!firstName || !lastName) return null;
    const fullName = `${firstName} ${lastName}`.trim().toUpperCase();
    return this.employeesByName.get(fullName) || null;
  }

  /**
   * Lookup part ID by SKU
   */
  getPartId(sku: string | null): number | null {
    if (!sku) return null;
    const normalized = sku.trim().toUpperCase();
    
    // In dry-run mode, return mock ID
    if (this.isDryRun) {
      if (!this.partsBySku.has(normalized)) {
        this.partsBySku.set(normalized, this.nextMockId++);
      }
      return this.partsBySku.get(normalized) || null;
    }
    
    return this.partsBySku.get(normalized) || null;
  }

  /**
   * Lookup part variant ID by SKU
   */
  getPartVariantId(sku: string | null): number | null {
    if (!sku) return null;
    const normalized = sku.trim().toUpperCase();
    return this.partVariantsBySku.get(normalized) || null;
  }


  /**
   * Add invoice mapping (DBF number → SQLite ID)
   * Called during invoice migration to build the lookup cache
   */
  addInvoiceMapping(dbfInvoiceNumber: string, sqliteId: number): void {
    this.invoicesByNumber.set(dbfInvoiceNumber.toUpperCase(), sqliteId);
  }

  /**
   * Lookup invoice ID by DBF invoice number
   */
  getInvoiceId(dbfInvoiceNumber: string | null): number | null {
    if (!dbfInvoiceNumber) return null;
    return this.invoicesByNumber.get(dbfInvoiceNumber.toUpperCase()) || null;
  }

  /**
   * Add quotation mapping (DBF number → SQLite ID)
   */
  addQuotationMapping(dbfQuoteNumber: string, sqliteId: number): void {
    this.quotationsByNumber.set(dbfQuoteNumber.toUpperCase(), sqliteId);
  }

  /**
   * Lookup quotation ID by DBF quote number
   */
  getQuotationId(dbfQuoteNumber: string | null): number | null {
    if (!dbfQuoteNumber) return null;
    return this.quotationsByNumber.get(dbfQuoteNumber.toUpperCase()) || null;
  }

  /**
   * Add credit note mapping (DBF number → SQLite ID)
   */
  addCreditNoteMapping(dbfCreditNoteNumber: string, sqliteId: number): void {
    this.creditNotesByNumber.set(dbfCreditNoteNumber.toUpperCase(), sqliteId);
  }

  /**
   * Lookup credit note ID by DBF credit note number
   */
  getCreditNoteId(dbfCreditNoteNumber: string | null): number | null {
    if (!dbfCreditNoteNumber) return null;
    return this.creditNotesByNumber.get(dbfCreditNoteNumber.toUpperCase()) || null;
  }

  /**
   * Clear all caches
   */
  clear(): void {
    this.clientsByName.clear();
    this.employeesByCode.clear();
    this.employeesByName.clear();
    this.partsBySku.clear();
    this.partVariantsBySku.clear();
    this.invoicesByNumber.clear();
    this.quotationsByNumber.clear();
    this.creditNotesByNumber.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    clients: number;
    employees: number;
    parts: number;
    partVariants: number;
    invoices: number;
    quotations: number;
    creditNotes: number;
  } {
    return {
      clients: this.clientsByName.size,
      employees: this.employeesByCode.size,
      parts: this.partsBySku.size,
      partVariants: this.partVariantsBySku.size,
      invoices: this.invoicesByNumber.size,
      quotations: this.quotationsByNumber.size,
      creditNotes: this.creditNotesByNumber.size,
    };
  }
}
