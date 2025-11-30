import { BaseController } from './BaseController';
import { EmployeeAttendanceService, AttendanceQueryParams } from '../services/EmployeeAttendanceService';
import * as schema from '../database/schema';

export class EmployeeAttendanceController extends BaseController<EmployeeAttendanceService> {
  constructor(service: EmployeeAttendanceService) {
    super(service);
  }

  async getAll() {
    try {
      const records = await this.service.findAll();
      return this.wrapSuccess(records);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getPaginated(params: AttendanceQueryParams = {}) {
    try {
      const result = await this.service.findPaginated(params);
      return this.wrapSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getById(id: number) {
    try {
      const record = await this.service.findById(id);
      if (!record) {
        return { success: false, error: 'Attendance record not found' };
      }
      return this.wrapSuccess(record);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByEmployee(employeeId: number) {
    try {
      const records = await this.service.findByEmployee(employeeId);
      return this.wrapSuccess(records);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByDateRange(startDate: string, endDate: string, employeeId?: number) {
    try {
      const records = await this.service.findByDateRange(startDate, endDate, employeeId);
      return this.wrapSuccess(records);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getActiveClockIn(employeeId: number) {
    try {
      const record = await this.service.findActiveClockIn(employeeId);
      return this.wrapSuccess(record);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async clockIn(employeeId: number, notes?: string) {
    try {
      const record = await this.service.clockIn(employeeId, notes);
      return this.wrapSuccess(record);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async clockOut(employeeId: number, notes?: string) {
    try {
      const record = await this.service.clockOut(employeeId, notes);
      if (!record) {
        return { success: false, error: 'No active clock-in found' };
      }
      return this.wrapSuccess(record);
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

  async create(data: schema.InsertEmployeeAttendance) {
    try {
      const record = await this.service.create(data);
      return this.wrapSuccess(record);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async update(id: number, data: Partial<schema.InsertEmployeeAttendance>) {
    try {
      const record = await this.service.update(id, data);
      if (!record) {
        return { success: false, error: 'Attendance record not found' };
      }
      return this.wrapSuccess(record);
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
