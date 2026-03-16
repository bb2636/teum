import { pgTable, uuid, varchar, timestamp, text, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

// Folders table
export const folders = pgTable('folders', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  coverImageUrl: text('cover_image_url'),
  color: varchar('color', { length: 20 }), // hex color code
  isDefault: boolean('is_default').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

// Relations
export const foldersRelations = relations(folders, ({ one }) => ({
  user: one(users, {
    fields: [folders.userId],
    references: [users.id],
  }),
}));
