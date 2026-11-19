import { BaseController } from './BaseController';
import { UserSessionService, UserSessionQueryParams } from '../services/UserSessionService';

export class UserSessionController extends BaseController<UserSessionService> {
  constructor(service: UserSessionService) {
    super(service);
  }

  async recordLogin(data: { employeeId: number; employeeName: string; username: string }) {
    try {
      if (!data.employeeId) {
        return { success: false, error: 'employeeId is required' };
      }
      const session = await this.service.recordLogin(data);
      return this.wrapSuccess(session);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async recordLogout(id: number, reason?: 'manual' | 'idle_timeout') {
    try {
      const session = await this.service.recordLogout(id, reason);
      return this.wrapSuccess(session);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getPaginated(params: UserSessionQueryParams = {}) {
    try {
      const result = await this.service.findPaginated(params);
      return this.wrapSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }
}
