/**
 * Legacy JSON importer
 * =====================
 *
 * Loads the legacy data export (`julius.json`, produced by the DBF extractor)
 * into the current PostgreSQL schema, then hands off to the existing background
 * seeders for the large normalizations (base variants, multi-value fields,
 * empty-invoice cancellation, payment-method canonicalization).
 *
 * Why a bespoke loader and not the seeders alone:
 *   The export is ALREADY shaped to the new schema - every table name and every
 *   column name in `julius.json` matches a table/column in `schema/*.ts`. So the
 *   loader's job is a faithful, bulk, id-preserving copy. All the messy
 *   normalization work lives in the seeders and runs afterwards, unchanged.
 *
 * Design notes:
 *   - Streams the (very large, ~340 MB) file table-by-table so memory stays
 *     bounded. The export is pretty-printed, so records are extracted line by
 *     line with a string-aware brace counter.
 *   - Every value is passed to PostgreSQL as-is (number / string / bool / null)
 *     via bound parameters; PostgreSQL performs the text -> numeric/date/timestamp
 *     coercion. This preserves values exactly, including legacy garbage dates
 *     (e.g. year 8201) which are valid PostgreSQL dates, and never shifts a
 *     timestamp across time zones.
 *   - Legacy `id` values are preserved (child tables reference them), and each
 *     serial sequence is reset to MAX(id)+1 afterwards.
 *   - Foreign-key enforcement is disabled for the load via
 *     `session_replication_role = replica` (requires a superuser connection, which
 *     the default `postgres` user is). This lets orphaned legacy references load
 *     as the legacy system actually held them. If the connecting role is not a
 *     superuser the loader continues with FK checks on and relies on the
 *     FK-safe table order below (orphan rows would then error).
 *
 * Prerequisites: the schema must already exist (run `npm run db:migrate` first).
 *
 * Usage:
 *   npx tsx src/main/database/importLegacyJson.ts [options]
 *   npm run db:import:legacy -- [options]
 *
 * Options:
 *   --file=<path>     Path to the export (default: ./julius.json)
 *   --truncate        TRUNCATE all target tables (RESTART IDENTITY CASCADE) first.
 *                     Required for a re-run; without it the loader refuses to run
 *                     against a non-empty database.
 *   --no-seed         Skip the post-import normalization seeders.
 *   --batch=<n>       Max rows per multi-row INSERT (default: auto, capped by the
 *                     PostgreSQL 65535-parameter limit).
 *   --dry-run         Parse and count everything but write nothing.
 *   --config=<path>   Explicit config.json to read the connection from.
 *   --host= --port= --db= --user= --password= --ssl
 *                     Override individual connection fields.
 *
 * IMPORTANT (npm): flags must come after `--`, e.g.
 *   npm run db:import:legacy -- --dry-run
 * Without the `--`, npm consumes the flag and it never reaches the script.
 *
 * Connection resolution (highest precedence first):
 *   1. CLI flags (--host/--port/--db/--user/--password/--ssl)
 *   2. Environment (DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD, then libpq PG*)
 *   3. A config.json: --config=<path>, else the app's userData config
 *      (<appData>/turbo-julius/config.json), else ./config.json. The password is
 *      decrypted with the same scheme as ConfigManager (key = SHA256(
 *      "turbo-julius:" + cwd)), so run this from the project root - the same cwd
 *      the app used - for decryption to succeed.
 *   4. Built-in defaults (localhost:5432/turbo_julius).
 */

import fs from 'node:fs';
import os from 'node:os';
import readline from 'node:readline';
import path from 'node:path';
import CryptoJS from 'crypto-js';
import { Pool, PoolClient } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema/index';
import { runSeeds, runBackgroundSeeds } from './seed';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

interface DbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
}

