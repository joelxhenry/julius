import { BaseController } from './BaseController';
import { ExportService } from '../services/ExportService';
import { ExportRequest } from '../../shared/types/export';

export class ExportController extends BaseController<ExportService> {
  async exportReport(params: ExportRequest) {
    try {
      const data = await this.service.exportReport(params);
      return this.wrapSuccess(data);
    } catch (error) {
      return this.handleError(error);
    }
  }
}
