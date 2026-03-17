-- Fix keywords column type: convert to jsonb with explicit USING
ALTER TABLE "music_jobs" 
ALTER COLUMN "keywords" SET DATA TYPE jsonb 
USING keywords::text::jsonb;
