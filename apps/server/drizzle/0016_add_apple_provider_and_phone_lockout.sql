ALTER TYPE "auth_provider" ADD VALUE IF NOT EXISTS 'apple';

ALTER TABLE "phone_verifications" ADD COLUMN IF NOT EXISTS "failed_attempts" integer DEFAULT 0 NOT NULL;
ALTER TABLE "phone_verifications" ADD COLUMN IF NOT EXISTS "locked_until" timestamp;
