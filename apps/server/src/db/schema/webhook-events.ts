import { pgTable, uuid, varchar, timestamp, text, pgEnum } from 'drizzle-orm/pg-core';

export const webhookSourceEnum = pgEnum('webhook_source', ['paypal', 'nicepay', 'apple']);

export const webhookEvents = pgTable('webhook_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: varchar('event_id', { length: 255 }).notNull().unique(),
  source: webhookSourceEnum('source').notNull(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  payload: text('payload'),
  processedAt: timestamp('processed_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
