-- Replace reserved word column "order" with "sort_order" in diary_images and diary_questions

-- diary_images
ALTER TABLE "diary_images" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'diary_images' AND column_name = 'order'
  ) THEN
    UPDATE "diary_images" SET "sort_order" = "order";
    ALTER TABLE "diary_images" DROP COLUMN "order";
  END IF;
END $$;
DROP INDEX IF EXISTS "diary_images_diary_id_order_idx";
CREATE INDEX IF NOT EXISTS "diary_images_diary_id_sort_order_idx" ON "diary_images" ("diary_id", "sort_order");

-- diary_questions
ALTER TABLE "diary_questions" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'diary_questions' AND column_name = 'order'
  ) THEN
    UPDATE "diary_questions" SET "sort_order" = "order";
    ALTER TABLE "diary_questions" DROP COLUMN "order";
  END IF;
END $$;
