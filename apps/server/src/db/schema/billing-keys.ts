import { pgTable, uuid, varchar, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

export const billingKeyStatusEnum = pgEnum('billing_key_status', [
  'active',
  'inactive',
  'expired',
]);

export const billingKeys = pgTable('billing_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  bid: varchar('bid', { length: 255 }).notNull().unique(),
  cardCode: varchar('card_code', { length: 10 }),
  cardName: varchar('card_name', { length: 50 }),
  cardNo: varchar('card_no', { length: 50 }),
  status: billingKeyStatusEnum('status').default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const billingKeysRelations = relations(billingKeys, ({ one }) => ({
  user: one(users, {
    fields: [billingKeys.userId],
    references: [users.id],
  }),
}));
