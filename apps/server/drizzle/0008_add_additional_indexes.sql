-- Additional performance indexes for query optimization

-- Folders: frequently queried by userId and isDefault
CREATE INDEX IF NOT EXISTS "folders_user_id_is_default_idx" ON "folders" ("user_id", "is_default") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "folders_user_id_idx" ON "folders" ("user_id") WHERE "deleted_at" IS NULL;

-- Diary images: frequently queried by diaryId
CREATE INDEX IF NOT EXISTS "diary_images_diary_id_order_idx" ON "diary_images" ("diary_id", "order");

-- Diary answers: frequently queried by diaryId
CREATE INDEX IF NOT EXISTS "diary_answers_diary_id_idx" ON "diary_answers" ("diary_id");

-- Questions: frequently ordered by order field
CREATE INDEX IF NOT EXISTS "questions_order_active_idx" ON "questions" ("order", "is_active") WHERE "deleted_at" IS NULL;

-- User profiles: frequently queried by userId
CREATE INDEX IF NOT EXISTS "user_profiles_user_id_idx" ON "user_profiles" ("user_id");

-- AI feedback: frequently queried by diaryId and userId
CREATE INDEX IF NOT EXISTS "ai_feedback_diary_id_created_at_idx" ON "ai_feedback" ("diary_id", "created_at");
CREATE INDEX IF NOT EXISTS "ai_feedback_user_id_idx" ON "ai_feedback" ("user_id");

-- Terms: frequently queried by type
CREATE INDEX IF NOT EXISTS "terms_type_deleted_at_idx" ON "terms" ("type", "deleted_at") WHERE "deleted_at" IS NULL;
