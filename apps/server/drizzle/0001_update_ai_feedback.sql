-- Add new columns to ai_feedback table
ALTER TABLE "ai_feedback" ADD COLUMN IF NOT EXISTS "user_id" uuid;
ALTER TABLE "ai_feedback" ADD COLUMN IF NOT EXISTS "kind" varchar;
ALTER TABLE "ai_feedback" ADD COLUMN IF NOT EXISTS "prompt_version" varchar(50);
ALTER TABLE "ai_feedback" ADD COLUMN IF NOT EXISTS "input_excerpt" text;
ALTER TABLE "ai_feedback" ADD COLUMN IF NOT EXISTS "output_text" text;

-- Create enum type for ai_feedback_kind
DO $$ BEGIN
 CREATE TYPE "ai_feedback_kind" AS ENUM('encouragement', 'analysis');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Update existing rows: migrate message to output_text
UPDATE "ai_feedback" SET "output_text" = "message" WHERE "output_text" IS NULL;

-- Set default values for existing rows
UPDATE "ai_feedback" SET "kind" = 'encouragement' WHERE "kind" IS NULL;
UPDATE "ai_feedback" SET "prompt_version" = '1.0' WHERE "prompt_version" IS NULL;

-- Set user_id from diary
UPDATE "ai_feedback" af
SET "user_id" = d."user_id"
FROM "diaries" d
WHERE af."diary_id" = d."id" AND af."user_id" IS NULL;

-- Make columns NOT NULL after data migration
ALTER TABLE "ai_feedback" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "ai_feedback" ALTER COLUMN "kind" TYPE "ai_feedback_kind" USING "kind"::"ai_feedback_kind";
ALTER TABLE "ai_feedback" ALTER COLUMN "kind" SET NOT NULL;
ALTER TABLE "ai_feedback" ALTER COLUMN "output_text" SET NOT NULL;

-- Add foreign key constraint for user_id
ALTER TABLE "ai_feedback" ADD CONSTRAINT "ai_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

-- Drop old message column (optional, can be done later)
-- ALTER TABLE "ai_feedback" DROP COLUMN "message";
