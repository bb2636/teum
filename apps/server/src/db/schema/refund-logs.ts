import { pgTable, uuid, varchar, timestamp, text } from 'drizzle-orm/pg-core';
import { users } from './users';
import { payments } from './subscriptions';

export const refundLogs = pgTable('refund_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  paymentId: uuid('payment_id').references(() => payments.id, { onDelete: 'set null' }),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  rawPayload: text('raw_payload'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
