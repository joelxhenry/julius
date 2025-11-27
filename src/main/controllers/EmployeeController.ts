import { BaseController } from './BaseController';
import { EmployeeService } from '../services/EmployeeService';
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

  async getByRole(roleId: number) {
    try {
      const employees = await this.service.findByRole(roleId);
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

  async search(query: string) {
    try {
      const employees = await this.service.search(query);
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

  async updatePin(id: number, pinHash: string, usingDefaultPin: boolean = false) {
    try {
      const employee = await this.service.updatePin(id, pinHash, usingDefaultPin);
      if (!employee) {
        return { success: false, error: 'Employee not found' };
      }
      return this.wrapSuccess(employee);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async terminateEmployee(id: number, endDate: string) {
    try {
      const employee = await this.service.terminateEmployee(id, endDate);
      if (!employee) {
        return { success: false, error: 'Employee not found' };
      }
      return this.wrapSuccess(employee);
    } catch (error) {
      return this.handleError(error);
    }
  }
}
