ALTER TABLE "music_jobs" 
ALTER COLUMN "source_diary_ids" SET DATA TYPE jsonb 
USING source_diary_ids::text::jsonb;
