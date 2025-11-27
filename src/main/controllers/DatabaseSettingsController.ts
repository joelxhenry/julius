import { DatabaseSettingsService } from '../services/DatabaseSettingsService';
import { DatabaseConfig } from '../config/types';

export class DatabaseSettingsController {
  constructor(private service: DatabaseSettingsService) {}

  async getConfig() {
    try {
      const config = await this.service.getConfig();
      return { success: true, data: config };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
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
        error: error instanceof Error ? error.message : 'Unknown error',
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
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
