DO $$ BEGIN
 CREATE TYPE "public"."email_verification_status" AS ENUM('pending', 'verified', 'expired');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."ai_feedback_kind" AS ENUM('encouragement', 'analysis');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"email" varchar(255) NOT NULL,
	"code" varchar(10) NOT NULL,
	"status" "email_verification_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" varchar(255) NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_question_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"diary_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(50) NOT NULL,
	"version" varchar(20) DEFAULT '1.0' NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "files" (
	"id" serial PRIMARY KEY NOT NULL,
	"path" text NOT NULL,
	"mimetype" text NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "files_path_unique" UNIQUE("path")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "diary_answers" DROP CONSTRAINT "diary_answers_question_id_diary_questions_id_fk";
EXCEPTION
 WHEN undefined_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "music_jobs" ALTER COLUMN "keywords" SET DATA TYPE jsonb;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_feedback" ADD COLUMN "user_id" uuid NOT NULL;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_feedback" ADD COLUMN "kind" "ai_feedback_kind" NOT NULL;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_feedback" ADD COLUMN "prompt_version" varchar(50);
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_feedback" ADD COLUMN "input_excerpt" text;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_feedback" ADD COLUMN "output_text" text NOT NULL;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "diaries" ADD COLUMN "ai_message" text;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "diary_images" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "diary_questions" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "music_jobs" ADD COLUMN "source_diary_ids" jsonb NOT NULL;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "music_jobs" ADD COLUMN "overall_emotion" varchar(100);
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "music_jobs" ADD COLUMN "mood" varchar(100);
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "music_jobs" ADD COLUMN "lyrical_theme" text;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "music_jobs" ADD COLUMN "music_prompt" text;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "music_jobs" ADD COLUMN "provider" varchar(50);
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "music_jobs" ADD COLUMN "provider_job_id" varchar(255);
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "music_jobs" ADD COLUMN "audio_url" text;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "music_jobs" ADD COLUMN "thumbnail_url" text;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "music_jobs" ADD COLUMN "duration_seconds" integer;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "music_jobs" ADD COLUMN "song_title" varchar(50);
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "music_jobs" ADD COLUMN "song_title_en" varchar(50);
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_question_history" ADD CONSTRAINT "user_question_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_question_history" ADD CONSTRAINT "user_question_history_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_feedback" ADD CONSTRAINT "ai_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_feedback" DROP COLUMN "message";
EXCEPTION
 WHEN undefined_column THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "diary_images" DROP COLUMN "order";
EXCEPTION
 WHEN undefined_column THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "diary_questions" DROP COLUMN "order";
EXCEPTION
 WHEN undefined_column THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "music_jobs" DROP COLUMN "selected_diary_ids";
EXCEPTION
 WHEN undefined_column THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "music_jobs" DROP COLUMN "emotion_analysis";
EXCEPTION
 WHEN undefined_column THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "music_jobs" DROP COLUMN "ai_message";
EXCEPTION
 WHEN undefined_column THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "music_jobs" DROP COLUMN "music_url";
EXCEPTION
 WHEN undefined_column THEN null;
END $$;