import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../database/schema';

export abstract class BaseController<TService> {
  protected service: TService;

  constructor(service: TService) {
    this.service = service;
  }

  async handleError(error: any): Promise<{ success: false; error: string }> {
    console.error('Controller error:', error);
    return {
      success: false,
      error: error.message || 'An error occurred',
    };
  }

  wrapSuccess<T>(data: T): { success: true; data: T } {
    return { success: true, data };
  }
}
