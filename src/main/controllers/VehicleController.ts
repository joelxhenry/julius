import { BaseController } from './BaseController';
import { VehicleModelService, PartModelService } from '../services/VehicleService';
import * as schema from '../database/schema';

export class VehicleModelController extends BaseController<VehicleModelService> {
  constructor(service: VehicleModelService) {
    super(service);
  }

  async getAll() {
    try {
      const models = await this.service.findAll();
      return this.wrapSuccess(models);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getById(id: number) {
    try {
      const model = await this.service.findById(id);
      if (!model) {
        return { success: false, error: 'Vehicle model not found' };
      }
      return this.wrapSuccess(model);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async search(query: string) {
    try {
      const models = await this.service.search(query);
      return this.wrapSuccess(models);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async findByMakeAndModel(make: string, model: string) {
    try {
      const vehicleModel = await this.service.findByMakeAndModel(make, model);
      if (!vehicleModel) {
        return { success: false, error: 'Vehicle model not found' };
      }
      return this.wrapSuccess(vehicleModel);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async create(data: schema.InsertVehicleModel) {
    try {
      const model = await this.service.create(data);
      return this.wrapSuccess(model);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async update(id: number, data: Partial<schema.InsertVehicleModel>) {
    try {
      const model = await this.service.update(id, data);
      if (!model) {
        return { success: false, error: 'Vehicle model not found' };
      }
      return this.wrapSuccess(model);
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

export class PartModelController extends BaseController<PartModelService> {
  constructor(service: PartModelService) {
    super(service);
  }

  async getAll() {
    try {
      const models = await this.service.findAll();
      return this.wrapSuccess(models);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getById(id: number) {
    try {
      const model = await this.service.findById(id);
      if (!model) {
        return { success: false, error: 'Part model not found' };
      }
      return this.wrapSuccess(model);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByPart(partId: number) {
    try {
      const models = await this.service.findByPart(partId);
      return this.wrapSuccess(models);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByVehicleModel(vehicleModelId: number) {
    try {
      const models = await this.service.findByVehicleModel(vehicleModelId);
      return this.wrapSuccess(models);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async create(data: schema.InsertPartModel) {
    try {
      const model = await this.service.create(data);
      return this.wrapSuccess(model);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async bulkCreate(items: schema.InsertPartModel[]) {
    try {
      const models = await this.service.bulkCreate(items);
      return this.wrapSuccess(models);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async update(id: number, data: Partial<schema.InsertPartModel>) {
    try {
      const model = await this.service.update(id, data);
      if (!model) {
        return { success: false, error: 'Part model not found' };
      }
      return this.wrapSuccess(model);
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
