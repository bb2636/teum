import { pgTable, uuid, varchar, timestamp, text, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { musicJobs } from './music_jobs';

// Note: music_jobs table is now in music_jobs.ts schema file
// This file only contains playlists and playlist_tracks

// Playlists table
export const playlists = pgTable('playlists', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

// Playlist tracks table
export const playlistTracks = pgTable('playlist_tracks', {
  id: uuid('id').defaultRandom().primaryKey(),
  playlistId: uuid('playlist_id')
    .references(() => playlists.id, { onDelete: 'cascade' })
    .notNull(),
  musicJobId: uuid('music_job_id')
    .references(() => musicJobs.id, { onDelete: 'cascade' })
    .notNull(),
  order: integer('order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Note: musicJobsRelations is now in music_jobs.ts

export const playlistsRelations = relations(playlists, ({ one, many }) => ({
  user: one(users, {
    fields: [playlists.userId],
    references: [users.id],
  }),
  tracks: many(playlistTracks),
}));

export const playlistTracksRelations = relations(playlistTracks, ({ one }) => ({
  playlist: one(playlists, {
    fields: [playlistTracks.playlistId],
    references: [playlists.id],
  }),
  musicJob: one(musicJobs, {
    fields: [playlistTracks.musicJobId],
    references: [musicJobs.id],
  }),
}));
