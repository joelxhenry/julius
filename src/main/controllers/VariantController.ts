import { BaseController } from './BaseController';
import { VariantService, VariantQueryParams } from '../services/VariantService';
import * as schema from '../database/schema';

export class VariantController extends BaseController<VariantService> {
  constructor(service: VariantService) {
    super(service);
  }

  async getAll() {
    try {
      const variants = await this.service.findAll();
      return this.wrapSuccess(variants);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getPaginated(params: VariantQueryParams = {}) {
    try {
      const result = await this.service.findPaginated(params);
      return this.wrapSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getById(id: number) {
    try {
      const variant = await this.service.findById(id);
      if (!variant) {
        return { success: false, error: 'Variant not found' };
      }
      return this.wrapSuccess(variant);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByInventoryId(inventoryId: number) {
    try {
      const variants = await this.service.findByInventoryId(inventoryId);
      return this.wrapSuccess(variants);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByBarcode(barcode: string) {
    try {
      const variant = await this.service.findByBarcode(barcode);
      if (!variant) {
        return { success: false, error: 'Variant not found' };
      }
      return this.wrapSuccess(variant);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByVariantSku(variantSku: string) {
    try {
      const variant = await this.service.findByVariantSku(variantSku);
      if (!variant) {
        return { success: false, error: 'Variant not found' };
      }
      return this.wrapSuccess(variant);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getActive(inventoryId?: number) {
    try {
      const variants = await this.service.findActive(inventoryId);
      return this.wrapSuccess(variants);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getLowStock() {
    try {
      const variants = await this.service.findLowStock();
      return this.wrapSuccess(variants);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async searchForSelect(query: string, limit = 20) {
    try {
      const variants = await this.service.searchForSelect(query, limit);
      return this.wrapSuccess(variants);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async create(data: schema.InsertVariant) {
    try {
      const variant = await this.service.create(data);
      return this.wrapSuccess(variant);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async update(id: number, data: Partial<schema.InsertVariant>) {
    try {
      const variant = await this.service.update(id, data);
      if (!variant) {
        return { success: false, error: 'Variant not found' };
      }
      return this.wrapSuccess(variant);
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
      const variant = await this.service.updateStock(id, quantity);
      if (!variant) {
        return { success: false, error: 'Variant not found' };
      }
      return this.wrapSuccess(variant);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async setStock(id: number, stockQty: number) {
    try {
      const variant = await this.service.setStock(id, stockQty);
      if (!variant) {
        return { success: false, error: 'Variant not found' };
      }
      return this.wrapSuccess(variant);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async updatePrice(id: number, price: string) {
    try {
      const variant = await this.service.updatePrice(id, price);
      if (!variant) {
        return { success: false, error: 'Variant not found' };
      }
      return this.wrapSuccess(variant);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async activate(id: number) {
    try {
      const variant = await this.service.activate(id);
      if (!variant) {
        return { success: false, error: 'Variant not found' };
      }
      return this.wrapSuccess(variant);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async deactivate(id: number) {
    try {
      const variant = await this.service.deactivate(id);
      if (!variant) {
        return { success: false, error: 'Variant not found' };
      }
      return this.wrapSuccess(variant);
    } catch (error) {
      return this.handleError(error);
    }
  }
}
