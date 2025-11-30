import { BaseController } from './BaseController';
import { CreditNoteService, CreditNoteQueryParams } from '../services/CreditNoteService';
import * as schema from '../database/schema';

export class CreditNoteController extends BaseController<CreditNoteService> {
  constructor(service: CreditNoteService) {
    super(service);
  }

  async getAll() {
    try {
      const creditNotes = await this.service.findAll();
      return this.wrapSuccess(creditNotes);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getPaginated(params: CreditNoteQueryParams = {}) {
    try {
      const result = await this.service.findPaginated(params);
      return this.wrapSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getById(id: number) {
    try {
      const creditNote = await this.service.findById(id);
      if (!creditNote) {
        return { success: false, error: 'Credit note not found' };
      }
      return this.wrapSuccess(creditNote);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByCrNumber(crNumber: string) {
    try {
      const creditNote = await this.service.findByCrNumber(crNumber);
      if (!creditNote) {
        return { success: false, error: 'Credit note not found' };
      }
      return this.wrapSuccess(creditNote);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByClient(clientId: number) {
    try {
      const creditNotes = await this.service.findByClient(clientId);
      return this.wrapSuccess(creditNotes);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByInvoice(invNumber: string) {
    try {
      const creditNotes = await this.service.findByInvoice(invNumber);
      return this.wrapSuccess(creditNotes);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getBySalesperson(salespersonId: number) {
    try {
      const creditNotes = await this.service.findBySalesperson(salespersonId);
      return this.wrapSuccess(creditNotes);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByDateRange(startDate: string, endDate: string) {
    try {
      const creditNotes = await this.service.findByDateRange(startDate, endDate);
      return this.wrapSuccess(creditNotes);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getUnused() {
    try {
      const creditNotes = await this.service.findUnused();
      return this.wrapSuccess(creditNotes);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async create(data: schema.InsertCreditNote) {
    try {
      const creditNote = await this.service.create(data);
      return this.wrapSuccess(creditNote);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async update(id: number, data: Partial<schema.InsertCreditNote>) {
    try {
      const creditNote = await this.service.update(id, data);
      if (!creditNote) {
        return { success: false, error: 'Credit note not found' };
      }
      return this.wrapSuccess(creditNote);
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

  async recordUsage(id: number, amount: string) {
    try {
      const creditNote = await this.service.recordUsage(id, amount);
      if (!creditNote) {
        return { success: false, error: 'Credit note not found' };
      }
      return this.wrapSuccess(creditNote);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async archive(id: number) {
    try {
      const creditNote = await this.service.archive(id);
      if (!creditNote) {
        return { success: false, error: 'Credit note not found' };
      }
      return this.wrapSuccess(creditNote);
    } catch (error) {
      return this.handleError(error);
    }
  }
}
