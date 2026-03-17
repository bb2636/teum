-- Music jobs: 재생 길이(초), AI 노래 제목
ALTER TABLE "music_jobs" ADD COLUMN IF NOT EXISTS "duration_seconds" integer;
ALTER TABLE "music_jobs" ADD COLUMN IF NOT EXISTS "song_title" varchar(200);
