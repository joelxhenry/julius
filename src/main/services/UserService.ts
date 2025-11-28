import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, like, or } from 'drizzle-orm';
import * as schema from '../database/schema';
import { BaseService } from './BaseService';
import crypto from 'crypto';

const DEFAULT_PIN = '0000';
const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD = '0609';

// Hash function for PIN/password
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function verifyPassword(password: string, hash: string): boolean {
  // Check if stored as plain text (legacy/default) or hashed
  if (hash === password) {
    return true; // Plain text match (for default credentials)
  }
  return hashPassword(password) === hash;
}

export interface AuthResult {
  success: boolean;
  user?: Omit<schema.User, 'pinHash'>;
  error?: string;
  requiresPinChange?: boolean;
}

export class UserService extends BaseService<
  typeof schema.users,
  schema.User,
  schema.InsertUser
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.users);
  }

  // Override create to auto-generate default PIN if not provided
  async create(data: Partial<schema.InsertUser> & { firstName: string; lastName: string; username: string }): Promise<schema.User> {
    const insertData: schema.InsertUser = {
      ...data,
      pinHash: data.pinHash || DEFAULT_PIN,
      usingDefaultPin: data.pinHash ? false : true,
    };
    return super.create(insertData);
  }

  async findByUsername(username: string): Promise<schema.User | null> {
    const results = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.username, username))
      .limit(1);
    return results[0] || null;
  }

  async findByRole(roleId: number): Promise<schema.User[]> {
    return this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.roleId, roleId));
  }

  async findActive(): Promise<schema.User[]> {
    return this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.active, true));
  }

  async search(query: string): Promise<schema.User[]> {
    return this.db
      .select()
      .from(schema.users)
      .where(
        or(
          like(schema.users.firstName, `%${query}%`),
          like(schema.users.lastName, `%${query}%`),
          like(schema.users.username, `%${query}%`)
        )
      );
  }

  async updatePin(id: number, pinHash: string, usingDefaultPin: boolean = false): Promise<schema.User | null> {
    return this.update(id, { pinHash, usingDefaultPin });
  }

  async deactivateUser(id: number, endDate: string): Promise<schema.User | null> {
    return this.update(id, { endDate, active: false });
  }

  /**
   * Authenticate a user with username and PIN/password
   * Supports default admin credentials (admin/0609) when no users exist
   */
  async authenticate(username: string, password: string): Promise<AuthResult> {
    // Check for default admin credentials
    if (username === DEFAULT_ADMIN_USERNAME && password === DEFAULT_ADMIN_PASSWORD) {
      // Check if any users exist in the database
      const allUsers = await this.findAll();

      if (allUsers.length === 0) {
        // No users exist, allow default admin login
        // Return a virtual admin user
        return {
          success: true,
          user: {
            id: 0,
            firstName: 'System',
            lastName: 'Administrator',
            email: null,
            username: 'admin',
            usingDefaultPin: true,
            roleId: null,
            title: 'Administrator',
            department: null,
            startDate: null,
            endDate: null,
            contact: null,
            address: null,
            phone: null,
            code: null,
            active: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          requiresPinChange: true,
        };
      }
    }

    // Find user by username
    const user = await this.findByUsername(username);

    if (!user) {
      return {
        success: false,
        error: 'Invalid username or password',
      };
    }

    // Check if user is active
    if (!user.active) {
      return {
        success: false,
        error: 'This account has been deactivated',
      };
    }

    // Verify password/PIN
    if (!verifyPassword(password, user.pinHash)) {
      return {
        success: false,
        error: 'Invalid username or password',
      };
    }

    // Remove pinHash from response
    const { pinHash, ...userWithoutPin } = user;

    return {
      success: true,
      user: userWithoutPin,
      requiresPinChange: user.usingDefaultPin,
    };
  }

  /**
   * Update user's PIN with hashing
   */
  async updatePinSecure(id: number, newPin: string): Promise<schema.User | null> {
    const hashedPin = hashPassword(newPin);
    return this.update(id, { pinHash: hashedPin, usingDefaultPin: false });
  }

  // Export hash function for use elsewhere
  static hashPassword = hashPassword;
}
