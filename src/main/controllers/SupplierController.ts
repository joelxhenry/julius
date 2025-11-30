import { BaseController } from './BaseController';
import { SupplierService, SupplierQueryParams } from '../services/SupplierService';
import * as schema from '../database/schema';

export class SupplierController extends BaseController<SupplierService> {
  constructor(service: SupplierService) {
    super(service);
  }

  async getAll() {
    try {
      const suppliers = await this.service.findAll();
      return this.wrapSuccess(suppliers);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getPaginated(params: SupplierQueryParams = {}) {
    try {
      const result = await this.service.findPaginated(params);
      return this.wrapSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getById(id: number) {
    try {
      const supplier = await this.service.findById(id);
      if (!supplier) {
        return { success: false, error: 'Supplier not found' };
      }
      return this.wrapSuccess(supplier);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getBySupplierCode(supplierCode: string) {
    try {
      const supplier = await this.service.findBySupplierCode(supplierCode);
      if (!supplier) {
        return { success: false, error: 'Supplier not found' };
      }
      return this.wrapSuccess(supplier);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getActive() {
    try {
      const suppliers = await this.service.findActive();
      return this.wrapSuccess(suppliers);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async search(query: string) {
    try {
      const suppliers = await this.service.search(query);
      return this.wrapSuccess(suppliers);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async create(data: schema.InsertSupplier) {
    try {
      const supplier = await this.service.create(data);
      return this.wrapSuccess(supplier);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async update(id: number, data: Partial<schema.InsertSupplier>) {
    try {
      const supplier = await this.service.update(id, data);
      if (!supplier) {
        return { success: false, error: 'Supplier not found' };
      }
      return this.wrapSuccess(supplier);
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

  async activate(id: number) {
    try {
      const supplier = await this.service.activate(id);
      if (!supplier) {
        return { success: false, error: 'Supplier not found' };
      }
      return this.wrapSuccess(supplier);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async deactivate(id: number) {
    try {
      const supplier = await this.service.deactivate(id);
      if (!supplier) {
        return { success: false, error: 'Supplier not found' };
      }
      return this.wrapSuccess(supplier);
    } catch (error) {
      return this.handleError(error);
    }
  }
}
