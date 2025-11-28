import { BaseController } from './BaseController';
import { ClientService, ClientQueryParams } from '../services/ClientService';
import * as schema from '../database/schema';

export class ClientController extends BaseController<ClientService> {
  constructor(service: ClientService) {
    super(service);
  }

  async getAll() {
    try {
      const clients = await this.service.findAll();
      return this.wrapSuccess(clients);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getPaginated(params: ClientQueryParams = {}) {
    try {
      const result = await this.service.findPaginated(params);
      return this.wrapSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getById(id: number) {
    try {
      const client = await this.service.findById(id);
      if (!client) {
        return { success: false, error: 'Client not found' };
      }
      return this.wrapSuccess(client);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByLegacyId(legacyId: number) {
    try {
      const client = await this.service.findByLegacyId(legacyId);
      if (!client) {
        return { success: false, error: 'Client not found' };
      }
      return this.wrapSuccess(client);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByEmail(email: string) {
    try {
      const client = await this.service.findByEmail(email);
      if (!client) {
        return { success: false, error: 'Client not found' };
      }
      return this.wrapSuccess(client);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async search(query: string) {
    try {
      const clients = await this.service.search(query);
      return this.wrapSuccess(clients);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async create(data: schema.InsertClient) {
    try {
      const client = await this.service.create(data);
      return this.wrapSuccess(client);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async update(id: number, data: Partial<schema.InsertClient>) {
    try {
      const client = await this.service.update(id, data);
      if (!client) {
        return { success: false, error: 'Client not found' };
      }
      return this.wrapSuccess(client);
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

  async updateCreditLimit(id: number, creditLimit: number) {
    try {
      const client = await this.service.updateCreditLimit(id, creditLimit);
      if (!client) {
        return { success: false, error: 'Client not found' };
      }
      return this.wrapSuccess(client);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async updateDiscountRate(id: number, discountRate: number) {
    try {
      const client = await this.service.updateDiscountRate(id, discountRate);
      if (!client) {
        return { success: false, error: 'Client not found' };
      }
      return this.wrapSuccess(client);
    } catch (error) {
      return this.handleError(error);
    }
  }
}
