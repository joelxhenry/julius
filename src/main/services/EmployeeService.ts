import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, like, or, ilike, desc, count, and } from 'drizzle-orm';
import * as schema from '../database/schema';
import { BaseService } from './BaseService';
import { PaginatedResult } from './types';
import crypto from 'crypto';

const DEFAULT_PASSWORD = '0000';
const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD = '0609';

export interface EmployeeQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  salespersonOnly?: boolean;
  activeOnly?: boolean;
}

// Hash function for password
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
  employee?: Omit<schema.Employee, 'passwordHash'>;
  error?: string;
  requiresPasswordChange?: boolean;
}

export class EmployeeService extends BaseService<
  typeof schema.employees,
  schema.Employee,
  schema.InsertEmployee
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.employees);
  }

  async findPaginated(params: EmployeeQueryParams = {}): Promise<PaginatedResult<schema.Employee>> {
    const { page = 1, pageSize = 50, search, salespersonOnly, activeOnly } = params;
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(schema.employees.firstName, searchTerm),
          ilike(schema.employees.lastName, searchTerm),
          ilike(schema.employees.code, searchTerm),
          ilike(schema.employees.username, searchTerm)
        )
      );
    }

    if (salespersonOnly) {
      conditions.push(eq(schema.employees.isSalesperson, true));
    }

    if (activeOnly) {
      conditions.push(eq(schema.employees.status, 'active'));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await this.db
      .select({ count: count() })
      .from(schema.employees)
      .where(whereCondition);

    const total = Number(countResult[0]?.count ?? 0);

    const data = await this.db
      .select()
      .from(schema.employees)
      .where(whereCondition)
      .orderBy(desc(schema.employees.id))
      .limit(pageSize)
      .offset(offset);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findByCode(code: string): Promise<schema.Employee | null> {
    const results = await this.db
      .select()
      .from(schema.employees)
      .where(eq(schema.employees.code, code))
      .limit(1);
    return results[0] || null;
  }

  async findByUsername(username: string): Promise<schema.Employee | null> {
    const results = await this.db
      .select()
      .from(schema.employees)
      .where(eq(schema.employees.username, username))
      .limit(1);
    return results[0] || null;
  }

  async findSalespeople(): Promise<schema.Employee[]> {
    return this.db
      .select()
      .from(schema.employees)
      .where(eq(schema.employees.isSalesperson, true));
  }

  async findActive(): Promise<schema.Employee[]> {
    return this.db
      .select()
      .from(schema.employees)
      .where(eq(schema.employees.status, 'active'));
  }

  async search(query: string): Promise<schema.Employee[]> {
    return this.db
      .select()
      .from(schema.employees)
      .where(
        or(
          like(schema.employees.firstName, `%${query}%`),
          like(schema.employees.lastName, `%${query}%`),
          like(schema.employees.code, `%${query}%`),
          like(schema.employees.username, `%${query}%`)
        )
      );
  }

  async searchForSelect(query: string, limit = 20, activeOnly = true): Promise<schema.Employee[]> {
    const conditions = [];

    if (activeOnly) {
      conditions.push(eq(schema.employees.status, 'active'));
    }

    if (query && query.trim()) {
      const searchTerm = `%${query.trim()}%`;
      conditions.push(
        or(
          ilike(schema.employees.firstName, searchTerm),
          ilike(schema.employees.lastName, searchTerm),
          ilike(schema.employees.code, searchTerm),
          ilike(schema.employees.username, searchTerm)
        )
      );
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    return this.db
      .select()
      .from(schema.employees)
      .where(whereCondition)
      .orderBy(desc(schema.employees.id))
      .limit(limit);
  }

  async updatePassword(id: number, passwordHash: string): Promise<schema.Employee | null> {
    return this.update(id, { passwordHash });
  }

  async deactivate(id: number, endDate: string): Promise<schema.Employee | null> {
    return this.update(id, { endDate, status: 'inactive' });
  }

  async authenticate(username: string, password: string): Promise<AuthResult> {
    // Find employee by username first
    const employee = await this.findByUsername(username);

    // If employee exists, try to authenticate them
    if (employee) {
      // Check if employee is active
      if (employee.status !== 'active') {
        return {
          success: false,
          error: 'This account has been deactivated',
        };
      }

      // Verify password
      if (!employee.passwordHash || !verifyPassword(password, employee.passwordHash)) {
        return {
          success: false,
          error: 'Invalid username or password',
        };
      }

      // Remove passwordHash from response
      const { passwordHash, ...employeeWithoutPassword } = employee;

      return {
        success: true,
        employee: employeeWithoutPassword,
        requiresPasswordChange: employee.passwordHash === DEFAULT_PASSWORD,
      };
    }

    // No employee found - check for default admin credentials as fallback
    if (username === DEFAULT_ADMIN_USERNAME && password === DEFAULT_ADMIN_PASSWORD) {
      // Return a virtual admin employee
      return {
        success: true,
        employee: {
          id: 0,
          code: 'ADMIN',
          firstName: 'System',
          lastName: 'Administrator',
          title: 'Administrator',
          department: null,
          address: null,
          phone: null,
          emergencyContact: null,
          startDate: null,
          endDate: null,
          status: 'active',
          isSalesperson: false,
          commission: null,
          username: 'admin',
          permissions: {},
          accessCodes: {},
          createdAt: new Date(),
        },
        requiresPasswordChange: true,
      };
    }

    // No employee found and not default admin credentials
    return {
      success: false,
      error: 'Invalid username or password',
    };
  }

  async updatePasswordSecure(id: number, newPassword: string): Promise<schema.Employee | null> {
    const hashedPassword = hashPassword(newPassword);
    return this.update(id, { passwordHash: hashedPassword });
  }

  // Export hash function for use elsewhere
  static hashPassword = hashPassword;
}
