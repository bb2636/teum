-- 노래 제목 영어 (20자 이내)
ALTER TABLE "music_jobs" ADD COLUMN IF NOT EXISTS "song_title_en" varchar(50);
