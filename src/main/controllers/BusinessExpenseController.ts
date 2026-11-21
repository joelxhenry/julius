import { BaseController } from './BaseController';
import { BusinessExpenseService, BusinessExpenseQueryParams } from '../services/BusinessExpenseService';
import * as schema from '../database/schema';

export class BusinessExpenseController extends BaseController<BusinessExpenseService> {
  constructor(service: BusinessExpenseService) {
    super(service);
  }

  async getPaginated(params: BusinessExpenseQueryParams = {}) {
    try {
      const result = await this.service.findPaginated(params);
      return this.wrapSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getById(id: number) {
    try {
      const expense = await this.service.findById(id);
      if (!expense) {
        return { success: false, error: 'Business expense not found' };
      }
      return this.wrapSuccess(expense);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async create(data: schema.InsertBusinessExpense) {
    try {
      const expense = await this.service.create(data);
      return this.wrapSuccess(expense);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async update(id: number, data: Partial<schema.InsertBusinessExpense>) {
    try {
      const expense = await this.service.updateExpense(id, data);
      if (!expense) {
        return { success: false, error: 'Business expense not found' };
      }
      return this.wrapSuccess(expense);
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
