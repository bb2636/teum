-- Replace reserved word column "order" with "sort_order" to avoid driver/query issues
-- 1. Add new column
ALTER TABLE "questions"
ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;

-- 2. If "order" exists, copy data and drop it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'questions' AND column_name = 'order'
  ) THEN
    UPDATE "questions" SET "sort_order" = "order";
    ALTER TABLE "questions" DROP COLUMN "order";
  END IF;
END $$;

-- 3. Drop old index if exists, create new one
DROP INDEX IF EXISTS "idx_questions_order";
DROP INDEX IF EXISTS "questions_order_active_idx";
CREATE INDEX IF NOT EXISTS "questions_sort_order_active_idx" ON "questions" ("sort_order", "is_active") WHERE "deleted_at" IS NULL;
