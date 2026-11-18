/**
 * One-time repair: ensure the five canonical payment methods exist and are
 * active in `payment_methods`.
 *
 * Why this exists: a background seeder used to upsert these rows on every
 * startup (see git history of seedCanonicalizePaymentMethods.ts), but it was
 * removed after the one-time legacy-data normalization it was built for had
 * already run everywhere. If a `payment_methods` row's `active` flag is ever
 * cleared outside the app (manual edit, bad import, etc.) there is currently
 * no seeder left to restore it, and every payment-method picker in the app
 * renders empty with no error (it just gets back an empty array).
 *
 * This script only INSERTs the 5 canonical rows (by code) or, if a row with
 * that code already exists, sets its `active` flag to true. It never touches
 * any other row, so any extra/legacy payment methods you may have are left
 * exactly as they are.
 *
 * Usage:
 *   npx tsx src/main/database/repairPaymentMethods.ts [options]
 *
 * Connection resolution (highest precedence first), same as db:import:legacy:
 *   1. CLI flags (--host/--port/--db/--user/--password/--ssl)
 *   2. Environment (DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD, then libpq PG*)
 *   3. The app's userData config (<appData>/turbo-julius/config.json), tried
 *      with both the current update-stable key and the legacy cwd-based key
 *      (whichever one actually encrypted the stored password).
 *   4. Built-in defaults (localhost:5432/turbo_julius).
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import CryptoJS from 'crypto-js';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from './schema/index';
import {
  CANONICAL_PAYMENT_TYPES,
  CANONICAL_METHOD_BY_TYPE,
} from '../../shared/constants/payments';

interface DbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
}

interface Overrides {
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean;
}

const DEFAULTS: DbConfig = {
  host: 'localhost',
  port: 5432,
  database: 'turbo_julius',
  user: 'postgres',
  password: 'postgres',
  ssl: false,
};

/** Same "turbo-julius" product name the running app uses for its userData dir. */
const PRODUCT = 'turbo-julius';

function userDataConfigPath(): string {
  let appData: string;
  if (process.platform === 'win32') appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  else if (process.platform === 'darwin') appData = path.join(os.homedir(), 'Library', 'Application Support');
  else appData = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(appData, PRODUCT, 'config.json');
}

/**
 * Try both encryption keys the real ConfigManager could have used: the
 * current update-stable key (seeded from the userData path) and the legacy
 * key (seeded from process.cwd(), used before the stability fix). Mirrors
 * ConfigManager.decryptWithFallback so this script works regardless of when
 * the stored config was last written.
 */
function decryptPassword(value: string, userDataPath: string): string | null {
  const candidates = [
    CryptoJS.SHA256(`turbo-julius:${path.dirname(userDataPath)}`).toString(),
    CryptoJS.SHA256(`turbo-julius:${process.cwd()}`).toString(),
  ];
  for (const key of candidates) {
    try {
      const out = CryptoJS.AES.decrypt(value, key).toString(CryptoJS.enc.Utf8);
      if (out) return out;
    } catch {
      // try next candidate
    }
  }
  return null;
}

function parseArgs(argv: string[]): Overrides {
  const overrides: Overrides = {};
  for (const arg of argv) {
    const [rawKey, rawValue] = arg.split('=');
    const value = rawValue ?? '';
    switch (rawKey) {
      case '--host': overrides.host = value; break;
      case '--port': overrides.port = parseInt(value, 10); break;
      case '--db': overrides.database = value; break;
      case '--user': overrides.user = value; break;
      case '--password': overrides.password = value; break;
      case '--ssl': overrides.ssl = true; break;
    }
  }
  return overrides;
}

function resolveConfig(): DbConfig {
  const overrides = parseArgs(process.argv.slice(2));

  const fromEnv: Overrides = {
    host: process.env.DB_HOST || process.env.PGHOST,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : undefined,
    database: process.env.DB_NAME || process.env.PGDATABASE,
    user: process.env.DB_USER || process.env.PGUSER,
    password: process.env.DB_PASSWORD || process.env.PGPASSWORD,
    ssl: process.env.DB_SSL === 'true' || process.env.PGSSLMODE === 'require' ? true : undefined,
  };

  let fromConfigFile: Overrides = {};
  const configPath = userDataConfigPath();
  if (fs.existsSync(configPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const d = raw?.database;
      if (d) {
        const password = d.password ? decryptPassword(String(d.password), configPath) : null;
        fromConfigFile = {
          host: d.host,
          port: d.port,
          database: d.database,
          user: d.user,
          password: password ?? undefined,
          ssl: d.ssl,
        };
        if (d.password && password === null) {
          console.warn(`Could not decrypt the stored DB password from ${configPath}; falling back to defaults/env/flags for it.`);
        }
      }
    } catch (err) {
      console.warn(`Could not read config at ${configPath}:`, err instanceof Error ? err.message : err);
    }
  } else {
    console.warn(`No config file found at ${configPath}; falling back to env/defaults.`);
  }

  const merged: DbConfig = {
    host: overrides.host ?? fromEnv.host ?? fromConfigFile.host ?? DEFAULTS.host,
    port: overrides.port ?? fromEnv.port ?? fromConfigFile.port ?? DEFAULTS.port,
    database: overrides.database ?? fromEnv.database ?? fromConfigFile.database ?? DEFAULTS.database,
    user: overrides.user ?? fromEnv.user ?? fromConfigFile.user ?? DEFAULTS.user,
    password: overrides.password ?? fromEnv.password ?? fromConfigFile.password ?? DEFAULTS.password,
    ssl: overrides.ssl ?? fromEnv.ssl ?? fromConfigFile.ssl ?? false,
  };
  return merged;
}

async function main() {
  const config = resolveConfig();
  console.log(`Connecting to ${config.user}@${config.host}:${config.port}/${config.database} ...`);

  const pool = new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
  });

  const db = drizzle(pool, { schema });

  try {
    const before = await db.select().from(schema.paymentMethods).where(eq(schema.paymentMethods.active, true));
    console.log(`Active payment methods before repair: ${before.length} (${before.map((m) => m.code).join(', ') || 'none'})`);

    for (const type of CANONICAL_PAYMENT_TYPES) {
      const { code, name } = CANONICAL_METHOD_BY_TYPE[type];
      await db
        .insert(schema.paymentMethods)
        .values({ code, name, active: true })
        .onConflictDoUpdate({
          target: schema.paymentMethods.code,
          set: { name, active: true },
        });
      console.log(`Ensured active: ${code} (${name})`);
    }

    const after = await db.select().from(schema.paymentMethods).where(eq(schema.paymentMethods.active, true));
    console.log(`Active payment methods after repair: ${after.length} (${after.map((m) => m.code).join(', ')})`);
  } finally {
    await pool.end();
  }
}

main()
  .then(() => {
    console.log('Done.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Repair failed:', err);
    process.exit(1);
  });
