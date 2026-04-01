import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { questions } from './questions';

export const questionTranslations = pgTable('question_translations', {
  id: uuid('id').defaultRandom().primaryKey(),
  questionId: uuid('question_id').references(() => questions.id, { onDelete: 'cascade' }).notNull(),
  lang: text('lang').notNull(),
  translatedText: text('translated_text').notNull(),
  originalHash: text('original_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
