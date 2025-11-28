import { BaseController } from './BaseController';
import { UserService, UserQueryParams } from '../services/UserService';
import * as schema from '../database/schema';

export class UserController extends BaseController<UserService> {
  constructor(service: UserService) {
    super(service);
  }

  async getAll() {
    try {
      const users = await this.service.findAll();
      return this.wrapSuccess(users);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getPaginated(params: UserQueryParams = {}) {
    try {
      const result = await this.service.findPaginated(params);
      return this.wrapSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getById(id: number) {
    try {
      const user = await this.service.findById(id);
      if (!user) {
        return { success: false, error: 'User not found' };
      }
      return this.wrapSuccess(user);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByUsername(username: string) {
    try {
      const user = await this.service.findByUsername(username);
      if (!user) {
        return { success: false, error: 'User not found' };
      }
      return this.wrapSuccess(user);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByRole(roleId: number) {
    try {
      const users = await this.service.findByRole(roleId);
      return this.wrapSuccess(users);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getActive() {
    try {
      const users = await this.service.findActive();
      return this.wrapSuccess(users);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async search(query: string) {
    try {
      const users = await this.service.search(query);
      return this.wrapSuccess(users);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async create(data: schema.InsertUser) {
    try {
      const user = await this.service.create(data);
      return this.wrapSuccess(user);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async update(id: number, data: Partial<schema.InsertUser>) {
    try {
      const user = await this.service.update(id, data);
      if (!user) {
        return { success: false, error: 'User not found' };
      }
      return this.wrapSuccess(user);
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

  async updatePin(id: number, pinHash: string, usingDefaultPin: boolean = false) {
    try {
      const user = await this.service.updatePin(id, pinHash, usingDefaultPin);
      if (!user) {
        return { success: false, error: 'User not found' };
      }
      return this.wrapSuccess(user);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async deactivateUser(id: number, endDate: string) {
    try {
      const user = await this.service.deactivateUser(id, endDate);
      if (!user) {
        return { success: false, error: 'User not found' };
      }
      return this.wrapSuccess(user);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async authenticate(username: string, password: string) {
    try {
      const result = await this.service.authenticate(username, password);
      if (result.success) {
        return this.wrapSuccess({
          user: result.user,
          requiresPinChange: result.requiresPinChange,
        });
      }
      return { success: false, error: result.error };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async updatePinSecure(id: number, newPin: string) {
    try {
      const user = await this.service.updatePinSecure(id, newPin);
      if (!user) {
        return { success: false, error: 'User not found' };
      }
      // Don't return the pinHash
      const { pinHash, ...userWithoutPin } = user;
      return this.wrapSuccess(userWithoutPin);
    } catch (error) {
      return this.handleError(error);
    }
  }
}
