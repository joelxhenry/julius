import { BaseController } from './BaseController';
import { CreditNoteService, CreditNoteAllocationService, CreditNoteQueryParams } from '../services/CreditNoteService';
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

  async getByClient(clientId: number) {
    try {
      const creditNotes = await this.service.findByClient(clientId);
      return this.wrapSuccess(creditNotes);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByInvoice(invoiceId: number) {
    try {
      const creditNotes = await this.service.findByInvoice(invoiceId);
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

  async getUnallocated() {
    try {
      const creditNotes = await this.service.findUnallocated();
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

  async markAllocated(id: number) {
    try {
      const creditNote = await this.service.markAllocated(id);
      if (!creditNote) {
        return { success: false, error: 'Credit note not found' };
      }
      return this.wrapSuccess(creditNote);
    } catch (error) {
      return this.handleError(error);
    }
  }
}

export class CreditNoteAllocationController extends BaseController<CreditNoteAllocationService> {
  constructor(service: CreditNoteAllocationService) {
    super(service);
  }

  async getAll() {
    try {
      const allocations = await this.service.findAll();
      return this.wrapSuccess(allocations);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getById(id: number) {
    try {
      const allocation = await this.service.findById(id);
      if (!allocation) {
        return { success: false, error: 'Credit note allocation not found' };
      }
      return this.wrapSuccess(allocation);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByCreditNote(creditNoteId: number) {
    try {
      const allocations = await this.service.findByCreditNote(creditNoteId);
      return this.wrapSuccess(allocations);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByInvoice(invoiceId: number) {
    try {
      const allocations = await this.service.findByInvoice(invoiceId);
      return this.wrapSuccess(allocations);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getTotalAllocated(creditNoteId: number) {
    try {
      const total = await this.service.getTotalAllocated(creditNoteId);
      return this.wrapSuccess({ total });
    } catch (error) {
      return this.handleError(error);
    }
  }

  async create(data: schema.InsertCreditNoteAllocation) {
    try {
      const allocation = await this.service.create(data);
      return this.wrapSuccess(allocation);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async update(id: number, data: Partial<schema.InsertCreditNoteAllocation>) {
    try {
      const allocation = await this.service.update(id, data);
      if (!allocation) {
        return { success: false, error: 'Credit note allocation not found' };
      }
      return this.wrapSuccess(allocation);
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
