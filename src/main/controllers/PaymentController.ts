import { BaseController } from './BaseController';
import { PaymentService, PaymentMethodService, PaymentQueryParams, PaymentDocumentType } from '../services/PaymentService';
import * as schema from '../database/schema';

export class PaymentController extends BaseController<PaymentService> {
  constructor(service: PaymentService) {
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

  async getPaginated(params: PaymentQueryParams = {}) {
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
        return { success: false, error: 'Payment not found' };
      }
      return this.wrapSuccess(payment);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByDocumentType(documentType: PaymentDocumentType) {
    try {
      const payments = await this.service.findByDocumentType(documentType);
      return this.wrapSuccess(payments);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByInvoice(invoiceNumber: string) {
    try {
      const payments = await this.service.findByInvoice(invoiceNumber);
      return this.wrapSuccess(payments);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByCreditNote(creditNoteNumber: string) {
    try {
      const payments = await this.service.findByCreditNote(creditNoteNumber);
      return this.wrapSuccess(payments);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByBill(billNumber: string) {
    try {
      const payments = await this.service.findByBill(billNumber);
      return this.wrapSuccess(payments);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByDateRange(startDate: string, endDate: string) {
    try {
      const payments = await this.service.findByDateRange(startDate, endDate);
      return this.wrapSuccess(payments);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getTotalByDateRange(startDate: string, endDate: string) {
    try {
      const total = await this.service.getTotalByDateRange(startDate, endDate);
      return this.wrapSuccess({ total });
    } catch (error) {
      return this.handleError(error);
    }
  }

  async create(data: schema.InsertPayment) {
    try {
      const payment = await this.service.create(data);
      return this.wrapSuccess(payment);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async createInvoicePayment(
    invoiceNumber: string,
    amount: string,
    payerName?: string,
    paymentDesc?: string
  ) {
    try {
      const payment = await this.service.createInvoicePayment(
        invoiceNumber,
        amount,
        payerName,
        paymentDesc
      );
      return this.wrapSuccess(payment);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async createBillPayment(
    billNumber: string,
    amount: string,
    payerName?: string,
    paymentDesc?: string
  ) {
    try {
      const payment = await this.service.createBillPayment(
        billNumber,
        amount,
        payerName,
        paymentDesc
      );
      return this.wrapSuccess(payment);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async update(id: number, data: Partial<schema.InsertPayment>) {
    try {
      const payment = await this.service.update(id, data);
      if (!payment) {
        return { success: false, error: 'Payment not found' };
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

export class PaymentMethodController extends BaseController<PaymentMethodService> {
  constructor(service: PaymentMethodService) {
    super(service);
  }

  async getAll() {
    try {
      const methods = await this.service.findAll();
      return this.wrapSuccess(methods);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getById(id: number) {
    try {
      const method = await this.service.findById(id);
      if (!method) {
        return { success: false, error: 'Payment method not found' };
      }
      return this.wrapSuccess(method);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByCode(code: string) {
    try {
      const method = await this.service.findByCode(code);
      if (!method) {
        return { success: false, error: 'Payment method not found' };
      }
      return this.wrapSuccess(method);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByName(name: string) {
    try {
      const method = await this.service.findByName(name);
      if (!method) {
        return { success: false, error: 'Payment method not found' };
      }
      return this.wrapSuccess(method);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getActive() {
    try {
      const methods = await this.service.findActive();
      return this.wrapSuccess(methods);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async create(data: schema.InsertPaymentMethod) {
    try {
      const method = await this.service.create(data);
      return this.wrapSuccess(method);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async update(id: number, data: Partial<schema.InsertPaymentMethod>) {
    try {
      const method = await this.service.update(id, data);
      if (!method) {
        return { success: false, error: 'Payment method not found' };
      }
      return this.wrapSuccess(method);
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

  async activate(id: number) {
    try {
      const method = await this.service.activate(id);
      if (!method) {
        return { success: false, error: 'Payment method not found' };
      }
      return this.wrapSuccess(method);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async deactivate(id: number) {
    try {
      const method = await this.service.deactivate(id);
      if (!method) {
        return { success: false, error: 'Payment method not found' };
      }
      return this.wrapSuccess(method);
    } catch (error) {
      return this.handleError(error);
    }
  }
}
