import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, SQL } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import * as schema from '../database/schema';

export abstract class BaseService<TTable extends PgTable, TSelect = any, TInsert = any> {
  protected db: NodePgDatabase<typeof schema>;
  protected table: TTable;

  constructor(db: NodePgDatabase<typeof schema>, table: TTable) {
    this.db = db;
    this.table = table;
  }

  async findAll(where?: SQL): Promise<TSelect[]> {
    const query = this.db.select().from(this.table);
    if (where) {
      return (await query.where(where)) as TSelect[];
    }
    return (await query) as TSelect[];
  }

  async findById(id: number): Promise<TSelect | null> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(eq((this.table as any).id, id))
      .limit(1);
    return (results[0] as TSelect) || null;
  }

  async create(data: TInsert): Promise<TSelect> {
    const results = await this.db
      .insert(this.table)
      .values(data as any)
      .returning();
    return results[0] as TSelect;
  }

  async update(id: number, data: Partial<TInsert>): Promise<TSelect | null> {
    const results = await this.db
      .update(this.table)
      .set(data as any)
      .where(eq((this.table as any).id, id))
      .returning();
    return (results[0] as TSelect) || null;
  }

  async delete(id: number): Promise<boolean> {
    await this.db.delete(this.table).where(eq((this.table as any).id, id));
    return true;
  }
}
