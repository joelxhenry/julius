import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import * as schema from './schema/index';
import { seedBaseVariants } from './seedBaseVariants';
import { seedMultiValueFields } from './seedMultiValueFields';
import { seedCancelEmptyInvoices } from './seedCancelEmptyInvoices';
import { seedCanonicalizePaymentMethods } from './seedCanonicalizePaymentMethods';

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export interface SuperUserConfig {
  code?: string;
  username?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
}

const DEFAULT_SUPER_USER: SuperUserConfig = {
  code: 'ADMIN',
  username: 'admin',
  password: 'admin123',
  firstName: 'System',
  lastName: 'Administrator',
};

/**
 * Seeds the database with a super user if one doesn't exist
 * The super user has ADMIN permission which bypasses all permission checks
 */
export async function seedSuperUser(
  db: NodePgDatabase<typeof schema>,
  config: SuperUserConfig = {}
): Promise<{ created: boolean; username: string }> {
  const superUserConfig = { ...DEFAULT_SUPER_USER, ...config };

  // Check if super user already exists by username
  const existingByUsername = await db
    .select()
    .from(schema.employees)
    .where(eq(schema.employees.username, superUserConfig.username!))
    .limit(1);

  if (existingByUsername.length > 0) {
    console.log(`Super user '${superUserConfig.username}' already exists, skipping seed`);
    return { created: false, username: superUserConfig.username! };
  }

  // Check if super user exists by code
  const existingByCode = await db
    .select()
    .from(schema.employees)
    .where(eq(schema.employees.code, superUserConfig.code!))
    .limit(1);

  if (existingByCode.length > 0) {
    console.log(`Employee with code '${superUserConfig.code}' already exists, skipping seed`);
    return { created: false, username: superUserConfig.username! };
  }

  // Create super user with ADMIN permission
  const hashedPassword = hashPassword(superUserConfig.password!);

  await db.insert(schema.employees).values({
    code: superUserConfig.code!,
    username: superUserConfig.username!,
    passwordHash: hashedPassword,
    firstName: superUserConfig.firstName!,
    lastName: superUserConfig.lastName!,
    title: 'System Administrator',
    department: 'Administration',
    status: 'active',
    isSalesperson: false,
    permissions: { ADMIN: true },
    accessCodes: {},
  });

  console.log(`Super user '${superUserConfig.username}' created successfully`);
  console.log(`  Code: ${superUserConfig.code}`);
  console.log(`  Username: ${superUserConfig.username}`);
  console.log(`  Password: ${superUserConfig.password}`);
  console.log('  ⚠️  Please change the default password after first login!');

  return { created: true, username: superUserConfig.username! };
}

/**
 * Run critical database seeds that must complete before the app is usable.
 * Heavy/idempotent backfills (e.g. base variants) run separately via runBackgroundSeeds.
 */
export async function runSeeds(db: NodePgDatabase<typeof schema>): Promise<void> {
  console.log('Running database seeds...');

  try {
    await seedSuperUser(db);
    console.log('Database seeding completed successfully');
  } catch (error) {
    console.error('Database seeding failed:', error);
    throw error;
  }
}

export type SeedProgressStatus = 'started' | 'completed' | 'error';
export interface SeedProgressEvent {
  task: string;
  label: string;
  status: SeedProgressStatus;
  message?: string;
}
export type SeedProgressReporter = (event: SeedProgressEvent) => void;

/**
 * Run idempotent background seeds. Safe to run after the window is shown - these
 * backfills can take a while on large datasets and must not block startup.
 */
export async function runBackgroundSeeds(
  db: NodePgDatabase<typeof schema>,
  report?: SeedProgressReporter
): Promise<void> {
  const tasks: { task: string; label: string; run: () => Promise<void> }[] = [
    { task: 'baseVariants', label: 'Updating inventory variants', run: () => seedBaseVariants(db) },
    { task: 'multiValueFields', label: 'Updating multi-value fields', run: () => seedMultiValueFields(db) },
    { task: 'cancelEmptyInvoices', label: 'Cancelling empty invoices', run: () => seedCancelEmptyInvoices(db) },
    { task: 'canonicalizePaymentMethods', label: 'Normalizing payment methods', run: () => seedCanonicalizePaymentMethods(db) },
  ];

  for (const { task, label, run } of tasks) {
    report?.({ task, label, status: 'started' });
    try {
      await run();
      report?.({ task, label, status: 'completed' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Background seed '${task}' failed:`, error);
      report?.({ task, label, status: 'error', message });
    }
  }
}
