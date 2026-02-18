import { BaseController } from './BaseController';
import { EmployeeShiftsService } from '../services/EmployeeShiftsService';
import * as schema from '../database/schema';

export class EmployeeShiftsController extends BaseController<EmployeeShiftsService> {
  constructor(service: EmployeeShiftsService) {
    super(service);
  }

  async getByEmployee(employeeId: number) {
    try {
      const shifts = await this.service.findByEmployee(employeeId);
      return this.wrapSuccess(shifts);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByDateRange(startDate: string, endDate: string, employeeId?: number) {
    try {
      const shifts = await this.service.findByDateRange(startDate, endDate, employeeId);
      return this.wrapSuccess(shifts);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getActiveShift(employeeId: number) {
    try {
      const shift = await this.service.findActiveShift(employeeId);
      return this.wrapSuccess(shift);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async clockIn(employeeId: number, notes?: string) {
    try {
      const shift = await this.service.clockIn(employeeId, notes);
      return this.wrapSuccess(shift);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async clockOut(employeeId: number, notes?: string) {
    try {
      const shift = await this.service.clockOut(employeeId, notes);
      if (!shift) {
        return { success: false, error: 'No active shift found' };
      }
      return this.wrapSuccess(shift);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getTotalHours(employeeId: number, startDate: string, endDate: string) {
    try {
      const totalHours = await this.service.getTotalHours(employeeId, startDate, endDate);
      return this.wrapSuccess({ totalHours });
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getById(id: number) {
    try {
      const shift = await this.service.findById(id);
      if (!shift) {
        return { success: false, error: 'Shift not found' };
      }
      return this.wrapSuccess(shift);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async create(data: schema.InsertEmployeeShift) {
    try {
      const shift = await this.service.create(data);
      return this.wrapSuccess(shift);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async update(id: number, data: Partial<schema.InsertEmployeeShift>) {
    try {
      const shift = await this.service.update(id, data);
      if (!shift) {
        return { success: false, error: 'Shift not found' };
      }
      return this.wrapSuccess(shift);
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
