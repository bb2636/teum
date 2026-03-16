-- Create questions table (standalone, no question sets)
CREATE TABLE IF NOT EXISTS "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint

-- Create user_question_history table to track question usage
CREATE TABLE IF NOT EXISTS "user_question_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"diary_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Add foreign keys
ALTER TABLE "user_question_history" ADD CONSTRAINT "user_question_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_question_history" ADD CONSTRAINT "user_question_history_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;

-- Create index for efficient querying of recent questions
CREATE INDEX IF NOT EXISTS "user_question_history_user_id_created_at_idx" ON "user_question_history" ("user_id", "created_at");
