import { pgTable, uuid, varchar, timestamp, text, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

// Support inquiry status enum
export const supportInquiryStatusEnum = pgEnum('support_inquiry_status', [
  'received',
  'in_progress',
  'answered',
]);

// Support inquiries table
export const supportInquiries = pgTable('support_inquiries', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  status: supportInquiryStatusEnum('status').default('received').notNull(),
  subject: varchar('subject', { length: 200 }).notNull(),
  message: text('message').notNull(),
  answer: text('answer'),
  answeredAt: timestamp('answered_at'),
  answeredBy: uuid('answered_by'), // Admin user ID
  adminCheckedAt: timestamp('admin_checked_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

// Relations
export const supportInquiriesRelations = relations(supportInquiries, ({ one }) => ({
  user: one(users, {
    fields: [supportInquiries.userId],
    references: [users.id],
  }),
}));
