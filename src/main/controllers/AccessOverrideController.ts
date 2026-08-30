import { BaseController } from './BaseController';
import { AccessOverrideService, AccessOverrideQueryParams } from '../services/AccessOverrideService';
import * as schema from '../database/schema';

export class AccessOverrideController extends BaseController<AccessOverrideService> {
  constructor(service: AccessOverrideService) {
    super(service);
  }

  async record(data: schema.InsertAccessOverride) {
    try {
      if (!data.permissionCode) {
        return { success: false, error: 'permissionCode is required' };
      }
      const override = await this.service.record(data);
      return this.wrapSuccess(override);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getRecent(params: AccessOverrideQueryParams = {}) {
    try {
      const overrides = await this.service.findRecent(params);
      return this.wrapSuccess(overrides);
    } catch (error) {
      return this.handleError(error);
    }
  }
}
