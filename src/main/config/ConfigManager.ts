import CryptoJS from 'crypto-js';
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { AppConfig, MachineRole } from './types';

export class ConfigManager {
  private configPath: string;
  private encryptionKey: string;

  constructor() {
    // Get encryption key from machine-specific source
    this.encryptionKey = this.getEncryptionKey();

    // Determine config path based on environment
    if (app && app.isReady && app.isReady()) {
      this.configPath = path.join(app.getPath('userData'), 'config.json');
    } else {
      // CLI/test mode - use local directory
      this.configPath = path.join(process.cwd(), 'config.json');
    }
  }

  /**
   * Get machine-specific encryption key
   * Uses app name + installation path as seed for encryption
   */
  private getEncryptionKey(): string {
    const appName = 'turbo-julius';
    const installPath = process.cwd();

    // Create hash from app name and install path for encryption key
    const seed = `${appName}:${installPath}`;
    return CryptoJS.SHA256(seed).toString();
  }

  /**
   * Load configuration from file
   * Creates default config if file doesn't exist
   */
  public load(): AppConfig {
    try {
      // Ensure directory exists
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // Check if config file exists
      if (!fs.existsSync(this.configPath)) {
        console.log('Config file not found, creating default configuration');
        const defaultConfig = this.getDefaultConfig();
        this.save(defaultConfig);
        return defaultConfig;
      }

      // Read and parse config
      const configData = fs.readFileSync(this.configPath, 'utf-8');
      const config: AppConfig = JSON.parse(configData);

      // Decrypt password
      if (config.database.password) {
        try {
          const decrypted = this.decrypt(config.database.password);
          if (decrypted && decrypted.length > 0) {
            config.database.password = decrypted;
          } else {
            console.warn('Decrypted password is empty, using original value');
            // Password might already be in plain text
          }
        } catch (error) {
          console.warn('Failed to decrypt password, using as-is');
          // Keep the original password (might be plain text)
        }
      }

      return config;
    } catch (error) {
      console.error('Failed to load config:', error);
      console.log('Returning default configuration');
      return this.getDefaultConfig();
    }
  }

  /**
   * Save configuration to file
   * Encrypts password before saving
   */
  public save(config: AppConfig): void {
    try {
      // Clone config to avoid mutating original
      const configToSave = JSON.parse(JSON.stringify(config)) as AppConfig;

      // Encrypt password
      if (configToSave.database.password) {
        configToSave.database.password = this.encrypt(configToSave.database.password);
      }

      // Ensure directory exists
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // Write config
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(configToSave, null, 2),
        'utf-8'
      );

      // Set file permissions (user read/write only) - Unix-like systems
      if (process.platform !== 'win32') {
        fs.chmodSync(this.configPath, 0o600);
      }

      console.log('Configuration saved successfully');
    } catch (error) {
      console.error('Failed to save config:', error);
      throw new Error(`Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Encrypt text using AES-256
   */
  private encrypt(text: string): string {
    return CryptoJS.AES.encrypt(text, this.encryptionKey).toString();
  }

  /**
   * Decrypt text using AES-256
   */
  private decrypt(ciphertext: string): string {
    const bytes = CryptoJS.AES.decrypt(ciphertext, this.encryptionKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): AppConfig {
    return {
      database: {
        host: 'localhost',
        port: 5432,
        database: 'julius',
        user: 'postgres',
        password: 'password123',
        ssl: false,
        maxConnections: 20,
      },
      version: '1.0.0',
      // A brand-new install has not been through the first-run wizard yet.
      setupCompleted: false,
    };
  }

  /**
   * Whether the first-run wizard still needs to run.
   *
   * Only a freshly created default config (setupCompleted === false) triggers
   * setup. Installs predating the wizard have no flag (undefined) and are
   * treated as already configured, so existing users are never interrupted.
   */
  public needsSetup(): boolean {
    return this.load().setupCompleted === false;
  }

  /** Machine role chosen during setup, or null if not yet chosen. */
  public getRole(): MachineRole | null {
    return this.load().role ?? null;
  }

  /** Persist the chosen role and mark first-run setup as complete. */
  public completeSetup(role: MachineRole): void {
    const config = this.load();
    config.role = role;
    config.setupCompleted = true;
    this.save(config);
  }

  /**
   * Validate configuration
   */
  public validate(config: AppConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.database) {
      errors.push('Database configuration is required');
      return { valid: false, errors };
    }

    if (!config.database.host || config.database.host.trim().length === 0) {
      errors.push('Database host is required');
    }

    if (!config.database.port || config.database.port < 1 || config.database.port > 65535) {
      errors.push('Database port must be between 1 and 65535');
    }

    if (!config.database.database || config.database.database.trim().length === 0) {
      errors.push('Database name is required');
    }

    if (!config.database.user || config.database.user.trim().length === 0) {
      errors.push('Database user is required');
    }

    if (!config.database.password || config.database.password.trim().length === 0) {
      errors.push('Database password is required');
    }

    if (config.database.maxConnections && (config.database.maxConnections < 1 || config.database.maxConnections > 100)) {
      errors.push('Max connections must be between 1 and 100');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
