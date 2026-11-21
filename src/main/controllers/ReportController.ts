import { BaseController } from './BaseController';
import { ReportService, DateRangeParams, PurchaseReportParams, TaxReportParams } from '../services/ReportService';

export class ReportController extends BaseController<ReportService> {
  async getSalesSummary(params: DateRangeParams) {
    try {
      const data = await this.service.getSalesSummary(params);
      return this.wrapSuccess(data);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getPaymentDetail(params: DateRangeParams) {
    try {
      const data = await this.service.getPaymentDetail(params);
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

  async getReceivablesSummary() {
    try {
      const data = await this.service.getReceivablesSummary();
      return this.wrapSuccess(data);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getTaxSummary(params: TaxReportParams) {
    try {
      const data = await this.service.getTaxSummary(params);
      return this.wrapSuccess(data);
    } catch (error) {
      return this.handleError(error);
    }
  }
}
