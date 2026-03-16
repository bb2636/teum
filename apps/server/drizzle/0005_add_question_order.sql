-- Add order field to questions table for custom ordering
ALTER TABLE questions
ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;

-- Update existing questions with order based on creation date
UPDATE questions
SET "order" = subquery.row_number
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) as row_number
  FROM questions
  WHERE deleted_at IS NULL
) AS subquery
WHERE questions.id = subquery.id;

-- Create index on order for faster sorting
CREATE INDEX IF NOT EXISTS idx_questions_order ON questions("order") WHERE deleted_at IS NULL;
