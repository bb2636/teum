import { pgTable, uuid, varchar, timestamp, decimal } from 'drizzle-orm/pg-core';
import { users } from './users';

export const paymentSessions = pgTable('payment_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: varchar('order_id', { length: 255 }).notNull().unique(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  planName: varchar('plan_name', { length: 100 }).notNull(),
  paymentMethod: varchar('payment_method', { length: 50 }).notNull(),
  // PG에서 발급된 외부 구독/주문 ID (PayPal subscription id 등). sweep job이 콜백 누락된
  // 결제(우리 DB 비활성화) 보정에 사용. 기존 row 호환을 위해 nullable.
  externalSubscriptionId: varchar('external_subscription_id', { length: 255 }),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
