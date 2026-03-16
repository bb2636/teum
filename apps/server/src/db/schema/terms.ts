import { pgTable, uuid, varchar, text, timestamp, decimal } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Terms type enum
export const termsTypeEnum = ['service', 'privacy'] as const;

// Terms table
export const terms = pgTable('terms', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: varchar('type', { length: 50 }).notNull(), // 'service' or 'privacy'
  version: varchar('version', { length: 20 }).default('1.0').notNull(), // e.g., '1.0', '1.1', '1.2'
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

// Relations
export const termsRelations = relations(terms, () => ({}));
