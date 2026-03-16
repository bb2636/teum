-- Create terms table for managing service terms and privacy policy
CREATE TABLE IF NOT EXISTS "terms" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "type" VARCHAR(50) NOT NULL,
  "version" VARCHAR(20) NOT NULL DEFAULT '1.0',
  "content" TEXT NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMP
);

-- Create index on type for faster lookups
CREATE INDEX IF NOT EXISTS "idx_terms_type" ON "terms"("type") WHERE "deleted_at" IS NULL;

-- Create unique constraint on type (only one active term per type)
CREATE UNIQUE INDEX IF NOT EXISTS "idx_terms_type_unique" ON "terms"("type") WHERE "deleted_at" IS NULL;
