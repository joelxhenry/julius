import { ConfigManager } from '../config/ConfigManager';
import { testDatabaseConnection } from '../database';
import { DatabaseConfig } from '../config/types';

export class DatabaseSettingsService {
  private configManager: ConfigManager;

  constructor() {
    this.configManager = new ConfigManager();
  }

  async getConfig(): Promise<Omit<DatabaseConfig, 'password'>> {
    const config = this.configManager.load();
    const { password, ...safeConfig } = config.database;
    return safeConfig;
  }

  async updateConfig(newConfig: DatabaseConfig): Promise<void> {
    const config = this.configManager.load();
    config.database = newConfig;
    this.configManager.save(config);
  }

  async testConnection(
    testConfig: DatabaseConfig
  ): Promise<{ success: boolean; error?: string }> {
    return await testDatabaseConnection(testConfig);
  }
}
