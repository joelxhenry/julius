// DBF-specific types

export interface DBFField {
  name: string;
  type: 'C' | 'N' | 'L' | 'D' | 'M'; // Character, Numeric, Logical, Date, Memo
  length: number;
  decimals: number;
}

export interface DBFHeader {
  fileName: string;
  version: number;
  recordCount: number;
  fields: DBFField[];
  lastUpdate?: Date;
}

export interface DBFRecord {
  [key: string]: string | number | boolean | Date | null;
}

export interface DBFAnalysisResult {
  fileName: string;
  recordCount: number;
  fields: DBFField[];
  sampleRecords: DBFRecord[];
  proposedMapping?: {
    targetTable: string;
    fields: Array<{
      source: string;
      target: string;
      transform: string;
      type: string;
    }>;
  };
}
