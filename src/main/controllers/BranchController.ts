import { BaseController } from './BaseController';
import { BranchService } from '../services/BranchService';
import * as schema from '../database/schema';

export class BranchController extends BaseController<BranchService> {
  constructor(service: BranchService) {
    super(service);
  }

  async getAll() {
    try {
      const branches = await this.service.findAll();
      return this.wrapSuccess(branches);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getById(id: number) {
    try {
      const branch = await this.service.findById(id);
      if (!branch) {
        return { success: false, error: 'Branch not found' };
      }
      return this.wrapSuccess(branch);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByCode(code: string) {
    try {
      const branch = await this.service.findByCode(code);
      if (!branch) {
        return { success: false, error: 'Branch not found' };
      }
      return this.wrapSuccess(branch);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getActive() {
    try {
      const branches = await this.service.findActive();
      return this.wrapSuccess(branches);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async create(data: schema.InsertBranch) {
    try {
      const branch = await this.service.create(data);
      return this.wrapSuccess(branch);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async update(id: number, data: Partial<schema.InsertBranch>) {
    try {
      const branch = await this.service.update(id, data);
      if (!branch) {
        return { success: false, error: 'Branch not found' };
      }
      return this.wrapSuccess(branch);
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
      const branch = await this.service.activate(id);
      if (!branch) {
        return { success: false, error: 'Branch not found' };
      }
      return this.wrapSuccess(branch);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async deactivate(id: number) {
    try {
      const branch = await this.service.deactivate(id);
      if (!branch) {
        return { success: false, error: 'Branch not found' };
      }
      return this.wrapSuccess(branch);
    } catch (error) {
      return this.handleError(error);
    }
  }
}
