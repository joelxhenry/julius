import * as fs from 'fs';
import * as path from 'path';
import { MigrationConfig } from '../config';
import { DBFAnalysisResult } from '../types/dbf.types';

export class MappingGenerator {
  /**
   * Generate TypeScript mapping files from analysis results
   */
  generateMappingFiles(results: DBFAnalysisResult[]): void {
    const mappingsDir = path.join(__dirname, '../mappings');

    // Ensure mappings directory exists
    if (!fs.existsSync(mappingsDir)) {
      fs.mkdirSync(mappingsDir, { recursive: true });
    }

    for (const result of results) {
      if (!result.proposedMapping) continue;

      const fileName = `${result.proposedMapping.targetTable}.mapping.ts`;
      const filePath = path.join(mappingsDir, fileName);
      const content = this.generateMappingFileContent(result);

      fs.writeFileSync(filePath, content);
      console.log(`✓ Generated mapping: ${fileName}`);
    }
  }

  /**
   * Generate TypeScript content for a mapping file
   */
  private generateMappingFileContent(result: DBFAnalysisResult): string {
    if (!result.proposedMapping) return '';

    const { targetTable, fields } = result.proposedMapping;

    let content = `import { FieldMapping } from '../types/migration.types';\n\n`;
    content += `/**\n`;
    content += ` * Field mapping for ${result.fileName} → ${targetTable}\n`;
    content += ` * Auto-generated - please review and adjust as needed\n`;
    content += ` */\n`;
    content += `export const ${this.camelCase(targetTable)}Mapping: FieldMapping[] = [\n`;

    for (const field of fields) {
      content += `  {\n`;
      content += `    source: '${field.source}',\n`;
      content += `    target: '${field.target}',\n`;
      content += `    type: '${field.type}',\n`;
      content += `    required: ${field.source.toLowerCase().includes('id') || field.source.toLowerCase().includes('name')}, // TODO: Review\n`;

      // Add transform function if needed
      if (field.type === 'integer') {
        content += `    transform: (val) => val ? parseInt(val) : null,\n`;
      } else if (field.type === 'real') {
        content += `    transform: (val) => val ? parseFloat(val) : 0.0,\n`;
      } else if (field.type === 'boolean') {
        content += `    transform: (val) => val === 'T' || val === 'Y' || val === '1' || val === 1,\n`;
      } else if (field.type === 'date') {
        content += `    transform: (val) => val ? new Date(val).toISOString() : null,\n`;
      } else if (field.target === 'email') {
        content += `    transform: (val) => val ? val.toLowerCase().trim() : null,\n`;
        content += `    validate: (val) => !val || /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(val),\n`;
      } else {
        content += `    transform: (val) => val ? val.trim() : null,\n`;
      }

      content += `  },\n`;
    }

    content += `];\n`;

    return content;
  }

  /**
   * Convert table name to camelCase
   */
  private camelCase(str: string): string {
    return str
      .split('_')
      .map((part, index) => (index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
      .join('');
  }
}
