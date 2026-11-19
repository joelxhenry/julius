import { DatabaseSettingsService } from '../services/DatabaseSettingsService';
import { DatabaseConfig } from '../config/types';
import { reportError } from '../services/errorSanitizer';

export class DatabaseSettingsController {
  constructor(private service: DatabaseSettingsService) {}

  async getConfig() {
    try {
      const config = await this.service.getConfig();
      return { success: true, data: config };
    } catch (error) {
      return {
        success: false,
        error: reportError(error, 'Unknown error', 'DatabaseSettingsController'),
      };
    }
  }

  async updateConfig(newConfig: DatabaseConfig) {
    try {
      await this.service.updateConfig(newConfig);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: reportError(error, 'Unknown error', 'DatabaseSettingsController'),
      };
    }
  }

  async testConnection(testConfig: DatabaseConfig) {
    try {
      const result = await this.service.testConnection(testConfig);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: reportError(error, 'Unknown error', 'DatabaseSettingsController'),
      };
    }
  }
}