interface Options {
  file: string;
  truncate: boolean;
  seed: boolean;
  batch: number | null;
  dryRun: boolean;
  configPath: string | null;
  overrides: Partial<DbConfig>;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    file: path.resolve(process.cwd(), 'julius.json'),
    truncate: false,
    seed: true,
    batch: null,
    dryRun: false,
    configPath: null,
    overrides: {},
  };
  for (const arg of argv) {
    if (arg === '--truncate') opts.truncate = true;
    else if (arg === '--no-seed') opts.seed = false;
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg.startsWith('--file=')) opts.file = path.resolve(process.cwd(), arg.slice('--file='.length));
    else if (arg.startsWith('--batch=')) opts.batch = Math.max(1, parseInt(arg.slice('--batch='.length), 10) || 0) || null;
    else if (arg.startsWith('--config=')) opts.configPath = path.resolve(process.cwd(), arg.slice('--config='.length));
    else if (arg.startsWith('--host=')) opts.overrides.host = arg.slice('--host='.length);
    else if (arg.startsWith('--port=')) opts.overrides.port = parseInt(arg.slice('--port='.length), 10);
    else if (arg.startsWith('--db=')) opts.overrides.database = arg.slice('--db='.length);
    else if (arg.startsWith('--database=')) opts.overrides.database = arg.slice('--database='.length);
    else if (arg.startsWith('--user=')) opts.overrides.user = arg.slice('--user='.length);
    else if (arg.startsWith('--password=')) opts.overrides.password = arg.slice('--password='.length);
    else if (arg === '--ssl') opts.overrides.ssl = true;
    else if (arg === '--help' || arg === '-h') { printHelp(); process.exit(0); }
    else console.warn(`Unknown argument ignored: ${arg}`);
  }
  return opts;
}

function printHelp(): void {
  console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^\/\*\*?/, '').replace(/^ \* ?/gm, ''));
}

/**
 * The Electron `app.getPath('userData')` location, resolved WITHOUT importing
 * electron (this script runs under plain node/tsx). Mirrors Electron's default:
 * <appData>/<productName>, with productName = "turbo-julius".
 */
function userDataConfigPath(): string {
  const product = 'turbo-julius';
  let appData: string;
  if (process.platform === 'win32') appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  else if (process.platform === 'darwin') appData = path.join(os.homedir(), 'Library', 'Application Support');
  else appData = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(appData, product, 'config.json');
}

const ENCRYPTED_PREFIX = 'U2FsdGVk'; // CryptoJS "Salted__" base64 marker

/**
 * Decrypt a password using the same scheme as
 * src/main/config/ConfigManager.ts (AES with key = SHA256("turbo-julius:" + cwd)).
 * Returns the plaintext, or the original value if it is not encrypted / cannot
 * be decrypted with the current working directory's key.
 */
function decryptPassword(value: string): string {
  if (!value.startsWith(ENCRYPTED_PREFIX)) return value; // already plaintext
  const key = CryptoJS.SHA256(`turbo-julius:${process.cwd()}`).toString();
  try {
    const out = CryptoJS.AES.decrypt(value, key).toString(CryptoJS.enc.Utf8);
    return out && out.length > 0 ? out : value;
  } catch {
    return value;
  }
}

/**
 * Resolve the database connection. Precedence (highest first):
 *   1. CLI flags (--host/--port/--db/--user/--password/--ssl)
 *   2. Environment variables (DB_* preferred, then libpq PG*)
 *   3. A config.json: --config=<path>, else the app's userData config, else the
 *      project-root config.json. The password is decrypted like the app does.
 *   4. Built-in defaults.
 */
function resolveDbConfig(opts: Options): { cfg: DbConfig; source: string } {
  let cfg: DbConfig = {
    host: 'localhost',
    port: 5432,
    database: 'turbo_julius',
    user: 'postgres',
    password: 'postgres',
    ssl: false,
  };
  let source = 'defaults';

  // (3) config file
  const candidates = [
    opts.configPath,
    userDataConfigPath(),
    path.resolve(process.cwd(), 'config.json'),
  ].filter((p): p is string => !!p);
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
      const d = raw?.database;
      if (d && d.host) {
        cfg = {
          host: d.host,
          port: Number(d.port) || 5432,
          database: d.database || cfg.database,
          user: d.user || cfg.user,
          password: decryptPassword(String(d.password ?? '')),
          ssl: !!d.ssl,
        };
        source = p;
        break;
      }
    } catch {
      // try next candidate
    }
  }

  // (2) environment
  const env = process.env;
  if (env.DB_HOST || env.PGHOST) { cfg.host = env.DB_HOST || env.PGHOST!; source = 'env'; }
  if (env.DB_PORT || env.PGPORT) cfg.port = parseInt(env.DB_PORT || env.PGPORT!, 10);
  if (env.DB_NAME || env.PGDATABASE) cfg.database = env.DB_NAME || env.PGDATABASE!;
  if (env.DB_USER || env.PGUSER) cfg.user = env.DB_USER || env.PGUSER!;
  if (env.DB_PASSWORD || env.PGPASSWORD) cfg.password = env.DB_PASSWORD || env.PGPASSWORD!;

  // (1) explicit flags
  const o = opts.overrides;
  if (o.host !== undefined) { cfg.host = o.host; source = 'flags'; }
  if (o.port !== undefined) cfg.port = o.port;
  if (o.database !== undefined) cfg.database = o.database;
  if (o.user !== undefined) cfg.user = o.user;
  if (o.password !== undefined) cfg.password = o.password;
  if (o.ssl !== undefined) cfg.ssl = o.ssl;

  return { cfg, source };
}

