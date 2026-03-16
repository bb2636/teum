import { pgTable, uuid, text, timestamp, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

// Standalone questions table (admin-managed, no question sets)
export const questions = pgTable('questions', {
  id: uuid('id').defaultRandom().primaryKey(),
  question: text('question').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

// User question history - tracks which questions a user has seen/answered
export const userQuestionHistory = pgTable('user_question_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  questionId: uuid('question_id').references(() => questions.id, { onDelete: 'cascade' }).notNull(),
  diaryId: uuid('diary_id'), // Optional: link to the diary that used this question
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const questionsRelations = relations(questions, ({ many }) => ({
  history: many(userQuestionHistory),
}));

export const userQuestionHistoryRelations = relations(userQuestionHistory, ({ one }) => ({
  user: one(users, {
    fields: [userQuestionHistory.userId],
    references: [users.id],
  }),
  question: one(questions, {
    fields: [userQuestionHistory.questionId],
    references: [questions.id],
  }),
}));
