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
