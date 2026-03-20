import { pgTable, uuid, varchar, timestamp, text, pgEnum, jsonb, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

// Music job status enum
export const musicJobStatusEnum = pgEnum('music_job_status', [
  'queued',
  'processing',
  'completed',
  'failed',
  'lyrics_only',
]);

// Music jobs table
export const musicJobs = pgTable('music_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  status: musicJobStatusEnum('status').default('queued').notNull(),
  sourceDiaryIds: jsonb('source_diary_ids').notNull(), // JSON array of diary IDs
  overallEmotion: varchar('overall_emotion', { length: 100 }),
  mood: varchar('mood', { length: 100 }),
  keywords: jsonb('keywords'), // JSON array of strings
  lyricalTheme: text('lyrical_theme'),
  lyrics: text('lyrics'),
  musicPrompt: text('music_prompt'),
  provider: varchar('provider', { length: 50 }), // e.g., 'stable_audio'
  providerJobId: varchar('provider_job_id', { length: 255 }),
  audioUrl: text('audio_url'),
  thumbnailUrl: text('thumbnail_url'),
  errorMessage: text('error_message'),
  durationSeconds: integer('duration_seconds'), // 재생 길이(초), 최대 2분
  songTitle: varchar('song_title', { length: 50 }), // AI 생성 노래 제목 (한국어 10자 이내)
  songTitleEn: varchar('song_title_en', { length: 50 }), // AI 생성 노래 제목 (영어 20자 이내)
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

// Relations
export const musicJobsRelations = relations(musicJobs, ({ one }) => ({
  user: one(users, {
    fields: [musicJobs.userId],
    references: [users.id],
  }),
}));
