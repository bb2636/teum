import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const mobileAuthTokens = pgTable('mobile_auth_tokens', {
  tokenKey: text('token_key').primaryKey(),
  accessToken: text('access_token').notNull().default(''),
  refreshToken: text('refresh_token').notNull().default(''),
  userId: text('user_id').notNull().default(''),
  userRole: text('user_role').notNull().default('user'),
  onboardingData: jsonb('onboarding_data'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type MobileAuthToken = typeof mobileAuthTokens.$inferSelect;
export type NewMobileAuthToken = typeof mobileAuthTokens.$inferInsert;
