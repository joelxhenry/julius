import { pgTable, varchar } from 'drizzle-orm/pg-core';

// BRANCHES table - reference table for multi-location support
export const branches = pgTable('branches', {
  branchCode: varchar('branch_code', { length: 5 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
});

// Export types
export type Branch = typeof branches.$inferSelect;
export type InsertBranch = typeof branches.$inferInsert;
