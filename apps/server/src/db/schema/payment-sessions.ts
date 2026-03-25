import { pgTable, uuid, varchar, timestamp, decimal } from 'drizzle-orm/pg-core';
import { users } from './users';

export const paymentSessions = pgTable('payment_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: varchar('order_id', { length: 255 }).notNull().unique(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  planName: varchar('plan_name', { length: 100 }).notNull(),
  paymentMethod: varchar('payment_method', { length: 50 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
