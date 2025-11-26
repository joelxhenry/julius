import * as DBF from 'node-dbf';
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
      const dbf = new DBF(filePath);

      dbf.on('start', (reader: any) => {
        console.log(`Reading ${fileName}: ${reader.recordCount} records`);
      });

      const records: DBFRecord[] = [];

      dbf.on('record', (record: any) => {
        records.push(this.cleanRecord(record));
      });

      dbf.on('end', () => {
        resolve(records);
      });

      dbf.on('error', (error: Error) => {
        reject(error);
      });
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
      const dbf = new DBF(filePath);

      dbf.on('start', (reader: any) => {
        const fields: DBFField[] = reader.fields.map((field: any) => ({
          name: field.name,
          type: field.type,
          length: field.length,
          decimals: field.decimals || 0,
        }));

        resolve({
          fileName,
          version: reader.version,
          recordCount: reader.recordCount,
          fields,
          lastUpdate: reader.lastUpdate,
        });
      });

      dbf.on('error', (error: Error) => {
        reject(error);
      });
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
