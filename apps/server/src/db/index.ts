import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

// postgres-js connection pool (raw 쿼리용으로 export)
export const sqlClient = postgres(connectionString, {
  max: 10,
});

// Drizzle instance
export const db = drizzle(sqlClient, { schema });

// Bootstrap idempotent table creations that don't have a managed migration runner
sqlClient.unsafe(`
  CREATE TABLE IF NOT EXISTS "mobile_auth_tokens" (
    "token_key" text PRIMARY KEY NOT NULL,
    "access_token" text NOT NULL DEFAULT '',
    "refresh_token" text NOT NULL DEFAULT '',
    "user_id" text NOT NULL DEFAULT '',
    "user_role" text NOT NULL DEFAULT 'user',
    "onboarding_data" jsonb,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS "mobile_auth_tokens_expires_at_idx" ON "mobile_auth_tokens" ("expires_at");
`).catch((err) => {
  console.error('[db bootstrap] Failed to ensure mobile_auth_tokens table:', err);
});

// Export schema for use in other files
export * from './schema';
