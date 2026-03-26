CREATE INDEX IF NOT EXISTS folders_user_id_idx ON folders (user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ai_feedback_diary_id_idx ON ai_feedback (diary_id);
CREATE INDEX IF NOT EXISTS ai_feedback_user_id_idx ON ai_feedback (user_id);
CREATE INDEX IF NOT EXISTS diary_answers_diary_id_idx ON diary_answers (diary_id);
CREATE INDEX IF NOT EXISTS auth_accounts_user_id_idx ON auth_accounts (user_id);
CREATE INDEX IF NOT EXISTS diaries_user_id_created_at_idx ON diaries (user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS music_jobs_user_id_created_at_idx ON music_jobs (user_id, created_at DESC);
