import { BaseController } from './BaseController';
import { GoodsReceivalService, ReceivalQueryParams, PostReceivalInput } from '../services/GoodsReceivalService';
import { ReceivalImportService } from '../services/ReceivalImportService';

export class GoodsReceivalController extends BaseController<GoodsReceivalService> {
  constructor(
    service: GoodsReceivalService,
    private importService: ReceivalImportService
  ) {
    super(service);
  }

  async post(input: PostReceivalInput) {
    try {
      const result = await this.service.postReceival(input);
      return this.wrapSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getPaginated(params: ReceivalQueryParams = {}) {
    try {
      const result = await this.service.findAllPaginated(params);
      return this.wrapSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getById(id: number) {
    try {
      const result = await this.service.findWithLines(id);
      if (!result) return { success: false, error: 'Receival not found' };
      return this.wrapSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async parseImport() {
    try {
      const result = await this.importService.parseFromDialog();
      return this.wrapSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }
}
