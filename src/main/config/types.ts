export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  maxConnections?: number;
}

/**
 * Whether this machine hosts the shared PostgreSQL + file storage ('host') or
 * connects to a host over the LAN ('client'). Chosen during first-run setup.
 */
export type MachineRole = 'host' | 'client';

export interface AppConfig {
  database: DatabaseConfig;
  version: string;
  /** Machine role selected in the first-run wizard. */
  role?: MachineRole;
  /**
   * True once the first-run wizard has completed. Absent on installs that
   * predate the wizard (treated as already set up); explicitly `false` on a
   * fresh default config so the wizard runs.
   */
  setupCompleted?: boolean;
}
