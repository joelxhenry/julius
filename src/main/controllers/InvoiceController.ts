import { BaseController } from './BaseController';
import { InvoiceService, InvoiceItemService, InvoiceQueryParams } from '../services/InvoiceService';
import * as schema from '../database/schema';

export class InvoiceController extends BaseController<InvoiceService> {
  constructor(service: InvoiceService) {
    super(service);
  }

  async getAll(includeHistorical: boolean = false) {
    try {
      const invoices = await this.service.findAllFiltered(includeHistorical);
      return this.wrapSuccess(invoices);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getPaginated(params: InvoiceQueryParams = {}) {
    try {
      const result = await this.service.findPaginated(params);
      return this.wrapSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getById(id: number) {
    try {
      const invoice = await this.service.findById(id);
      if (!invoice) {
        return { success: false, error: 'Invoice not found' };
      }
      return this.wrapSuccess(invoice);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByLegacyId(legacyId: number, isHistorical: boolean = false) {
    try {
      const invoice = await this.service.findByLegacyId(legacyId, isHistorical);
      if (!invoice) {
        return { success: false, error: 'Invoice not found' };
      }
      return this.wrapSuccess(invoice);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByClient(clientId: number) {
    try {
      const invoices = await this.service.findByClient(clientId);
      return this.wrapSuccess(invoices);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByEmployee(employeeId: number) {
    try {
      const invoices = await this.service.findByEmployee(employeeId);
      return this.wrapSuccess(invoices);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByStatus(status: string) {
    try {
      const invoices = await this.service.findByStatus(status);
      return this.wrapSuccess(invoices);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByDateRange(startDate: string, endDate: string) {
    try {
      const invoices = await this.service.findByDateRange(startDate, endDate);
      return this.wrapSuccess(invoices);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getUnpaid() {
    try {
      const invoices = await this.service.findUnpaid();
      return this.wrapSuccess(invoices);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async create(data: schema.InsertInvoice) {
    try {
      const invoice = await this.service.create(data);
      return this.wrapSuccess(invoice);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async update(id: number, data: Partial<schema.InsertInvoice>) {
    try {
      const invoice = await this.service.update(id, data);
      if (!invoice) {
        return { success: false, error: 'Invoice not found' };
      }
      return this.wrapSuccess(invoice);
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

  async recordPayment(id: number, amount: number) {
    try {
      const invoice = await this.service.recordPayment(id, amount);
      if (!invoice) {
        return { success: false, error: 'Invoice not found' };
      }
      return this.wrapSuccess(invoice);
    } catch (error) {
      return this.handleError(error);
    }
  }
}

export class InvoiceItemController extends BaseController<InvoiceItemService> {
  constructor(service: InvoiceItemService) {
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

  async getById(id: number) {
    try {
      const item = await this.service.findById(id);
      if (!item) {
        return { success: false, error: 'Invoice item not found' };
      }
      return this.wrapSuccess(item);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByInvoice(invoiceId: number) {
    try {
      const items = await this.service.findByInvoice(invoiceId);
      return this.wrapSuccess(items);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByLegacyId(legacyId: number) {
    try {
      const item = await this.service.findByLegacyId(legacyId);
      if (!item) {
        return { success: false, error: 'Invoice item not found' };
      }
      return this.wrapSuccess(item);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async create(data: schema.InsertInvoiceItem) {
    try {
      const item = await this.service.create(data);
      return this.wrapSuccess(item);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async bulkCreate(items: schema.InsertInvoiceItem[]) {
    try {
      const createdItems = await this.service.bulkCreate(items);
      return this.wrapSuccess(createdItems);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async update(id: number, data: Partial<schema.InsertInvoiceItem>) {
    try {
      const item = await this.service.update(id, data);
      if (!item) {
        return { success: false, error: 'Invoice item not found' };
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

  async deleteByInvoice(invoiceId: number) {
    try {
      await this.service.deleteByInvoice(invoiceId);
      return this.wrapSuccess({ deleted: true });
    } catch (error) {
      return this.handleError(error);
    }
  }
}
