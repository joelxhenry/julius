import { dialog } from 'electron';
import * as XLSX from 'xlsx';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { inArray } from 'drizzle-orm';
import * as schema from '../database/schema';
import { ImportParseResult, ParsedImportRow, ImportRowStatus } from '../../shared/types/receiving';

// Accepted header aliases → canonical field. Matching is case/space/underscore
// insensitive so real-world supplier spreadsheets map without manual cleanup.
const HEADER_ALIASES: Record<string, string[]> = {
  sku: ['sku', 'partnumber', 'partno', 'part', 'partnum', 'itemnumber', 'itemno', 'code'],
  description: ['description', 'description1', 'name', 'partname', 'desc', 'item'],
  quantity: ['quantity', 'qty', 'received', 'receivedqty', 'qtyreceived', 'count'],
  unitCost: ['cost', 'unitcost', 'purchasecost', 'costprice', 'buyprice', 'unitprice'],
  newPrice: ['price', 'newprice', 'sellingprice', 'saleprice', 'retail', 'retailprice', 'unitpriceout'],
  newWholesale: ['wholesale', 'wholesaleprice', 'newwholesale', 'trade', 'tradeprice'],
  markup: ['markup', 'margin', 'markuppct', 'marginpct'],
};

const SKU_MAX = 50;
const DESC_MAX = 200;

const normalizeKey = (key: string): string => key.toLowerCase().replace(/[^a-z0-9]/g, '');

const toNumber = (value: unknown): number | null => {
  if (value == null || value === '') return null;
  // Strip currency symbols, thousands separators and stray spaces.
  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

export class ReceivalImportService {
  constructor(private db: NodePgDatabase<typeof schema>) {}

  /**
   * Open a file picker, read the first sheet of a CSV/XLSX, sanitize every row,
   * and tag each as matched / unknown / error against existing inventory.
   * Never writes to the database - the renderer reviews the result first.
   */
  async parseFromDialog(): Promise<ImportParseResult | { cancelled: true }> {
    const result = await dialog.showOpenDialog({
      title: 'Import Receiving File',
      properties: ['openFile'],
      filters: [
        { name: 'Spreadsheets', extensions: ['xlsx', 'xls', 'csv'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || !result.filePaths[0]) return { cancelled: true };
    return this.parseFile(result.filePaths[0]);
  }

  async parseFile(filePath: string): Promise<ImportParseResult> {
    const fileName = filePath.split(/[\\/]/).pop() || filePath;
    const workbook = XLSX.readFile(filePath, { cellDates: false });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { fileName, totalRows: 0, matchedCount: 0, unknownCount: 0, errorCount: 0, rows: [] };
    }

    // Read as arrays so we control header mapping (headers may be messy).
    const aoa: unknown[][] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      blankrows: false,
      defval: '',
    });
    if (aoa.length < 2) {
      return { fileName, totalRows: 0, matchedCount: 0, unknownCount: 0, errorCount: 0, rows: [] };
    }

    const headerRow = aoa[0].map((h) => normalizeKey(String(h ?? '')));
    const colIndex = this.mapColumns(headerRow);

    const rows: ParsedImportRow[] = [];
    for (let i = 1; i < aoa.length; i++) {
      const cells = aoa[i];
      // Skip fully-empty rows.
      if (!cells || cells.every((c) => String(c ?? '').trim() === '')) continue;
      rows.push(this.sanitizeRow(cells, colIndex, headerRow, rows.length + 1));
    }

    // Cross-check known part numbers in a single batch query.
    const candidateSkus = rows.filter((r) => r.status !== 'error' && r.sku).map((r) => r.sku);
    const known = new Set<string>();
    if (candidateSkus.length > 0) {
      const found = await this.db
        .select({ sku: schema.inventory.sku })
        .from(schema.inventory)
        .where(inArray(schema.inventory.sku, candidateSkus));
      found.forEach((f) => known.add(f.sku));
    }

    let matchedCount = 0;
    let unknownCount = 0;
    let errorCount = 0;
    for (const row of rows) {
      if (row.status === 'error') {
        errorCount++;
        continue;
      }
      if (known.has(row.sku)) {
        row.status = 'matched';
        matchedCount++;
      } else {
        row.status = 'unknown';
        unknownCount++;
      }
    }

    return { fileName, totalRows: rows.length, matchedCount, unknownCount, errorCount, rows };
  }

  private mapColumns(headerRow: string[]): Record<string, number> {
    const map: Record<string, number> = {};
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      const idx = headerRow.findIndex((h) => aliases.includes(h));
      if (idx >= 0) map[field] = idx;
    }
    return map;
  }

  private sanitizeRow(
    cells: unknown[],
    colIndex: Record<string, number>,
    headerRow: string[],
    rowNumber: number
  ): ParsedImportRow {
    const cell = (field: string): unknown =>
      colIndex[field] != null ? cells[colIndex[field]] : undefined;

    const errors: string[] = [];

    const rawSku = String(cell('sku') ?? '').trim();
    const sku = rawSku.toUpperCase().slice(0, SKU_MAX);
    if (!sku) errors.push('Missing part number');

    const description = (() => {
      const d = String(cell('description') ?? '').trim();
      return d ? d.slice(0, DESC_MAX) : null;
    })();

    const quantity = toNumber(cell('quantity'));
    if (quantity == null) errors.push('Missing/invalid quantity');
    else if (quantity <= 0) errors.push('Quantity must be greater than 0');
    else if (!Number.isInteger(quantity)) errors.push('Quantity must be a whole number');

    const unitCost = toNumber(cell('unitCost'));
    if (unitCost == null) errors.push('Missing/invalid unit cost');
    else if (unitCost < 0) errors.push('Unit cost cannot be negative');

    const newPrice = toNumber(cell('newPrice'));
    if (newPrice != null && newPrice < 0) errors.push('Price cannot be negative');
    const newWholesale = toNumber(cell('newWholesale'));
    if (newWholesale != null && newWholesale < 0) errors.push('Wholesale cannot be negative');
    const markup = toNumber(cell('markup'));

    const raw: Record<string, string> = {};
    headerRow.forEach((h, idx) => {
      if (h) raw[h] = String(cells[idx] ?? '').trim();
    });

    const status: ImportRowStatus = errors.length > 0 ? 'error' : 'unknown';

    return {
      rowNumber,
      status,
      sku,
      description,
      quantity: quantity ?? 0,
      unitCost: unitCost ?? 0,
      newPrice,
      newWholesale,
      markup,
      errors,
      raw,
    };
  }
}
