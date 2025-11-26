#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { StructureAnalyzer } from './analyzers/structure-analyzer';
import { MappingGenerator } from './analyzers/mapping-generator';
import { MigrationOrchestrator } from './index';

const program = new Command();

program
  .name('dbf-migration')
  .description('DBF to SQLite migration tool for Auto Parts Shop Management System')
  .version('1.0.0');

/**
 * Analyze DBF files command
 */
program
  .command('analyze')
  .description('Analyze DBF file structures and generate reports')
  .option('-g, --generate-mappings', 'Generate TypeScript mapping files', false)
  .action(async (options) => {
    console.log(chalk.bold.cyan('\n📊 DBF Structure Analysis\n'));

    const spinner = ora('Analyzing DBF files...').start();

    try {
      const analyzer = new StructureAnalyzer();

      // Analyze all DBF files
      const results = await analyzer.analyzeAll();

      spinner.succeed(`Analyzed ${results.length} DBF files`);

      // Generate reports
      spinner.start('Generating reports...');
      await analyzer.generateReports(results);
      spinner.succeed('Reports generated');

      // Generate mapping files if requested
      if (options.generateMappings) {
        spinner.start('Generating mapping files...');
        const generator = new MappingGenerator();
        generator.generateMappingFiles(results);
        spinner.succeed('Mapping files generated');
      }

      console.log(chalk.green('\n✓ Analysis complete!\n'));

      // Print summary
      console.log(chalk.bold('Summary:'));
      console.log(`  Files analyzed: ${results.length}`);
      console.log(
        `  Total records: ${results.reduce((sum, r) => sum + r.recordCount, 0)}`
      );
      console.log();
    } catch (error) {
      spinner.fail('Analysis failed');
      console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : 'Unknown error'}\n`));
      process.exit(1);
    }
  });

/**
 * Migrate command
 */
program
  .command('migrate')
  .description('Migrate DBF data to SQLite database')
  .option('-d, --dry-run', 'Run migration without committing to database', false)
  .option('-s, --strict', 'Enable strict mode (fail on validation errors)', false)
  .option('-b, --backup', 'Create database backup before migration', true)
  .option('-m, --migrator <name>', 'Run specific migrator only')
  .action(async (options) => {
    console.log(chalk.bold.cyan('\n🚀 DBF Migration\n'));

    if (options.dryRun) {
      console.log(chalk.yellow('  Running in DRY RUN mode - no data will be committed\n'));
    }

    const spinner = ora('Initializing migration...').start();

    try {
      const orchestrator = new MigrationOrchestrator({
        dryRun: options.dryRun,
        strict: options.strict,
        backup: options.backup,
        migrator: options.migrator,
      });

      spinner.stop();

      // Run migration
      const results = await orchestrator.run();

      // Print summary
      console.log(chalk.bold.green('\n✓ Migration complete!\n'));

      // Overall stats
      const totalRecords = results.reduce((sum, r) => sum + r.totalRecords, 0);
      const totalSuccess = results.reduce((sum, r) => sum + r.successCount, 0);
      const totalErrors = results.reduce((sum, r) => sum + r.errorCount, 0);
      const totalWarnings = results.reduce((sum, r) => sum + r.warningCount, 0);

      console.log(chalk.bold('Overall Statistics:'));
      console.log(`  Total Records:    ${totalRecords}`);
      console.log(chalk.green(`  Successful:       ${totalSuccess}`));
      console.log(chalk.red(`  Failed:           ${totalErrors}`));
      console.log(chalk.yellow(`  Warnings:         ${totalWarnings}`));
      console.log();

      // Table breakdown
      console.log(chalk.bold('Table Breakdown:'));
      for (const result of results) {
        const successRate =
          result.totalRecords > 0
            ? ((result.successCount / result.totalRecords) * 100).toFixed(1)
            : '0.0';
        console.log(
          `  ${result.tableName.padEnd(20)} ${result.successCount.toString().padStart(5)}/${result.totalRecords.toString().padEnd(5)} (${successRate}%)`
        );
      }
      console.log();

      if (options.dryRun) {
        console.log(
          chalk.yellow(
            '⚠️  This was a DRY RUN. No data was committed to the database.\n'
          )
        );
        console.log(
          chalk.cyan('To commit the migration, run without the --dry-run flag.\n')
        );
      }

      process.exit(0);
    } catch (error) {
      spinner.fail('Migration failed');
      console.error(
        chalk.red(`\nError: ${error instanceof Error ? error.message : 'Unknown error'}\n`)
      );
      process.exit(1);
    }
  });

/**
 * Status command
 */
program
  .command('status')
  .description('Check migration status and database state')
  .action(async () => {
    console.log(chalk.bold.cyan('\n📈 Migration Status\n'));

    const spinner = ora('Checking status...').start();

    try {
      // TODO: Implement status checking
      // - Check if database exists
      // - Check if tables are populated
      // - Show record counts per table
      // - Show last migration info

      spinner.succeed('Status check complete');

      console.log(chalk.yellow('\n⚠️  Status command not yet implemented\n'));
    } catch (error) {
      spinner.fail('Status check failed');
      console.error(
        chalk.red(`\nError: ${error instanceof Error ? error.message : 'Unknown error'}\n`)
      );
      process.exit(1);
    }
  });

/**
 * Rollback command
 */
program
  .command('rollback')
  .description('Rollback migration and restore from backup')
  .action(async () => {
    console.log(chalk.bold.cyan('\n↩️  Migration Rollback\n'));

    const spinner = ora('Rolling back...').start();

    try {
      // TODO: Implement rollback
      // - Restore from backup
      // - Clear migrated tables

      spinner.succeed('Rollback complete');

      console.log(chalk.yellow('\n⚠️  Rollback command not yet implemented\n'));
    } catch (error) {
      spinner.fail('Rollback failed');
      console.error(
        chalk.red(`\nError: ${error instanceof Error ? error.message : 'Unknown error'}\n`)
      );
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
