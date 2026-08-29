// Shared types for the Goods Receiving module - used by the import parser
// (main) and the receiving page / import review modal (renderer).

export type ImportRowStatus = 'matched' | 'unknown' | 'error';

/** A single sanitized row produced by parsing a supplier CSV/XLSX file. */
export interface ParsedImportRow {
  /** 1-based source row number (after the header) for user-facing messages. */
  rowNumber: number;
  status: ImportRowStatus;
  /** Sanitized part number (uppercased, trimmed, capped to 50 chars). */
  sku: string;
  description: string | null;
  quantity: number;
  unitCost: number;
  newPrice: number | null;
  newWholesale: number | null;
  markup: number | null;
  /** Present only when status is 'error'. */
  errors: string[];
  /** Echo of the raw cell values, for display/debugging. */
  raw: Record<string, string>;
}

export interface ImportParseResult {
  fileName: string;
  totalRows: number;
  matchedCount: number;
  unknownCount: number;
  errorCount: number;
  rows: ParsedImportRow[];
}

/** Payload sent to POST_GOODS_RECEIVAL. Mirrors the service input. */
export interface ReceivalLinePayload {
  sku?: string | null;
  variantSku?: string | null;
  newPart?: {
    sku: string;
    description1?: string | null;
    category?: string | null;
    model?: string | null;
    location?: string | null;
    unit?: string;
    minLevel?: number;
    isTaxable?: boolean;
  } | null;
  quantity: number;
  unitCost: number;
  costCurrency?: string;
  applyNewPricing?: boolean;
  newPrice?: number | null;
  priceCurrency?: string;
  newWholesale?: number | null;
  margin?: number | null;
}

export interface ReceivalHeaderPayload {
  supplierId: number | null;
  supplier: string | null;
  receivingDate: string;
  reference: string | null;
  notes?: string | null;
}

export interface PostReceivalPayload {
  header: ReceivalHeaderPayload;
  lines: ReceivalLinePayload[];
}
