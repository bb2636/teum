DO $$ BEGIN
  CREATE TYPE "device_platform" AS ENUM('android', 'ios', 'web');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "device_tokens" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token" varchar(512) NOT NULL,
  "platform" "device_platform" NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "device_tokens_user_id_idx" ON "device_tokens"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "device_tokens_user_token_idx" ON "device_tokens"("user_id", "token");
