import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../database/schema';

export abstract class BaseController<TService> {
  protected service: TService;

  constructor(service: TService) {
    this.service = service;
  }

  async handleError(error: any): Promise<{ success: false; error: string }> {
    console.error('Controller error:', error);
    // Drizzle wraps driver failures in a "Failed query: ..." error and puts the
    // real reason (e.g. a dropped/timed-out DB connection) on `.cause`. Surface
    // that underlying cause so the renderer shows why the query failed, not just
    // the SQL text.
    const cause = (error as { cause?: unknown })?.cause;
    const causeMessage =
      cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : undefined;
    const baseMessage = error?.message || 'An error occurred';

    return {
      success: false,
      error: causeMessage ? `${baseMessage} (${causeMessage})` : baseMessage,
    };
  }

  wrapSuccess<T>(data: T): { success: true; data: T } {
    return { success: true, data };
  }
}
