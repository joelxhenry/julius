import { BaseController } from './BaseController';
import { PartService, PartVariantService } from '../services/PartService';
import * as schema from '../database/schema';

export class PartController extends BaseController<PartService> {
  constructor(service: PartService) {
    super(service);
  }

  async getAll() {
    try {
      const parts = await this.service.findAll();
      return this.wrapSuccess(parts);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getById(id: number) {
    try {
      const part = await this.service.findById(id);
      if (!part) {
        return { success: false, error: 'Part not found' };
      }
      return this.wrapSuccess(part);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getBySku(sku: string) {
    try {
      const part = await this.service.findBySku(sku);
      if (!part) {
        return { success: false, error: 'Part not found' };
      }
      return this.wrapSuccess(part);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByCategory(category: string) {
    try {
      const parts = await this.service.findByCategory(category);
      return this.wrapSuccess(parts);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async search(query: string) {
    try {
      const parts = await this.service.search(query);
      return this.wrapSuccess(parts);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async create(data: schema.InsertPart) {
    try {
      const part = await this.service.create(data);
      return this.wrapSuccess(part);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async update(id: number, data: Partial<schema.InsertPart>) {
    try {
      const part = await this.service.update(id, data);
      if (!part) {
        return { success: false, error: 'Part not found' };
      }
      return this.wrapSuccess(part);
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

  async updatePrice(id: number, price: number) {
    try {
      const part = await this.service.updatePrice(id, price);
      if (!part) {
        return { success: false, error: 'Part not found' };
      }
      return this.wrapSuccess(part);
    } catch (error) {
      return this.handleError(error);
    }
  }
}

export class PartVariantController extends BaseController<PartVariantService> {
  constructor(service: PartVariantService) {
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

  async getById(id: number) {
    try {
      const variant = await this.service.findById(id);
      if (!variant) {
        return { success: false, error: 'Part variant not found' };
      }
      return this.wrapSuccess(variant);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByPartId(partId: number) {
    try {
      const variants = await this.service.findByPartId(partId);
      return this.wrapSuccess(variants);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByBarcode(barcode: string) {
    try {
      const variant = await this.service.findByBarcode(barcode);
      if (!variant) {
        return { success: false, error: 'Part variant not found' };
      }
      return this.wrapSuccess(variant);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getActive(partId?: number) {
    try {
      const variants = await this.service.findActive(partId);
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

  async create(data: schema.InsertPartVariant) {
    try {
      const variant = await this.service.create(data);
      return this.wrapSuccess(variant);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async update(id: number, data: Partial<schema.InsertPartVariant>) {
    try {
      const variant = await this.service.update(id, data);
      if (!variant) {
        return { success: false, error: 'Part variant not found' };
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
        return { success: false, error: 'Part variant not found' };
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
        return { success: false, error: 'Part variant not found' };
      }
      return this.wrapSuccess(variant);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async updatePrice(id: number, price: number) {
    try {
      const variant = await this.service.updatePrice(id, price);
      if (!variant) {
        return { success: false, error: 'Part variant not found' };
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
        return { success: false, error: 'Part variant not found' };
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
        return { success: false, error: 'Part variant not found' };
      }
      return this.wrapSuccess(variant);
    } catch (error) {
      return this.handleError(error);
    }
  }
}
