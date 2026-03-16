import { pgTable, uuid, varchar, timestamp, text, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { diaries } from './diaries';

// AI feedback kind enum
export const aiFeedbackKindEnum = pgEnum('ai_feedback_kind', ['encouragement', 'analysis']);

// AI feedback table
export const aiFeedback = pgTable('ai_feedback', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  diaryId: uuid('diary_id').references(() => diaries.id, { onDelete: 'cascade' }).notNull(),
  kind: aiFeedbackKindEnum('kind').notNull(),
  promptVersion: varchar('prompt_version', { length: 50 }),
  inputExcerpt: text('input_excerpt'), // Truncated diary content for reference
  outputText: text('output_text').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const aiFeedbackRelations = relations(aiFeedback, ({ one }) => ({
  user: one(users, {
    fields: [aiFeedback.userId],
    references: [users.id],
  }),
  diary: one(diaries, {
    fields: [aiFeedback.diaryId],
    references: [diaries.id],
  }),
}));
