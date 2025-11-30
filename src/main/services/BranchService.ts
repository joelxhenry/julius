import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from '../database/schema';

export class BranchService {
  protected db: NodePgDatabase<typeof schema>;

  constructor(db: NodePgDatabase<typeof schema>) {
    this.db = db;
  }

  async findAll(): Promise<schema.Branch[]> {
    return this.db.select().from(schema.branches);
  }

  async findByCode(branchCode: string): Promise<schema.Branch | null> {
    const results = await this.db
      .select()
      .from(schema.branches)
      .where(eq(schema.branches.branchCode, branchCode))
      .limit(1);
    return results[0] || null;
  }

  async create(data: schema.InsertBranch): Promise<schema.Branch> {
    const results = await this.db
      .insert(schema.branches)
      .values(data)
      .returning();
    return results[0];
  }

  async update(branchCode: string, data: Partial<schema.InsertBranch>): Promise<schema.Branch | null> {
    const results = await this.db
      .update(schema.branches)
      .set(data)
      .where(eq(schema.branches.branchCode, branchCode))
      .returning();
    return results[0] || null;
  }

  async delete(branchCode: string): Promise<boolean> {
    await this.db
      .delete(schema.branches)
      .where(eq(schema.branches.branchCode, branchCode));
    return true;
  }
}
