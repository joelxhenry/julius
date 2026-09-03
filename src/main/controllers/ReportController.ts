import { BaseController } from './BaseController';
import { ReportService, DateRangeParams, PurchaseReportParams } from '../services/ReportService';

export class ReportController extends BaseController<ReportService> {
  async getSalesSummary(params: DateRangeParams) {
    try {
      const data = await this.service.getSalesSummary(params);
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

  async getPurchaseSummary(params: PurchaseReportParams) {
    try {
      const data = await this.service.getPurchaseSummary(params);
      return this.wrapSuccess(data);
    } catch (error) {
      return this.handleError(error);
    }
  }
}
