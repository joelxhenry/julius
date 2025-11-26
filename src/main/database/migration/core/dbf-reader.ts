import DBF from 'node-dbf';
import * as fs from 'fs';
import * as path from 'path';
import { DBFField, DBFHeader, DBFRecord } from '../types/dbf.types';

export class DBFReader {
  private dbfPath: string;

  constructor(dbfPath: string) {
    this.dbfPath = dbfPath;
  }

  /**
   * Read and parse a DBF file
   */
  async readFile(fileName: string): Promise<DBFRecord[]> {
    const filePath = path.join(this.dbfPath, fileName);

    if (!fs.existsSync(filePath)) {
      throw new Error(`DBF file not found: ${filePath}`);
    }

    return new Promise((resolve, reject) => {
      const parser = new DBF(filePath);
      const records: DBFRecord[] = [];

      parser.on('header', (header: any) => {
        console.log(`Reading ${fileName}: ${header.numberOfRecords} records`);
      });

      parser.on('record', (record: any) => {
        records.push(this.cleanRecord(record));
      });

      parser.on('end', () => {
        resolve(records);
      });

      parser.on('error', (error: Error) => {
        reject(error);
      });

      // Start parsing
      parser.parse();
    });
  }

  /**
   * Get file header information
   */
  async getHeader(fileName: string): Promise<DBFHeader> {
    const filePath = path.join(this.dbfPath, fileName);

    if (!fs.existsSync(filePath)) {
      throw new Error(`DBF file not found: ${filePath}`);
    }

    return new Promise((resolve, reject) => {
      const parser = new DBF(filePath);

      parser.on('header', (header: any) => {
        const fields: DBFField[] = header.fields.map((field: any) => ({
          name: field.name,
          type: field.type,
          length: field.length,
          decimals: field.decimalPlaces || 0,
        }));

        resolve({
          fileName,
          version: header.version,
          recordCount: header.numberOfRecords,
          fields,
          lastUpdate: header.dateOfLastUpdate,
        });
      });

      parser.on('error', (error: Error) => {
        reject(error);
      });

      // Start parsing (will emit header event)
      parser.parse();
    });
  }

  /**
   * List all DBF files in the directory
   */
  listDBFFiles(): string[] {
    if (!fs.existsSync(this.dbfPath)) {
      throw new Error(`DBF directory not found: ${this.dbfPath}`);
    }

    return fs
      .readdirSync(this.dbfPath)
      .filter((file) => file.toUpperCase().endsWith('.DBF'))
      .sort();
  }

  /**
   * Clean DBF record (trim strings, handle nulls)
   */
  private cleanRecord(record: any): DBFRecord {
    const cleaned: DBFRecord = {};

    for (const [key, value] of Object.entries(record)) {
      if (value === null || value === undefined) {
        cleaned[key] = null;
      } else if (typeof value === 'string') {
        // Trim whitespace from strings
        cleaned[key] = value.trim();
      } else {
        cleaned[key] = value;
      }
    }

    return cleaned;
  }

  /**
   * Read a sample of records (for analysis)
   */
  async readSample(fileName: string, count: number = 10): Promise<DBFRecord[]> {
    const allRecords = await this.readFile(fileName);
    return allRecords.slice(0, count);
  }
}
