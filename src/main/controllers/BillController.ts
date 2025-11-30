import { BaseController } from './BaseController';
import { BillService, BillQueryParams } from '../services/BillService';
import * as schema from '../database/schema';

export class BillController extends BaseController<BillService> {
  constructor(service: BillService) {
    super(service);
  }

  async getAll() {
    try {
      const bills = await this.service.findAll();
      return this.wrapSuccess(bills);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getPaginated(params: BillQueryParams = {}) {
    try {
      const result = await this.service.findPaginated(params);
      return this.wrapSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getById(id: number) {
    try {
      const bill = await this.service.findById(id);
      if (!bill) {
        return { success: false, error: 'Bill not found' };
      }
      return this.wrapSuccess(bill);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByBillNo(billNo: string) {
    try {
      const bill = await this.service.findByBillNo(billNo);
      if (!bill) {
        return { success: false, error: 'Bill not found' };
      }
      return this.wrapSuccess(bill);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getBySupplier(supplierId: number) {
    try {
      const bills = await this.service.findBySupplier(supplierId);
      return this.wrapSuccess(bills);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByStatus(status: string) {
    try {
      const bills = await this.service.findByStatus(status);
      return this.wrapSuccess(bills);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByDateRange(startDate: string, endDate: string) {
    try {
      const bills = await this.service.findByDateRange(startDate, endDate);
      return this.wrapSuccess(bills);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getUnpaid() {
    try {
      const bills = await this.service.findUnpaid();
      return this.wrapSuccess(bills);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async create(data: schema.InsertBill) {
    try {
      const bill = await this.service.create(data);
      return this.wrapSuccess(bill);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async update(id: number, data: Partial<schema.InsertBill>) {
    try {
      const bill = await this.service.update(id, data);
      if (!bill) {
        return { success: false, error: 'Bill not found' };
      }
      return this.wrapSuccess(bill);
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
      const bill = await this.service.recordPayment(id, amount);
      if (!bill) {
        return { success: false, error: 'Bill not found' };
      }
      return this.wrapSuccess(bill);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async archive(id: number) {
    try {
      const bill = await this.service.archive(id);
      if (!bill) {
        return { success: false, error: 'Bill not found' };
      }
      return this.wrapSuccess(bill);
    } catch (error) {
      return this.handleError(error);
    }
  }
}
