import { BaseController } from './BaseController';
import { GctPaymentService, GctPaymentQueryParams } from '../services/GctPaymentService';
import * as schema from '../database/schema';

export class GctPaymentController extends BaseController<GctPaymentService> {
  constructor(service: GctPaymentService) {
    super(service);
  }

  async getAll() {
    try {
      const payments = await this.service.findAll();
      return this.wrapSuccess(payments);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getPaginated(params: GctPaymentQueryParams = {}) {
    try {
      const result = await this.service.findPaginated(params);
      return this.wrapSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getById(id: number) {
    try {
      const payment = await this.service.findById(id);
      if (!payment) {
        return { success: false, error: 'GCT payment not found' };
      }
      return this.wrapSuccess(payment);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByPeriod(periodStart: string, periodEnd: string) {
    try {
      const payments = await this.service.findByPeriod(periodStart, periodEnd);
      return this.wrapSuccess(payments);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByYear(year: number) {
    try {
      const payments = await this.service.findByYear(year);
      return this.wrapSuccess(payments);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async create(data: schema.InsertGctPayment) {
    try {
      const payment = await this.service.create(data);
      return this.wrapSuccess(payment);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async update(id: number, data: Partial<schema.InsertGctPayment>) {
    try {
      const payment = await this.service.update(id, data);
      if (!payment) {
        return { success: false, error: 'GCT payment not found' };
      }
      return this.wrapSuccess(payment);
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
