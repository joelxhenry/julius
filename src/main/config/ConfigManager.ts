import CryptoJS from 'crypto-js';
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { AppConfig, MachineRole } from './types';

export class ConfigManager {
  private configPath: string;
  /** Key used for all new writes. Stable across app updates. */
  private encryptionKey: string;
  /**
   * Legacy key derived from the install path (process.cwd()). Squirrel installs
   * every version into a different `app-<version>` directory, so this key is
   * version-specific. We keep it only to decrypt — and then migrate — configs
   * that were written before the encryption key was made update-stable.
   */
  private legacyEncryptionKey: string;

  constructor() {
    this.encryptionKey = this.deriveKey(this.getStableSeed());
    this.legacyEncryptionKey = this.deriveKey(process.cwd());

    // Determine config path based on environment
    if (app && app.isReady && app.isReady()) {
      this.configPath = path.join(app.getPath('userData'), 'config.json');
    } else {
      // CLI/test mode - use local directory
      this.configPath = path.join(process.cwd(), 'config.json');
    }
  }

  /**
   * Seed for the encryption key. It MUST stay constant across app updates, so it
   * must NOT depend on the versioned install directory (process.cwd()), which
   * Squirrel changes on every update — that would leave the stored DB password
   * undecryptable after an update and force users to reconnect. `userData` is a
   * stable per-user location; hostname is a stable fallback for CLI/test runs.
   */
  private getStableSeed(): string {
    if (app && app.isReady && app.isReady()) {
      return app.getPath('userData');
    }
    return os.hostname();
  }

  private deriveKey(seed: string): string {
    return CryptoJS.SHA256(`turbo-julius:${seed}`).toString();
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

      // Decrypt password, tolerating configs written under the old install-path key.
      if (config.database.password) {
        const { value, legacy } = this.decryptWithFallback(config.database.password);
        if (value !== null) {
          config.database.password = value;
          // Written under the legacy (install-path) key — re-save now so it
          // survives the next update under the stable key.
          if (legacy) {
            try {
              this.save(config);
              console.log('Migrated stored DB password to the update-stable encryption key.');
            } catch (migrationError) {
              console.warn('Password key migration re-save failed:', migrationError);
            }
          }
        } else {
          // Undecryptable — e.g. this install updated before the key was made
          // stable. Clear it so the app prompts for credentials rather than
          // failing to connect with an unusable value.
          console.warn('Stored DB password could not be decrypted; clearing it so the user is prompted.');
          config.database.password = '';
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
   * Decrypt with the current (stable) key, falling back to the legacy
   * install-path key. Returns the plaintext plus whether the legacy key was
   * needed, so the caller can migrate the file to the stable key.
   *
   * A wrong key yields empty/garbage output (or throws on UTF-8 conversion),
   * so each candidate that produces a non-empty string is accepted in order.
   */
  private decryptWithFallback(ciphertext: string): { value: string | null; legacy: boolean } {
    const candidates: Array<{ key: string; legacy: boolean }> = [
      { key: this.encryptionKey, legacy: false },
      { key: this.legacyEncryptionKey, legacy: true },
    ];

    for (const { key, legacy } of candidates) {
      try {
        const text = CryptoJS.AES.decrypt(ciphertext, key).toString(CryptoJS.enc.Utf8);
        if (text && text.length > 0) {
          return { value: text, legacy };
        }
      } catch {
        // Wrong key — malformed UTF-8. Try the next candidate.
      }
    }

    return { value: null, legacy: false };
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