/**
 * Every table owned by the schema, ordered parent -> child so the load is
 * foreign-key-safe even when FK enforcement cannot be disabled. Tables not
 * present in the export are still listed here so `--truncate` clears them.
 */
const TABLE_ORDER: string[] = [
  'branches',
  'categories',
  'payment_methods',
  'system_settings',
  'gct_payments',
  'roles',
  'clients',
  'suppliers',
  'employees',
  'inventory',
  'variants',
  'inventory_alternates',
  'inventory_categories',
  'inventory_markup',
  'inventory_transactions',
  'goods_receivals',
  'inventory_receiving',
  'inventory_images',
  'invoices',
  'quotations',
  'credit_notes',
  'bills',
  'document_line_items',
  'payments',
  'employee_attendance',
  'employee_shifts',
  'access_overrides',
];

// PostgreSQL caps a single statement at 65535 bound parameters.
const MAX_PARAMS = 60000;

// ---------------------------------------------------------------------------
// Streaming record extraction
//
// The export is pretty-printed:
//     "tableName": [
//       {
//         "col": value,
//         ...
//       },
//       ...
//     ]
// A record starts at a line beginning with exactly six spaces + "{" and ends at
// a line beginning with six spaces + "}". Records contain only scalar values (no
// nested objects/arrays), and JSON strings cannot contain literal newlines, so
// this framing is exact for this file.
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

interface TableSink {
  /** Called once per fully-parsed record. */
  onRecord(table: string, row: Row): Promise<void>;
  /** Called when a table's array closes. */
  onTableEnd(table: string): Promise<void>;
}

const TABLE_START = /^    "([A-Za-z0-9_]+)": \[/;
const TABLE_END = /^    \]/;
const RECORD_START = /^ {6}\{/;
const RECORD_END = /^ {6}\}/;

