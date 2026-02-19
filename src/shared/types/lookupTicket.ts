export type LookupTicketSource = 'inventory' | 'invoice' | 'quotation';

export interface LookupTicketItem {
  sku: string;
  description: string;
  location: string;
  quantity: number;
}

export interface LookupTicketRequest {
  source: LookupTicketSource;
  outputMode: 'print' | 'preview';
  inventoryItem?: {
    sku: string;
    description1: string | null;
    description2: string | null;
    location: string | null;
    quantity: number;
  };
  invoiceId?: number;
  quotationId?: number;
  sourceReference?: string;
}

export interface LookupTicketData {
  companyName: string;
  printedAt: string;
  sourceReference: string;
  items: LookupTicketItem[];
}
