import { BaseController } from './BaseController';
import { InventoryAlternateService } from '../services/InventoryAlternateService';
import * as schema from '../database/schema';

export class InventoryAlternateController extends BaseController<InventoryAlternateService> {
  constructor(service: InventoryAlternateService) {
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
        return { success: false, error: 'Alternate not found' };
      }
      return this.wrapSuccess(item);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByPartNo(partNo: string) {
    try {
      const items = await this.service.findAllAlternates(partNo);
      return this.wrapSuccess(items);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async create(data: schema.InsertInventoryAlternate) {
    try {
      const item = await this.service.create(data);
      return this.wrapSuccess(item);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async createAlternate(partNo: string, alternateNo: string, supplier?: string) {
    try {
      const item = await this.service.createAlternate(partNo, alternateNo, supplier);
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

  async deleteAlternate(partNo: string, alternateNo: string) {
    try {
      const deleted = await this.service.deleteAlternate(partNo, alternateNo);
      return this.wrapSuccess({ deleted });
    } catch (error) {
      return this.handleError(error);
    }
  }
}
