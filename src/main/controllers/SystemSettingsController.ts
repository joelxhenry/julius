import { SystemSettingsService } from '../services/SystemSettingsService';

export class SystemSettingsController {
  constructor(private service: SystemSettingsService) {}

  private handleError(error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  private wrapSuccess<T>(data: T) {
    return { success: true, data };
  }

  async getAll() {
    try {
      const settings = await this.service.getAll();
      return this.wrapSuccess(settings);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getVisible() {
    try {
      const settings = await this.service.getVisible();
      return this.wrapSuccess(settings);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByGroup(group: string) {
    try {
      const settings = await this.service.getByGroup(group);
      return this.wrapSuccess(settings);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getByKey(key: string) {
    try {
      const setting = await this.service.getByKey(key);
      if (!setting) {
        return { success: false, error: 'Setting not found' };
      }
      return this.wrapSuccess(setting);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getValue(key: string) {
    try {
      const value = await this.service.getValue(key);
      return this.wrapSuccess({ key, value });
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getTaxRate() {
    try {
      const taxRate = await this.service.getTaxRate();
      return this.wrapSuccess({ taxRate });
    } catch (error) {
      return this.handleError(error);
    }
  }

  async setValue(key: string, value: string) {
    try {
      const setting = await this.service.setValue(key, value);
      if (!setting) {
        return { success: false, error: 'Setting not found' };
      }
      return this.wrapSuccess(setting);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async upsert(
    key: string,
    value: string,
    group: string,
    description?: string,
    readonly = false,
    visible = true
  ) {
    try {
      const setting = await this.service.upsert(key, value, group, description, readonly, visible);
      return this.wrapSuccess(setting);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async deleteByKey(key: string) {
    try {
      await this.service.deleteByKey(key);
      return this.wrapSuccess({ deleted: true });
    } catch (error) {
      return this.handleError(error);
    }
  }

  async initializeDefaults() {
    try {
      await this.service.initializeDefaults();
      return this.wrapSuccess({ initialized: true });
    } catch (error) {
      return this.handleError(error);
    }
  }
}
