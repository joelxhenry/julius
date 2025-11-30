import { BaseController } from './BaseController';
import { CategoryService, CategoryQueryParams } from '../services/CategoryService';
import * as schema from '../database/schema';

export class CategoryController extends BaseController<CategoryService> {
  constructor(service: CategoryService) {
    super(service);
  }

  async getAll() {
    try {
      const categories = await this.service.findAll();
      return this.wrapSuccess(categories);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getPaginated(params: CategoryQueryParams = {}) {
    try {
      const result = await this.service.findPaginated(params);
      return this.wrapSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getById(id: number) {
    try {
      const category = await this.service.findById(id);
      if (!category) {
        return { success: false, error: 'Category not found' };
      }
      return this.wrapSuccess(category);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByCode(code: string) {
    try {
      const category = await this.service.findByCode(code);
      if (!category) {
        return { success: false, error: 'Category not found' };
      }
      return this.wrapSuccess(category);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByType(categoryType: 'ACCOUNT' | 'INVENTORY') {
    try {
      const categories = await this.service.findByType(categoryType);
      return this.wrapSuccess(categories);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByParent(parentId: number) {
    try {
      const categories = await this.service.findByParent(parentId);
      return this.wrapSuccess(categories);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getRoots(categoryType?: 'ACCOUNT' | 'INVENTORY') {
    try {
      const categories = await this.service.findRoots(categoryType);
      return this.wrapSuccess(categories);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async create(data: schema.InsertCategory) {
    try {
      const category = await this.service.create(data);
      return this.wrapSuccess(category);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async update(id: number, data: Partial<schema.InsertCategory>) {
    try {
      const category = await this.service.update(id, data);
      if (!category) {
        return { success: false, error: 'Category not found' };
      }
      return this.wrapSuccess(category);
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
