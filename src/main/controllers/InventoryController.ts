import { BaseController } from './BaseController';
import { InventoryService, InventoryQueryParams } from '../services/InventoryService';
import * as schema from '../database/schema';

export class InventoryController extends BaseController<InventoryService> {
  constructor(service: InventoryService) {
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

  async getPaginated(params: InventoryQueryParams = {}) {
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
        return { success: false, error: 'Inventory item not found' };
      }
      return this.wrapSuccess(item);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getBySku(sku: string) {
    try {
      const item = await this.service.findBySku(sku);
      if (!item) {
        return { success: false, error: 'Inventory item not found' };
      }
      return this.wrapSuccess(item);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getBySupplier(supplierId: number) {
    try {
      const items = await this.service.findBySupplier(supplierId);
      return this.wrapSuccess(items);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async search(query: string) {
    try {
      const items = await this.service.search(query);
      return this.wrapSuccess(items);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async searchForSelect(query: string, limit = 20) {
    try {
      const items = await this.service.searchForSelect(query, limit);
      return this.wrapSuccess(items);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getLowStock() {
    try {
      const items = await this.service.findLowStock();
      return this.wrapSuccess(items);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getActive() {
    try {
      const items = await this.service.findActive();
      return this.wrapSuccess(items);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getVariants(parentSku: string) {
    try {
      const variants = await this.service.getVariantsBySku(parentSku);
      return this.wrapSuccess(variants);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async checkHasVariants(parentSku: string) {
    try {
      const hasVariants = await this.service.hasVariants(parentSku);
      return this.wrapSuccess({ hasVariants });
    } catch (error) {
      return this.handleError(error);
    }
  }

  async create(data: schema.InsertInventory) {
    try {
      const item = await this.service.create(data);
      return this.wrapSuccess(item);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async update(id: number, data: Partial<schema.InsertInventory>) {
    try {
      const item = await this.service.update(id, data);
      if (!item) {
        return { success: false, error: 'Inventory item not found' };
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

  async updateStock(id: number, quantity: number) {
    try {
      const item = await this.service.updateStock(id, quantity);
      if (!item) {
        return { success: false, error: 'Inventory item not found' };
      }
      return this.wrapSuccess(item);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async updatePrice(id: number, price: string) {
    try {
      const item = await this.service.updatePrice(id, price);
      if (!item) {
        return { success: false, error: 'Inventory item not found' };
      }
      return this.wrapSuccess(item);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async activate(id: number) {
    try {
      const item = await this.service.activate(id);
      if (!item) {
        return { success: false, error: 'Inventory item not found' };
      }
      return this.wrapSuccess(item);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async deactivate(id: number) {
    try {
      const item = await this.service.deactivate(id);
      if (!item) {
        return { success: false, error: 'Inventory item not found' };
      }
      return this.wrapSuccess(item);
    } catch (error) {
      return this.handleError(error);
    }
  }
}
