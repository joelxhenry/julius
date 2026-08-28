import { BaseController } from './BaseController';
import { InvoiceService, InvoiceQueryParams } from '../services/InvoiceService';
import * as schema from '../database/schema';

export class InvoiceController extends BaseController<InvoiceService> {
  constructor(service: InvoiceService) {
    super(service);
  }

  async getAll(includeArchived: boolean = false) {
    try {
      const invoices = await this.service.findAllFiltered(includeArchived);
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

  async getByInvNumber(invNumber: string) {
    try {
      const invoice = await this.service.findByInvNumber(invNumber);
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

  async getBySalesperson(salespersonId: number) {
    try {
      const invoices = await this.service.findBySalesperson(salespersonId);
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
      console.log('Creating invoice with data:', data);
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

  async recordPayment(id: number, amount: string) {
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

  async archive(id: number) {
    try {
      const invoice = await this.service.archive(id);
      if (!invoice) {
        return { success: false, error: 'Invoice not found' };
      }
      return this.wrapSuccess(invoice);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getAdjacentInvoices(id: number) {
    try {
      const result = await this.service.getAdjacentInvoices(id);
      return this.wrapSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getAdjacentInvoicesWithData(id: number) {
    try {
      const result = await this.service.getAdjacentInvoicesWithData(id);
      return this.wrapSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async checkInventoryAvailability(lineItems: Array<{ sku: string | null; quantity: number }>) {
    try {
      const warnings = await this.service.checkInventoryAvailability(lineItems);
      return this.wrapSuccess(warnings);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async adjustStockBySku(sku: string, quantity: number, employeeId?: number) {
    try {
      const result = await this.service.adjustStockBySku(sku, quantity, employeeId);
      return this.wrapSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async createInventoryTransactions(
    invNumber: string,
    lineItems: Array<{ sku: string | null; quantity: number }>,
    invDate: string
  ) {
    try {
      await this.service.createInventoryTransactions(invNumber, lineItems, invDate);
      return this.wrapSuccess({ created: true });
    } catch (error) {
      return this.handleError(error);
    }
  }

  async reissueInventoryTransactions(
    invNumber: string,
    lineItems: Array<{ sku: string | null; quantity: number }>,
    invDate: string
  ) {
    try {
      await this.service.reissueInventoryTransactions(invNumber, lineItems, invDate);
      return this.wrapSuccess({ reissued: true });
    } catch (error) {
      return this.handleError(error);
    }
  }
}
