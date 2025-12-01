import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, like, or, ilike, desc, count, and, sql, gte, lte, sum } from 'drizzle-orm';
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

// Safe employee type without sensitive fields
export type SafeEmployee = Omit<schema.Employee, 'passwordHash'>;

export interface AuthResult {
  success: boolean;
  employee?: SafeEmployee;
  error?: string;
  requiresPasswordChange?: boolean;
}

export interface PinVerificationResult {
  success: boolean;
  employee?: SafeEmployee;
  error?: string;
}

export class EmployeeService extends BaseService<
  typeof schema.employees,
  schema.Employee,
  schema.InsertEmployee
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.employees);
  }

  /**
   * Generate a unique random employee code (e.g., A7X9K2)
   * Uses uppercase letters and numbers, 6 characters long
   */
  async generateNextCode(): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded I, O, 0, 1 to avoid confusion
    const codeLength = 6;
    const maxAttempts = 10;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Generate random code
      let code = '';
      for (let i = 0; i < codeLength; i++) {
        const randomIndex = crypto.randomInt(0, chars.length);
        code += chars[randomIndex];
      }

      // Check if code already exists
      const existing = await this.db
        .select({ code: schema.employees.code })
        .from(schema.employees)
        .where(ilike(schema.employees.code, code))
        .limit(1);

      if (existing.length === 0) {
        return code;
      }
    }

    // Fallback: use timestamp-based code if random generation fails
    const timestamp = Date.now().toString(36).toUpperCase().slice(-6);
    return timestamp;
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

  async activate(id: number): Promise<schema.Employee | null> {
    return this.update(id, { endDate: null, status: 'active' });
  }

  async findByEmployeeCode(employeeCode: string): Promise<schema.Employee | null> {
    return this.findByCode(employeeCode);
  }

  async findByBranch(branchId: number): Promise<schema.Employee[]> {
    // Note: branchId filtering would require a branch relationship in the schema
    // For now, return all employees (this can be enhanced when branch support is added)
    return this.findAll();
  }

  async updatePermissions(id: number, permissions: Record<string, any>): Promise<schema.Employee | null> {
    return this.update(id, { permissions });
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

  /**
   * Verify an employee by their unique code (used as PIN)
   * Code lookup is case-insensitive
   */
  async verifyPin(code: string): Promise<PinVerificationResult> {
    if (!code || !code.trim()) {
      return {
        success: false,
        error: 'Please enter your employee code',
      };
    }

    // Find employee by code (case-insensitive)
    const results = await this.db
      .select()
      .from(schema.employees)
      .where(ilike(schema.employees.code, code.trim()))
      .limit(1);

    const employee = results[0];

    if (!employee) {
      return {
        success: false,
        error: 'Employee code not recognized. Please check and try again.',
      };
    }

    // Check if employee is active
    if (employee.status !== 'active') {
      return {
        success: false,
        error: 'Your account is not active. Please contact an administrator.',
      };
    }

    // Remove sensitive fields from response
    const { passwordHash, ...safeEmployee } = employee;

    return {
      success: true,
      employee: safeEmployee,
    };
  }

  // Export hash function for use elsewhere
  static hashPassword = hashPassword;

  // ==================== Activity Query Methods ====================

  /**
   * Get invoices created by an employee (as salesperson)
   */
  async getEmployeeInvoices(
    employeeId: number,
    params: { page?: number; pageSize?: number; startDate?: string; endDate?: string } = {}
  ): Promise<PaginatedResult<schema.Invoice>> {
    const { page = 1, pageSize = 20, startDate, endDate } = params;
    const offset = (page - 1) * pageSize;

    const conditions = [eq(schema.invoices.salespersonId, employeeId)];

    if (startDate) {
      conditions.push(gte(schema.invoices.invDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(schema.invoices.invDate, endDate));
    }

    const whereCondition = and(...conditions);

    const countResult = await this.db
      .select({ count: count() })
      .from(schema.invoices)
      .where(whereCondition);

    const total = Number(countResult[0]?.count ?? 0);

    const data = await this.db
      .select()
      .from(schema.invoices)
      .where(whereCondition)
      .orderBy(desc(schema.invoices.invDate), desc(schema.invoices.id))
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

  /**
   * Get quotations created by an employee (as salesperson)
   */
  async getEmployeeQuotations(
    employeeId: number,
    params: { page?: number; pageSize?: number; startDate?: string; endDate?: string } = {}
  ): Promise<PaginatedResult<schema.Quotation>> {
    const { page = 1, pageSize = 20, startDate, endDate } = params;
    const offset = (page - 1) * pageSize;

    const conditions = [eq(schema.quotations.salespersonId, employeeId)];

    if (startDate) {
      conditions.push(gte(schema.quotations.quoteDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(schema.quotations.quoteDate, endDate));
    }

    const whereCondition = and(...conditions);

    const countResult = await this.db
      .select({ count: count() })
      .from(schema.quotations)
      .where(whereCondition);

    const total = Number(countResult[0]?.count ?? 0);

    const data = await this.db
      .select()
      .from(schema.quotations)
      .where(whereCondition)
      .orderBy(desc(schema.quotations.quoteDate), desc(schema.quotations.id))
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

  /**
   * Get credit notes created by an employee (as salesperson)
   */
  async getEmployeeCreditNotes(
    employeeId: number,
    params: { page?: number; pageSize?: number; startDate?: string; endDate?: string } = {}
  ): Promise<PaginatedResult<schema.CreditNote>> {
    const { page = 1, pageSize = 20, startDate, endDate } = params;
    const offset = (page - 1) * pageSize;

    const conditions = [eq(schema.creditNotes.salespersonId, employeeId)];

    if (startDate) {
      conditions.push(gte(schema.creditNotes.crDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(schema.creditNotes.crDate, endDate));
    }

    const whereCondition = and(...conditions);

    const countResult = await this.db
      .select({ count: count() })
      .from(schema.creditNotes)
      .where(whereCondition);

    const total = Number(countResult[0]?.count ?? 0);

    const data = await this.db
      .select()
      .from(schema.creditNotes)
      .where(whereCondition)
      .orderBy(desc(schema.creditNotes.crDate), desc(schema.creditNotes.id))
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

  /**
   * Get payments processed by an employee
   */
  async getEmployeePayments(
    employeeId: number,
    params: { page?: number; pageSize?: number; startDate?: string; endDate?: string } = {}
  ): Promise<PaginatedResult<schema.Payment>> {
    const { page = 1, pageSize = 20, startDate, endDate } = params;
    const offset = (page - 1) * pageSize;

    const conditions = [eq(schema.payments.processedById, employeeId)];

    if (startDate) {
      conditions.push(gte(schema.payments.paymentDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(schema.payments.paymentDate, endDate));
    }

    const whereCondition = and(...conditions);

    const countResult = await this.db
      .select({ count: count() })
      .from(schema.payments)
      .where(whereCondition);

    const total = Number(countResult[0]?.count ?? 0);

    const data = await this.db
      .select()
      .from(schema.payments)
      .where(whereCondition)
      .orderBy(desc(schema.payments.paymentDate), desc(schema.payments.id))
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

  /**
   * Get attendance records for an employee
   */
  async getEmployeeAttendance(
    employeeId: number,
    params: { page?: number; pageSize?: number; startDate?: string; endDate?: string } = {}
  ): Promise<PaginatedResult<schema.EmployeeAttendance>> {
    const { page = 1, pageSize = 20, startDate, endDate } = params;
    const offset = (page - 1) * pageSize;

    const conditions = [eq(schema.employeeAttendance.employeeId, employeeId)];

    if (startDate) {
      conditions.push(gte(schema.employeeAttendance.logDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(schema.employeeAttendance.logDate, endDate));
    }

    const whereCondition = and(...conditions);

    const countResult = await this.db
      .select({ count: count() })
      .from(schema.employeeAttendance)
      .where(whereCondition);

    const total = Number(countResult[0]?.count ?? 0);

    const data = await this.db
      .select()
      .from(schema.employeeAttendance)
      .where(whereCondition)
      .orderBy(desc(schema.employeeAttendance.logDate), desc(schema.employeeAttendance.id))
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

  /**
   * Get activity summary for an employee (counts and totals)
   */
  async getEmployeeActivitySummary(
    employeeId: number,
    params: { startDate?: string; endDate?: string } = {}
  ): Promise<{
    invoices: { count: number; totalAmount: number };
    quotations: { count: number; totalAmount: number };
    creditNotes: { count: number; totalAmount: number };
    payments: { count: number; totalAmount: number };
    attendance: { totalDays: number };
  }> {
    const { startDate, endDate } = params;

    // Build conditions for each type
    const buildDateConditions = <T>(
      dateField: any,
      employeeField: any
    ) => {
      const conditions = [eq(employeeField, employeeId)];
      if (startDate) conditions.push(gte(dateField, startDate));
      if (endDate) conditions.push(lte(dateField, endDate));
      return and(...conditions);
    };

    // Invoices summary
    const invoiceResult = await this.db
      .select({
        count: count(),
        totalAmount: sum(schema.invoices.total),
      })
      .from(schema.invoices)
      .where(buildDateConditions(schema.invoices.invDate, schema.invoices.salespersonId));

    // Quotations summary
    const quotationResult = await this.db
      .select({
        count: count(),
        totalAmount: sum(schema.quotations.total),
      })
      .from(schema.quotations)
      .where(buildDateConditions(schema.quotations.quoteDate, schema.quotations.salespersonId));

    // Credit notes summary
    const creditNoteResult = await this.db
      .select({
        count: count(),
        totalAmount: sum(schema.creditNotes.total),
      })
      .from(schema.creditNotes)
      .where(buildDateConditions(schema.creditNotes.crDate, schema.creditNotes.salespersonId));

    // Payments summary
    const paymentResult = await this.db
      .select({
        count: count(),
        totalAmount: sum(schema.payments.amount),
      })
      .from(schema.payments)
      .where(buildDateConditions(schema.payments.paymentDate, schema.payments.processedById));

    // Attendance summary - count distinct days
    const attendanceConditions = [eq(schema.employeeAttendance.employeeId, employeeId)];
    if (startDate) attendanceConditions.push(gte(schema.employeeAttendance.logDate, startDate));
    if (endDate) attendanceConditions.push(lte(schema.employeeAttendance.logDate, endDate));

    const attendanceResult = await this.db
      .select({ count: sql<number>`COUNT(DISTINCT ${schema.employeeAttendance.logDate})` })
      .from(schema.employeeAttendance)
      .where(and(...attendanceConditions));

    return {
      invoices: {
        count: Number(invoiceResult[0]?.count ?? 0),
        totalAmount: Number(invoiceResult[0]?.totalAmount ?? 0),
      },
      quotations: {
        count: Number(quotationResult[0]?.count ?? 0),
        totalAmount: Number(quotationResult[0]?.totalAmount ?? 0),
      },
      creditNotes: {
        count: Number(creditNoteResult[0]?.count ?? 0),
        totalAmount: Number(creditNoteResult[0]?.totalAmount ?? 0),
      },
      payments: {
        count: Number(paymentResult[0]?.count ?? 0),
        totalAmount: Number(paymentResult[0]?.totalAmount ?? 0),
      },
      attendance: {
        totalDays: Number(attendanceResult[0]?.count ?? 0),
      },
    };
  }
}
