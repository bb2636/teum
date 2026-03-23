import { pgTable, uuid, varchar, timestamp, text, pgEnum, boolean, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

// Auth provider enum
export const authProviderEnum = pgEnum('auth_provider', ['email', 'google', 'apple']);

// Phone verification status enum
export const phoneVerificationStatusEnum = pgEnum('phone_verification_status', [
  'pending',
  'verified',
  'expired',
]);

// Email verification status enum
export const emailVerificationStatusEnum = pgEnum('email_verification_status', [
  'pending',
  'verified',
  'expired',
]);

// Auth accounts table (for OAuth)
export const authAccounts = pgTable('auth_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  provider: authProviderEnum('provider').notNull(),
  providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Phone verifications table
export const phoneVerifications = pgTable('phone_verifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  phone: varchar('phone', { length: 20 }).notNull(),
  code: varchar('code', { length: 10 }).notNull(),
  status: phoneVerificationStatusEnum('status').default('pending').notNull(),
  failedAttempts: integer('failed_attempts').default(0).notNull(),
  lockedUntil: timestamp('locked_until'),
  expiresAt: timestamp('expires_at').notNull(),
  verifiedAt: timestamp('verified_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Email verifications table
export const emailVerifications = pgTable('email_verifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  code: varchar('code', { length: 10 }).notNull(),
  status: emailVerificationStatusEnum('status').default('pending').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  verifiedAt: timestamp('verified_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Terms consents table
export const termsConsents = pgTable('terms_consents', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  termsType: varchar('terms_type', { length: 50 }).notNull(), // 'service', 'privacy', etc.
  consented: boolean('consented').default(true).notNull(),
  consentedAt: timestamp('consented_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const authAccountsRelations = relations(authAccounts, ({ one }) => ({
  user: one(users, {
    fields: [authAccounts.userId],
    references: [users.id],
  }),
}));

export const phoneVerificationsRelations = relations(phoneVerifications, ({ one }) => ({
  user: one(users, {
    fields: [phoneVerifications.userId],
    references: [users.id],
  }),
}));

export const emailVerificationsRelations = relations(emailVerifications, ({ one }) => ({
  user: one(users, {
    fields: [emailVerifications.userId],
    references: [users.id],
  }),
}));

export const termsConsentsRelations = relations(termsConsents, ({ one }) => ({
  user: one(users, {
    fields: [termsConsents.userId],
    references: [users.id],
  }),
}));
