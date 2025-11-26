import cliProgress from 'cli-progress';
import chalk from 'chalk';

export interface ProgressOptions {
  total: number;
  label: string;
}

export class ProgressTracker {
  private multibar: cliProgress.MultiBar;
  private bars: Map<string, cliProgress.SingleBar>;
  private startTime: number;
  private isEnabled: boolean;

  constructor(enabled: boolean = true) {
    this.isEnabled = enabled;
    this.bars = new Map();
    this.startTime = Date.now();

    if (this.isEnabled) {
      this.multibar = new cliProgress.MultiBar(
        {
          clearOnComplete: false,
          hideCursor: true,
          format: '{label} | {bar} | {percentage}% | {value}/{total} | ETA: {eta_formatted}',
          barCompleteChar: '\u2588',
          barIncompleteChar: '\u2591',
        },
        cliProgress.Presets.shades_classic
      );
    }
  }

  /**
   * Create a new progress bar
   */
  createBar(id: string, options: ProgressOptions): void {
    if (!this.isEnabled) return;

    const bar = this.multibar.create(options.total, 0, {
      label: this.formatLabel(options.label),
    });

    this.bars.set(id, bar);
  }

  /**
   * Update progress bar
   */
  update(id: string, value: number, payload?: any): void {
    if (!this.isEnabled) return;

    const bar = this.bars.get(id);
    if (bar) {
      bar.update(value, payload);
    }
  }

  /**
   * Increment progress bar
   */
  increment(id: string, delta: number = 1, payload?: any): void {
    if (!this.isEnabled) return;

    const bar = this.bars.get(id);
    if (bar) {
      bar.increment(delta, payload);
    }
  }

  /**
   * Complete a progress bar
   */
  complete(id: string): void {
    if (!this.isEnabled) return;

    const bar = this.bars.get(id);
    if (bar) {
      bar.stop();
    }
  }

  /**
   * Stop all progress bars
   */
  stop(): void {
    if (!this.isEnabled) return;

    this.multibar.stop();
  }

  /**
   * Get elapsed time
   */
  getElapsedTime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Format elapsed time as string
   */
  getElapsedTimeFormatted(): string {
    const elapsed = this.getElapsedTime();
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Format label with color
   */
  private formatLabel(label: string): string {
    return chalk.cyan(label.padEnd(20));
  }

  /**
   * Log message without disrupting progress bars
   */
  log(message: string): void {
    if (this.isEnabled) {
      this.multibar.log(message + '\n');
    } else {
      console.log(message);
    }
  }

  /**
   * Log success message
   */
  logSuccess(message: string): void {
    this.log(chalk.green('✓ ' + message));
  }

  /**
   * Log error message
   */
  logError(message: string): void {
    this.log(chalk.red('✗ ' + message));
  }

  /**
   * Log warning message
   */
  logWarning(message: string): void {
    this.log(chalk.yellow('⚠ ' + message));
  }

  /**
   * Log info message
   */
  logInfo(message: string): void {
    this.log(chalk.blue('ℹ ' + message));
  }

  /**
   * Print summary statistics
   */
  printSummary(stats: {
    totalFiles: number;
    totalRecords: number;
    successRecords: number;
    errorRecords: number;
    warningCount: number;
    skippedRecords: number;
  }): void {
    const elapsed = this.getElapsedTimeFormatted();

    console.log('\n' + chalk.bold('═'.repeat(60)));
    console.log(chalk.bold.cyan('  Migration Summary'));
    console.log(chalk.bold('═'.repeat(60)));
    console.log();
    console.log(chalk.white('  Files Processed:    ') + chalk.bold(stats.totalFiles));
    console.log(chalk.white('  Total Records:      ') + chalk.bold(stats.totalRecords));
    console.log(chalk.green('  Successful:         ') + chalk.bold(stats.successRecords));
    console.log(chalk.red('  Failed:             ') + chalk.bold(stats.errorRecords));
    console.log(chalk.yellow('  Warnings:           ') + chalk.bold(stats.warningCount));
    console.log(chalk.gray('  Skipped:            ') + chalk.bold(stats.skippedRecords));
    console.log();
    console.log(chalk.white('  Elapsed Time:       ') + chalk.bold(elapsed));
    console.log(chalk.bold('═'.repeat(60)));
    console.log();
  }

  /**
   * Print file summary
   */
  printFileSummary(
    fileName: string,
    stats: {
      total: number;
      success: number;
      errors: number;
      warnings: number;
    }
  ): void {
    const successRate = stats.total > 0 ? ((stats.success / stats.total) * 100).toFixed(1) : '0.0';

    console.log();
    console.log(chalk.bold(`  ${fileName}`));
    console.log(chalk.gray('  ─'.repeat(40)));
    console.log(
      chalk.white('    Total: ') +
        chalk.bold(stats.total) +
        chalk.white(' | Success: ') +
        chalk.green.bold(stats.success) +
        chalk.white(' | Errors: ') +
        chalk.red.bold(stats.errors) +
        chalk.white(' | Warnings: ') +
        chalk.yellow.bold(stats.warnings)
    );
    console.log(chalk.white('    Success Rate: ') + chalk.bold(`${successRate}%`));
    console.log();
  }

  /**
   * Print migration phase header
   */
  printPhaseHeader(phase: string, description: string): void {
    console.log();
    console.log(chalk.bold.magenta('━'.repeat(60)));
    console.log(chalk.bold.magenta(`  ${phase}`));
    console.log(chalk.gray(`  ${description}`));
    console.log(chalk.bold.magenta('━'.repeat(60)));
    console.log();
  }

  /**
   * Print step info
   */
  printStep(step: number, total: number, message: string): void {
    console.log(chalk.cyan(`[${step}/${total}]`) + ' ' + message);
  }
}
