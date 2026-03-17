import { pgTable, uuid, varchar, timestamp, text, pgEnum, integer, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { folders } from './folders';
import { aiFeedback } from './ai_feedback';

// Diary type enum
export const diaryTypeEnum = pgEnum('diary_type', ['free_form', 'question_based']);

// Diaries table
export const diaries = pgTable('diaries', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  folderId: uuid('folder_id').references(() => folders.id, { onDelete: 'set null' }),
  type: diaryTypeEnum('type').notNull(),
  title: varchar('title', { length: 200 }),
  content: text('content'),
  textStyle: text('text_style'), // JSON string for text styling
  questionSetId: uuid('question_set_id'), // For question-based diaries
  date: timestamp('date').notNull(),
  aiMessage: text('ai_message'), // Latest encouragement message
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

// Diary images table
export const diaryImages = pgTable('diary_images', {
  id: uuid('id').defaultRandom().primaryKey(),
  diaryId: uuid('diary_id').references(() => diaries.id, { onDelete: 'cascade' }).notNull(),
  imageUrl: text('image_url').notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Diary question sets table (admin-managed)
export const diaryQuestionSets = pgTable('diary_question_sets', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

// Diary questions table (deprecated - now using standalone questions)
// Keeping for backward compatibility, but new questions should use questions table
export const diaryQuestions = pgTable('diary_questions', {
  id: uuid('id').defaultRandom().primaryKey(),
  questionSetId: uuid('question_set_id')
    .references(() => diaryQuestionSets.id, { onDelete: 'cascade' })
    .notNull(),
  question: text('question').notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Diary answers table
// questionId can reference either diary_questions (old) or questions (new)
export const diaryAnswers = pgTable('diary_answers', {
  id: uuid('id').defaultRandom().primaryKey(),
  diaryId: uuid('diary_id').references(() => diaries.id, { onDelete: 'cascade' }).notNull(),
  questionId: uuid('question_id').notNull(), // Can reference diary_questions or questions
  answer: text('answer').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Note: ai_feedback table is now in ai_feedback.ts schema file

// Relations
export const diariesRelations = relations(diaries, ({ one, many }) => ({
  user: one(users, {
    fields: [diaries.userId],
    references: [users.id],
  }),
  folder: one(folders, {
    fields: [diaries.folderId],
    references: [folders.id],
  }),
  images: many(diaryImages),
  answers: many(diaryAnswers),
  aiFeedback: many(aiFeedback),
}));

export const diaryImagesRelations = relations(diaryImages, ({ one }) => ({
  diary: one(diaries, {
    fields: [diaryImages.diaryId],
    references: [diaries.id],
  }),
}));

export const diaryQuestionSetsRelations = relations(diaryQuestionSets, ({ many }) => ({
  questions: many(diaryQuestions),
}));

export const diaryQuestionsRelations = relations(diaryQuestions, ({ one, many }) => ({
  questionSet: one(diaryQuestionSets, {
    fields: [diaryQuestions.questionSetId],
    references: [diaryQuestionSets.id],
  }),
  answers: many(diaryAnswers),
}));

export const diaryAnswersRelations = relations(diaryAnswers, ({ one }) => ({
  diary: one(diaries, {
    fields: [diaryAnswers.diaryId],
    references: [diaries.id],
  }),
  question: one(diaryQuestions, {
    fields: [diaryAnswers.questionId],
    references: [diaryQuestions.id],
  }),
}));

