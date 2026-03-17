-- Music jobs: 썸네일(커버) URL 저장 (Mureka 등에서 반환 시 저장)
ALTER TABLE "music_jobs" ADD COLUMN IF NOT EXISTS "thumbnail_url" text;