async function streamTables(file: string, sink: TableSink): Promise<void> {
  const rl = readline.createInterface({
    input: fs.createReadStream(file, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let curTable: string | null = null;
  let inRecord = false;
  let recLines: string[] = [];

  for await (const line of rl) {
    const startMatch = line.match(TABLE_START);
    if (startMatch) {
      if (curTable) await sink.onTableEnd(curTable);
      curTable = startMatch[1];
      inRecord = false;
      recLines = [];
      continue;
    }
    if (!curTable) continue;

    if (TABLE_END.test(line)) {
      await sink.onTableEnd(curTable);
      curTable = null;
      inRecord = false;
      recLines = [];
      continue;
    }

    if (!inRecord && RECORD_START.test(line)) {
      inRecord = true;
      recLines = [line];
      if (RECORD_END.test(line)) {
        // Single-line record (defensive; this export never emits them).
        await emit(sink, curTable, recLines);
        inRecord = false;
        recLines = [];
      }
      continue;
    }

    if (inRecord) {
      recLines.push(line);
      if (RECORD_END.test(line)) {
        await emit(sink, curTable, recLines);
        inRecord = false;
        recLines = [];
      }
    }
  }

  if (curTable) await sink.onTableEnd(curTable);
}

async function emit(sink: TableSink, table: string, lines: string[]): Promise<void> {
  const text = lines.join('\n').trim().replace(/,\s*$/, '');
  let row: Row;
  try {
    row = JSON.parse(text) as Row;
  } catch (e) {
    throw new Error(`Failed to parse a record in table "${table}": ${(e as Error).message}\n${text.slice(0, 500)}`);
  }
  await sink.onRecord(table, row);
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

function quoteIdent(id: string): string {
  return `"${id.replace(/"/g, '""')}"`;
}

class TableLoader {
  columns: string[] | null = null;
  rowsPerBatch = 0;
  buffer: Row[] = [];
  total = 0;

  constructor(
    private table: string,
    private client: PoolClient,
    private batchOverride: number | null,
    private dryRun: boolean,
  ) {}

  private init(row: Row): void {
    this.columns = Object.keys(row);
    const cap = this.batchOverride ?? Math.floor(MAX_PARAMS / Math.max(1, this.columns.length));
    this.rowsPerBatch = Math.max(1, Math.min(cap, 5000));
  }

  async add(row: Row): Promise<void> {
    if (!this.columns) this.init(row);
    this.buffer.push(row);
    if (this.buffer.length >= this.rowsPerBatch) await this.flush();
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0 || !this.columns) return;
    const rows = this.buffer;
    this.buffer = [];
    this.total += rows.length;

    if (this.dryRun) return;

    const cols = this.columns;
    const params: unknown[] = [];
    const tuples: string[] = [];
    let p = 1;
    for (const row of rows) {
      const placeholders: string[] = [];
      for (const col of cols) {
        // Missing key -> NULL (lets column defaults apply where nullable).
        const v = Object.prototype.hasOwnProperty.call(row, col) ? row[col] : null;
        params.push(v === undefined ? null : v);
        placeholders.push(`$${p++}`);
      }
      tuples.push(`(${placeholders.join(',')})`);
    }

    const colList = cols.map(quoteIdent).join(',');
    const sqlText =
      `INSERT INTO ${quoteIdent(this.table)} (${colList}) VALUES ${tuples.join(',')} ` +
      `ON CONFLICT DO NOTHING`;

    await this.client.query(sqlText, params);
  }
}

async function canSetReplicaRole(client: PoolClient): Promise<boolean> {
  try {
    await client.query(`SET session_replication_role = replica`);
    return true;
  } catch {
    return false;
  }
}

async function truncateAll(client: PoolClient): Promise<void> {
  const list = TABLE_ORDER.map(quoteIdent).join(', ');
  console.log('Truncating all target tables (RESTART IDENTITY CASCADE)...');
  await client.query(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}

async function assertEmpty(client: PoolClient): Promise<void> {
  const nonEmpty: string[] = [];
  for (const t of TABLE_ORDER) {
    const { rows } = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM ${quoteIdent(t)} LIMIT 1) AS exists`,
    );
    if (rows[0]?.exists) nonEmpty.push(t);
  }
  if (nonEmpty.length > 0) {
    throw new Error(
      `Refusing to import: the following tables already contain data: ${nonEmpty.join(', ')}.\n` +
        `Re-run with --truncate to replace all data, or point at a fresh database.`,
    );
  }
}

async function resetSequences(client: PoolClient, tablesWithId: string[]): Promise<void> {
  console.log('Resetting id sequences...');
  for (const t of tablesWithId) {
    await client.query(
      `SELECT setval(
         pg_get_serial_sequence($1, 'id'),
         GREATEST((SELECT COALESCE(MAX(id), 0) FROM ${quoteIdent(t)}), 1),
         (SELECT COUNT(*) > 0 FROM ${quoteIdent(t)})
       )
       WHERE pg_get_serial_sequence($1, 'id') IS NOT NULL`,
      [t],
    );
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(opts.file)) {
    throw new Error(`Export file not found: ${opts.file}`);
  }

  const { cfg, source } = resolveDbConfig(opts);
  const passwordKnown = cfg.password.length > 0 && !cfg.password.startsWith(ENCRYPTED_PREFIX);
  console.log('Legacy JSON importer');
  console.log(`  file:     ${opts.file}`);
  console.log(`  database: ${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database}${cfg.ssl ? ' (ssl)' : ''}`);
  console.log(`  config:   ${source}`);
  console.log(`  password: ${passwordKnown ? 'resolved' : 'NOT RESOLVED (still encrypted / empty)'}`);
  console.log(`  truncate: ${opts.truncate}   seed: ${opts.seed}   dry-run: ${opts.dryRun}`);
  console.log('');

  if (!passwordKnown) {
    console.warn(
      'WARNING: the database password could not be resolved to plaintext. If the connection\n' +
        '         fails, pass it explicitly with --password=<pw> (or set DB_PASSWORD).\n',
    );
  }

  const pool = new Pool({
    host: cfg.host,
    port: cfg.port,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    ssl: cfg.ssl ? { rejectUnauthorized: false } : false,
    max: 5,
    connectionTimeoutMillis: 15000,
  });

  let client: PoolClient;
  try {
    client = await pool.connect();
  } catch (err) {
    const code = (err as { code?: string }).code;
    console.error(`\nCould not connect to ${cfg.host}:${cfg.port} - ${(err as Error).message}`);
    if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'ENOTFOUND') {
      console.error(
        'The database server is not reachable at that address. Check that:\n' +
          `  - PostgreSQL is running and listening on ${cfg.host}:${cfg.port}\n` +
          '  - the host/port are correct (override with --host= / --port= if needed)\n' +
          '  - any VPN / firewall required to reach a remote host is connected',
      );
    } else if (code === '28P01' || code === '28000') {
      console.error('Authentication failed. Pass the correct password with --password=<pw>.');
    }
    await pool.end().catch(() => {});
    process.exit(1);
  }

  const counts: Record<string, number> = {};
  const loadedTablesWithId: string[] = [];
  const started = Date.now();

  try {
    await client.query('BEGIN');

    const replica = await canSetReplicaRole(client);
    console.log(
      replica
        ? 'Foreign-key enforcement disabled for load (session_replication_role = replica).'
        : 'WARNING: could not disable FK enforcement (not a superuser). Loading with FK checks on;\n' +
            '         orphaned legacy references will cause errors. Consider connecting as a superuser.',
    );

    if (opts.truncate) {
      await truncateAll(client);
    } else if (!opts.dryRun) {
      await assertEmpty(client);
    }

    // Only import tables the schema actually owns; skip unknown tables in the
    // export (there are none today, but this keeps the loader safe if the export
    // grows). Import happens in file order, which the streamer preserves.
    const known = new Set(TABLE_ORDER);
    let current: TableLoader | null = null;
    let currentName: string | null = null;

    const sink: TableSink = {
      async onRecord(table, row) {
        if (!known.has(table)) return;
        if (currentName !== table) {
          currentName = table;
          current = new TableLoader(table, client, opts.batch, opts.dryRun);
        }
        await current!.add(row);
      },
      async onTableEnd(table) {
        if (!known.has(table)) return;
        if (current && currentName === table) {
          await current.flush();
          counts[table] = (counts[table] ?? 0) + current.total;
          if (current.columns?.includes('id')) loadedTablesWithId.push(table);
          console.log(`  loaded ${table.padEnd(24)} ${counts[table].toLocaleString()} rows`);
          current = null;
          currentName = null;
        }
      },
    };

    console.log('Streaming and loading tables...');
    await streamTables(opts.file, sink);

    if (!opts.dryRun) {
      await resetSequences(client, [...new Set(loadedTablesWithId)]);
      await client.query(`SET session_replication_role = DEFAULT`);
    }

    await client.query('COMMIT');
    console.log('\nRaw load committed.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\nImport failed, transaction rolled back.');
    throw err;
  } finally {
    client.release();
  }

  const totalRows = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`\nTotal rows loaded: ${totalRows.toLocaleString()} across ${Object.keys(counts).length} tables ` +
    `in ${((Date.now() - started) / 1000).toFixed(1)}s`);

  // Post-import normalizations via the existing seeders (unless disabled).
  if (opts.seed && !opts.dryRun) {
    console.log('\nRunning normalization seeders...');
    const db = drizzle(pool, { schema });
    // runSeeds ensures the super user exists; runBackgroundSeeds performs the
    // large normalizations (base variants, multi-value fields, empty-invoice
    // cancellation, payment-method canonicalization).
    await runSeeds(db);
    await runBackgroundSeeds(db, (e) => {
      if (e.status === 'started') console.log(`  - ${e.label}...`);
      else if (e.status === 'completed') console.log(`    done: ${e.task}`);
      else console.error(`    ERROR in ${e.task}: ${e.message}`);
    });
    console.log('Normalization complete.');
  } else if (opts.dryRun) {
    console.log('\nDry run: no data written, seeders skipped.');
  } else {
    console.log('\nSeeders skipped (--no-seed).');
  }

  await pool.end();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
