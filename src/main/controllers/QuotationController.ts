import { BaseController } from './BaseController';
import { QuotationService, QuotationQueryParams } from '../services/QuotationService';
import * as schema from '../database/schema';

export class QuotationController extends BaseController<QuotationService> {
  constructor(service: QuotationService) {
    super(service);
  }

  async getAll() {
    try {
      const quotations = await this.service.findAll();
      return this.wrapSuccess(quotations);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getPaginated(params: QuotationQueryParams = {}) {
    try {
      const result = await this.service.findPaginated(params);
      return this.wrapSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getById(id: number) {
    try {
      const quotation = await this.service.findById(id);
      if (!quotation) {
        return { success: false, error: 'Quotation not found' };
      }
      return this.wrapSuccess(quotation);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByQuoteNum(quoteNum: string) {
    try {
      const quotation = await this.service.findByQuoteNum(quoteNum);
      if (!quotation) {
        return { success: false, error: 'Quotation not found' };
      }
      return this.wrapSuccess(quotation);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByClient(clientId: number) {
    try {
      const quotations = await this.service.findByClient(clientId);
      return this.wrapSuccess(quotations);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getBySalesperson(salespersonId: number) {
    try {
      const quotations = await this.service.findBySalesperson(salespersonId);
      return this.wrapSuccess(quotations);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByStatus(status: string) {
    try {
      const quotations = await this.service.findByStatus(status);
      return this.wrapSuccess(quotations);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByDateRange(startDate: string, endDate: string) {
    try {
      const quotations = await this.service.findByDateRange(startDate, endDate);
      return this.wrapSuccess(quotations);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async create(data: schema.InsertQuotation) {
    try {
      const quotation = await this.service.create(data);
      return this.wrapSuccess(quotation);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async update(id: number, data: Partial<schema.InsertQuotation>) {
    try {
      const quotation = await this.service.update(id, data);
      if (!quotation) {
        return { success: false, error: 'Quotation not found' };
      }
      return this.wrapSuccess(quotation);
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

  async convertToInvoice(id: number) {
    try {
      const quotation = await this.service.convertToInvoice(id);
      if (!quotation) {
        return { success: false, error: 'Quotation not found' };
      }
      return this.wrapSuccess(quotation);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async expire(id: number) {
    try {
      const quotation = await this.service.expire(id);
      if (!quotation) {
        return { success: false, error: 'Quotation not found' };
      }
      return this.wrapSuccess(quotation);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async archive(id: number) {
    try {
      const quotation = await this.service.archive(id);
      if (!quotation) {
        return { success: false, error: 'Quotation not found' };
      }
      return this.wrapSuccess(quotation);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getAdjacentQuotations(id: number) {
    try {
      const adjacent = await this.service.getAdjacentQuotations(id);
      return this.wrapSuccess(adjacent);
    } catch (error) {
      return this.handleError(error);
    }
  }
}
