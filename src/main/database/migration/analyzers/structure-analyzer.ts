import * as fs from 'fs';
import * as path from 'path';
import { DBFReader } from '../core/dbf-reader';
import { MigrationConfig } from '../config';
import { DBFAnalysisResult } from '../types/dbf.types';

export class StructureAnalyzer {
  private dbfReader: DBFReader;

  constructor() {
    this.dbfReader = new DBFReader(MigrationConfig.dbfPath);
  }

  /**
   * Analyze all DBF files in the directory
   */
  async analyzeAll(): Promise<DBFAnalysisResult[]> {
    console.log('Analyzing DBF files...\n');

    const dbfFiles = this.dbfReader.listDBFFiles();
    const results: DBFAnalysisResult[] = [];

    for (const fileName of dbfFiles) {
      try {
        const result = await this.analyzeFile(fileName);
        results.push(result);
        console.log(`✓ ${fileName}: ${result.recordCount} records, ${result.fields.length} fields`);
      } catch (error) {
        console.error(`✗ ${fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return results;
  }

  /**
   * Analyze a single DBF file
   */
  async analyzeFile(fileName: string): Promise<DBFAnalysisResult> {
    const header = await this.dbfReader.getHeader(fileName);
    const sampleRecords = await this.dbfReader.readSample(fileName, 5);

    return {
      fileName,
      recordCount: header.recordCount,
      fields: header.fields,
      sampleRecords,
      proposedMapping: this.proposeMapping(fileName, header.fields),
    };
  }

  /**
   * Generate analysis reports
   */
  async generateReports(results: DBFAnalysisResult[]): Promise<void> {
    // Ensure analysis directory exists
    if (!fs.existsSync(MigrationConfig.analysisPath)) {
      fs.mkdirSync(MigrationConfig.analysisPath, { recursive: true });
    }

    // Generate JSON report
    const jsonPath = path.join(MigrationConfig.analysisPath, 'dbf-structure-report.json');
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
    console.log(`\n✓ JSON report saved: ${jsonPath}`);

    // Generate Markdown report
    const mdPath = path.join(MigrationConfig.analysisPath, 'dbf-structure-report.md');
    const mdContent = this.generateMarkdownReport(results);
    fs.writeFileSync(mdPath, mdContent);
    console.log(`✓ Markdown report saved: ${mdPath}`);

    // Generate proposed mappings JSON
    const mappingsPath = path.join(MigrationConfig.analysisPath, 'proposed-mappings.json');
    const mappings = results
      .filter((r) => r.proposedMapping)
      .map((r) => ({
        dbfFile: r.fileName,
        ...r.proposedMapping,
      }));
    fs.writeFileSync(mappingsPath, JSON.stringify(mappings, null, 2));
    console.log(`✓ Proposed mappings saved: ${mappingsPath}\n`);
  }

  /**
   * Generate Markdown report
   */
  private generateMarkdownReport(results: DBFAnalysisResult[]): string {
    let md = '# DBF Structure Analysis Report\n\n';
    md += `**Generated:** ${new Date().toISOString()}\n\n`;
    md += `**Total Files:** ${results.length}\n\n`;
    md += `**Total Records:** ${results.reduce((sum, r) => sum + r.recordCount, 0)}\n\n`;
    md += '---\n\n';

    for (const result of results) {
      md += `## ${result.fileName}\n\n`;
      md += `**Record Count:** ${result.recordCount}\n\n`;
      md += `**Fields:** ${result.fields.length}\n\n`;

      // Fields table
      md += '| Field Name | Type | Length | Decimals |\n';
      md += '|------------|------|--------|----------|\n';
      for (const field of result.fields) {
        md += `| ${field.name} | ${field.type} | ${field.length} | ${field.decimals} |\n`;
      }
      md += '\n';

      // Sample records
      if (result.sampleRecords.length > 0) {
        md += '**Sample Records (first 3):**\n\n';
        md += '```json\n';
        md += JSON.stringify(result.sampleRecords.slice(0, 3), null, 2);
        md += '\n```\n\n';
      }

      // Proposed mapping
      if (result.proposedMapping) {
        md += `**Proposed Target Table:** \`${result.proposedMapping.targetTable}\`\n\n`;
        md += '**Field Mappings:**\n\n';
        md += '| Source Field | Target Field | Transform | Type |\n';
        md += '|--------------|--------------|-----------|------|\n';
        for (const field of result.proposedMapping.fields) {
          md += `| ${field.source} | ${field.target} | ${field.transform} | ${field.type} |\n`;
        }
        md += '\n';
      }

      md += '---\n\n';
    }

    return md;
  }

  /**
   * Propose field mapping based on file name and field names
   */
  private proposeMapping(fileName: string, fields: any[]) {
    const baseName = fileName.replace('.DBF', '').toLowerCase();

    // Map common DBF files to target tables
    const tableMap: Record<string, string> = {
      client: 'clients',
      empname: 'employees',
      emppass: 'employees',
      inventry: 'parts',
      invoice: 'invoices',
      invdetai: 'invoice_items',
      quote: 'quotations',
      qtedetai: 'quotation_items',
      crnote: 'credit_notes',
      crndetai: 'credit_note_allocations',
      inv_stor: 'locations',
    };

    const targetTable = tableMap[baseName] || baseName;

    // Propose field mappings based on common patterns
    const fieldMappings = fields.map((field) => {
      const fieldName = field.name.toLowerCase();
      let targetField = fieldName;
      let transform = 'trim()';
      let type = 'string';

      // Common ID fields
      if (fieldName.endsWith('_id') || fieldName === 'id') {
        type = 'integer';
        transform = 'parseInt()';
      }

      // Common name patterns
      if (fieldName.includes('name')) {
        targetField = this.camelCase(fieldName);
        transform = 'trim()';
      }

      // Numeric fields
      if (field.type === 'N') {
        type = field.decimals > 0 ? 'real' : 'integer';
        transform = field.decimals > 0 ? 'parseFloat()' : 'parseInt()';
      }

      // Boolean fields
      if (field.type === 'L') {
        type = 'boolean';
        transform = 'parseBoolean()';
      }

      // Date fields
      if (field.type === 'D' || fieldName.includes('date') || fieldName.includes('_at')) {
        type = 'date';
        transform = 'parseDate() → ISO 8601';
        targetField = this.camelCase(fieldName);
      }

      // Email fields
      if (fieldName.includes('email')) {
        transform = 'toLowerCase(), trim()';
        targetField = 'email';
      }

      return {
        source: field.name,
        target: this.camelCase(targetField),
        transform,
        type,
      };
    });

    return {
      targetTable,
      fields: fieldMappings,
    };
  }

  /**
   * Convert snake_case to camelCase
   */
  private camelCase(str: string): string {
    return str
      .toLowerCase()
      .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }
}
