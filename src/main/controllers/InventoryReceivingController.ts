import { BaseController } from './BaseController';
import { InventoryReceivingService, ReceivingQueryParams } from '../services/InventoryReceivingService';
import * as schema from '../database/schema';

export class InventoryReceivingController extends BaseController<InventoryReceivingService> {
  constructor(service: InventoryReceivingService) {
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

  async getById(id: number) {
    try {
      const item = await this.service.findById(id);
      if (!item) {
        return { success: false, error: 'Receiving record not found' };
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

  async getBySkuPaginated(sku: string, params: ReceivingQueryParams = {}) {
    try {
      const result = await this.service.findBySkuPaginated(sku, params);
      return this.wrapSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getBySupplierIdPaginated(supplierId: number, params: ReceivingQueryParams = {}) {
    try {
      const result = await this.service.findBySupplierIdPaginated(supplierId, params);
      return this.wrapSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async create(data: schema.InsertInventoryReceiving) {
    try {
      const item = await this.service.create(data);
      return this.wrapSuccess(item);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async update(id: number, data: Partial<schema.InsertInventoryReceiving>) {
    try {
      const item = await this.service.update(id, data);
      if (!item) {
        return { success: false, error: 'Receiving record not found' };
      }
      return this.wrapSuccess(item);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async delete(id: number) {
    try {
      await this.service.delete(id);
      return this.wrapSuccess({ deleted: true });
    } catch (error) {
      return this.handleError(error);
    }
  }
}
