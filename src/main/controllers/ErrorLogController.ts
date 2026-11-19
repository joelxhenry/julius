import { BaseController } from './BaseController';
import { ErrorLogService, ErrorLogQueryParams } from '../services/ErrorLogService';

export class ErrorLogController extends BaseController<ErrorLogService> {
  constructor(service: ErrorLogService) {
    super(service);
  }

  async getPaginated(params: ErrorLogQueryParams = {}) {
    try {
      const result = await this.service.findPaginated(params);
      return this.wrapSuccess(result);
    } catch (error) {
      return this.handleError(error, 'ErrorLogController.getPaginated');
    }
  }

  async markResolved(id: number, resolvedBy: string) {
    try {
      const log = await this.service.markResolved(id, resolvedBy);
      return this.wrapSuccess(log);
    } catch (error) {
      return this.handleError(error, 'ErrorLogController.markResolved');
    }
  }
}
