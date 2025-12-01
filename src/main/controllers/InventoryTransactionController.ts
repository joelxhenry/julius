import { BaseController } from './BaseController';
import { InventoryTransactionService, InventoryTransactionQueryParams } from '../services/InventoryTransactionService';
import * as schema from '../database/schema';

export class InventoryTransactionController extends BaseController<InventoryTransactionService> {
  constructor(service: InventoryTransactionService) {
    super(service);
  }

  async getAll() {
    try {
      const items = await this.service.findAll();
      return this.wrapSuccess(items);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getPaginated(params: InventoryTransactionQueryParams = {}) {
    try {
      const result = await this.service.findPaginated(params);
      return this.wrapSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getById(id: number) {
    try {
      const item = await this.service.findById(id);
      if (!item) {
        return { success: false, error: 'Transaction not found' };
      }
      return this.wrapSuccess(item);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getBySku(sku: string) {
    try {
      const items = await this.service.findBySku(sku);
      return this.wrapSuccess(items);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getBySkuPaginated(sku: string, params: InventoryTransactionQueryParams = {}) {
    try {
      const result = await this.service.findBySkuPaginated(sku, params);
      return this.wrapSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByDateRange(startDate: string, endDate: string) {
    try {
      const items = await this.service.findByDateRange(startDate, endDate);
      return this.wrapSuccess(items);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByDateRangePaginated(startDate: string, endDate: string, params: InventoryTransactionQueryParams = {}) {
    try {
      const result = await this.service.findByDateRangePaginated(startDate, endDate, params);
      return this.wrapSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async create(data: schema.InsertInventoryTransaction) {
    try {
      const item = await this.service.create(data);
      return this.wrapSuccess(item);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async recordTransaction(sku: string, activity: string, quantity: number, reference?: string) {
    try {
      const item = await this.service.recordTransaction(sku, activity, quantity, reference);
      return this.wrapSuccess(item);
    } catch (error) {
      return this.handleError(error);
    }
  }
}
