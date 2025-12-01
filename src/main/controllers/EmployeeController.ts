import { BaseController } from './BaseController';
import { EmployeeService, EmployeeQueryParams } from '../services/EmployeeService';
import * as schema from '../database/schema';

export class EmployeeController extends BaseController<EmployeeService> {
  constructor(service: EmployeeService) {
    super(service);
  }

  async getAll() {
    try {
      const employees = await this.service.findAll();
      return this.wrapSuccess(employees);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getPaginated(params: EmployeeQueryParams = {}) {
    try {
      const result = await this.service.findPaginated(params);
      return this.wrapSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getById(id: number) {
    try {
      const employee = await this.service.findById(id);
      if (!employee) {
        return { success: false, error: 'Employee not found' };
      }
      return this.wrapSuccess(employee);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByUsername(username: string) {
    try {
      const employee = await this.service.findByUsername(username);
      if (!employee) {
        return { success: false, error: 'Employee not found' };
      }
      return this.wrapSuccess(employee);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByEmployeeCode(employeeCode: string) {
    try {
      const employee = await this.service.findByEmployeeCode(employeeCode);
      if (!employee) {
        return { success: false, error: 'Employee not found' };
      }
      return this.wrapSuccess(employee);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByBranch(branchId: number) {
    try {
      const employees = await this.service.findByBranch(branchId);
      return this.wrapSuccess(employees);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getActive() {
    try {
      const employees = await this.service.findActive();
      return this.wrapSuccess(employees);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getSalespeople() {
    try {
      const salespeople = await this.service.findSalespeople();
      return this.wrapSuccess(salespeople);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async search(query: string) {
    try {
      const employees = await this.service.search(query);
      return this.wrapSuccess(employees);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async searchForSelect(query: string, limit = 20, activeOnly = true) {
    try {
      const employees = await this.service.searchForSelect(query, limit, activeOnly);
      return this.wrapSuccess(employees);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async create(data: schema.InsertEmployee) {
    try {
      const employee = await this.service.create(data);
      return this.wrapSuccess(employee);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async update(id: number, data: Partial<schema.InsertEmployee>) {
    try {
      const employee = await this.service.update(id, data);
      if (!employee) {
        return { success: false, error: 'Employee not found' };
      }
      return this.wrapSuccess(employee);
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

  async authenticate(username: string, password: string) {
    try {
      const result = await this.service.authenticate(username, password);
      if (result.success) {
        return this.wrapSuccess({
          employee: result.employee,
        });
      }
      return { success: false, error: result.error };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async verifyPin(pin: string) {
    try {
      const result = await this.service.verifyPin(pin);
      if (result.success) {
        return this.wrapSuccess({
          employee: result.employee,
        });
      }
      return { success: false, error: result.error };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async updatePassword(id: number, newPassword: string) {
    try {
      const employee = await this.service.updatePasswordSecure(id, newPassword);
      if (!employee) {
        return { success: false, error: 'Employee not found' };
      }
      // Don't return the passwordHash
      const { passwordHash, ...safeEmployee } = employee;
      return this.wrapSuccess(safeEmployee);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async deactivate(id: number, endDate: string) {
    try {
      const employee = await this.service.deactivate(id, endDate);
      if (!employee) {
        return { success: false, error: 'Employee not found' };
      }
      return this.wrapSuccess(employee);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async activate(id: number) {
    try {
      const employee = await this.service.activate(id);
      if (!employee) {
        return { success: false, error: 'Employee not found' };
      }
      return this.wrapSuccess(employee);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async updatePermissions(id: number, permissions: Record<string, any>) {
    try {
      const employee = await this.service.updatePermissions(id, permissions);
      if (!employee) {
        return { success: false, error: 'Employee not found' };
      }
      return this.wrapSuccess(employee);
    } catch (error) {
      return this.handleError(error);
    }
  }
}
