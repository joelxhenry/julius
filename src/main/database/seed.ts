import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import * as schema from './schema/index';
import { seedBaseVariants } from './seedBaseVariants';
import { seedMultiValueFields } from './seedMultiValueFields';

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
 * Run all database seeds
 */
export async function runSeeds(db: NodePgDatabase<typeof schema>): Promise<void> {
  console.log('Running database seeds...');

  try {
    await seedSuperUser(db);
    await seedBaseVariants(db);
    await seedMultiValueFields(db);
    console.log('Database seeding completed successfully');
  } catch (error) {
    console.error('Database seeding failed:', error);
    throw error;
  }
}
