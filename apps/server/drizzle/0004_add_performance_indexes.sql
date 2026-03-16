-- Performance indexes for frequently queried fields

-- User queries
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "users_created_at_idx" ON "users" ("created_at");

-- Diary queries
CREATE INDEX IF NOT EXISTS "diaries_user_id_date_idx" ON "diaries" ("user_id", "date") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "diaries_folder_id_idx" ON "diaries" ("folder_id") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "diaries_date_idx" ON "diaries" ("date") WHERE "deleted_at" IS NULL;

-- Music job queries
CREATE INDEX IF NOT EXISTS "music_jobs_user_id_status_idx" ON "music_jobs" ("user_id", "status");
CREATE INDEX IF NOT EXISTS "music_jobs_status_created_at_idx" ON "music_jobs" ("status", "created_at");
CREATE INDEX IF NOT EXISTS "music_jobs_provider_job_id_idx" ON "music_jobs" ("provider_job_id") WHERE "provider_job_id" IS NOT NULL;

-- Question history queries (for random question selection)
CREATE INDEX IF NOT EXISTS "user_question_history_user_id_created_at_idx" ON "user_question_history" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "user_question_history_question_id_idx" ON "user_question_history" ("question_id");

-- Support inquiries
CREATE INDEX IF NOT EXISTS "support_inquiries_user_id_status_idx" ON "support_inquiries" ("user_id", "status") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "support_inquiries_status_created_at_idx" ON "support_inquiries" ("status", "created_at") WHERE "deleted_at" IS NULL;

-- Payments
CREATE INDEX IF NOT EXISTS "payments_user_id_status_idx" ON "payments" ("user_id", "status");
CREATE INDEX IF NOT EXISTS "payments_created_at_idx" ON "payments" ("created_at");

-- Subscriptions
CREATE INDEX IF NOT EXISTS "subscriptions_user_id_status_idx" ON "subscriptions" ("user_id", "status");
CREATE INDEX IF NOT EXISTS "subscriptions_status_end_date_idx" ON "subscriptions" ("status", "end_date");

-- Password reset tokens
CREATE INDEX IF NOT EXISTS "password_reset_tokens_token_used_idx" ON "password_reset_tokens" ("token", "used");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_user_id_created_at_idx" ON "password_reset_tokens" ("user_id", "created_at");
