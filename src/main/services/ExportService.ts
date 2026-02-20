import { dialog } from 'electron';
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { ExportRequest, ExportResult } from '../../shared/types/export';

export class ExportService {
  async exportReport(request: ExportRequest): Promise<ExportResult> {
    const { fileName, format, columns, rows, sheetName } = request;

    // Build worksheet data as array-of-arrays (header row + data rows)
    const header = columns.map((c) => c.header);
    const dataRows = rows.map((row) =>
      columns.map((col) => {
        const val = row[col.key];
        if (col.format === 'currency' || col.format === 'number') {
          return typeof val === 'number' ? val : Number(val) || 0;
        }
        return val ?? '';
      }),
    );

    const aoa = [header, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Auto column widths based on header length
    ws['!cols'] = columns.map((col) => ({
      wch: Math.min(Math.max(col.header.length + 2, 12), 30),
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Report');

    // Determine file extension and dialog filter
    const ext = format === 'xlsx' ? 'xlsx' : 'csv';
    const filterName = format === 'xlsx' ? 'Excel Workbook' : 'CSV File';

    const saveResult = await dialog.showSaveDialog({
      title: `Export as ${filterName}`,
      defaultPath: `${fileName}.${ext}`,
      filters: [{ name: filterName, extensions: [ext] }],
    });

    if (saveResult.canceled || !saveResult.filePath) {
      return { cancelled: true };
    }

    const bookType: XLSX.BookType = format === 'xlsx' ? 'xlsx' : 'csv';
    const buffer = XLSX.write(wb, { type: 'buffer', bookType });
    fs.writeFileSync(saveResult.filePath, buffer);

    return { filePath: saveResult.filePath };
  }
}
