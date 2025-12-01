import { BaseController } from './BaseController';
import { DocumentLineItemService, DocumentLineItemQueryParams } from '../services/DocumentLineItemService';
import * as schema from '../database/schema';

export class DocumentLineItemController extends BaseController<DocumentLineItemService> {
  constructor(service: DocumentLineItemService) {
    super(service);
  }

  async getAll() {
    try {
      const items = await this.service.findAll();
      return this.wrapSuccess(items);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getPaginated(params: DocumentLineItemQueryParams = {}) {
    try {
      const result = await this.service.findPaginated(params);
      return this.wrapSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getById(id: number) {
    try {
      const item = await this.service.findById(id);
      if (!item) {
        return { success: false, error: 'Document line item not found' };
      }
      return this.wrapSuccess(item);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByInvoice(invNumber: string) {
    try {
      const items = await this.service.findByInvoice(invNumber);
      return this.wrapSuccess(items);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByQuotation(quoteNum: string) {
    try {
      const items = await this.service.findByQuotation(quoteNum);
      return this.wrapSuccess(items);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByCreditNote(crNumber: string) {
    try {
      const items = await this.service.findByCreditNote(crNumber);
      return this.wrapSuccess(items);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getBySku(sku: string) {
    try {
      const items = await this.service.findBySku(sku);
      return this.wrapSuccess(items);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async create(data: schema.InsertDocumentLineItem) {
    try {
      const item = await this.service.create(data);
      return this.wrapSuccess(item);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async bulkCreate(items: schema.InsertDocumentLineItem[]) {
    try {
      const createdItems = await this.service.bulkCreate(items);
      return this.wrapSuccess(createdItems);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async update(id: number, data: Partial<schema.InsertDocumentLineItem>) {
    try {
      const item = await this.service.update(id, data);
      if (!item) {
        return { success: false, error: 'Document line item not found' };
      }
      return this.wrapSuccess(item);
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

  async deleteByDocument(documentType: 'INVOICE' | 'QUOTE' | 'CREDIT', documentNumber: string) {
    try {
      await this.service.deleteByDocument(documentType, documentNumber);
      return this.wrapSuccess({ deleted: true });
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getVariantSales(sku: string, params: DocumentLineItemQueryParams = {}) {
    try {
      const result = await this.service.getVariantSales(sku, params);
      return this.wrapSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getInventorySalesSummary(sku: string, params: { startDate?: string; endDate?: string } = {}) {
    try {
      const result = await this.service.getInventorySalesSummary(sku, params);
      return this.wrapSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }
}
