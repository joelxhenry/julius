import { BaseController } from './BaseController';
import { ReportService, DateRangeParams, InventoryValuationParams } from '../services/ReportService';

export class ReportController extends BaseController<ReportService> {
  async getSalesSummary(params: DateRangeParams) {
    try {
      const data = await this.service.getSalesSummary(params);
      return this.wrapSuccess(data);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getReceivablesAging() {
    try {
      const data = await this.service.getReceivablesAging();
      return this.wrapSuccess(data);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getInventoryValuation(params: InventoryValuationParams) {
    try {
      const data = await this.service.getInventoryValuation(params);
      return this.wrapSuccess(data);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getSalespersonPerformance(params: DateRangeParams) {
    try {
      const data = await this.service.getSalespersonPerformance(params);
      return this.wrapSuccess(data);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getPaymentCollection(params: DateRangeParams) {
    try {
      const data = await this.service.getPaymentCollection(params);
      return this.wrapSuccess(data);
    } catch (error) {
      return this.handleError(error);
    }
  }
}
