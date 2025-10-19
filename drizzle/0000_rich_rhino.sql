CREATE TABLE "gemini-hackathon_chat_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversationId" uuid NOT NULL,
	"role" varchar(50) NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gemini-hackathon_conversation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"threadId" varchar(256) NOT NULL,
	"type" varchar(50) NOT NULL,
	"participants" jsonb NOT NULL,
	"summary" text,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp with time zone,
	CONSTRAINT "gemini-hackathon_conversation_threadId_unique" UNIQUE("threadId")
);
--> statement-breakpoint
CREATE TABLE "gemini-hackathon_match" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sessionId" varchar(256) NOT NULL,
	"profileUsername" varchar(256) NOT NULL,
	"score" varchar(50),
	"reasoning" text,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"simulationThreadId" varchar(256),
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "gemini-hackathon_user_context" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sessionId" varchar(256) NOT NULL,
	"context" jsonb NOT NULL,
	"threadId" varchar(256),
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "gemini-hackathon_user_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sessionId" varchar(256) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"lastActiveAt" timestamp with time zone,
	CONSTRAINT "gemini-hackathon_user_session_sessionId_unique" UNIQUE("sessionId")
);
--> statement-breakpoint
ALTER TABLE "gemini-hackathon_chat_message" ADD CONSTRAINT "gemini-hackathon_chat_message_conversationId_gemini-hackathon_conversation_id_fk" FOREIGN KEY ("conversationId") REFERENCES "public"."gemini-hackathon_conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_message_conversation_idx" ON "gemini-hackathon_chat_message" USING btree ("conversationId");--> statement-breakpoint
CREATE INDEX "chat_message_timestamp_idx" ON "gemini-hackathon_chat_message" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "conversation_thread_idx" ON "gemini-hackathon_conversation" USING btree ("threadId");--> statement-breakpoint
CREATE INDEX "conversation_type_idx" ON "gemini-hackathon_conversation" USING btree ("type");--> statement-breakpoint
CREATE INDEX "match_session_idx" ON "gemini-hackathon_match" USING btree ("sessionId");--> statement-breakpoint
CREATE INDEX "match_profile_idx" ON "gemini-hackathon_match" USING btree ("profileUsername");--> statement-breakpoint
CREATE INDEX "match_status_idx" ON "gemini-hackathon_match" USING btree ("status");--> statement-breakpoint
CREATE INDEX "user_context_session_idx" ON "gemini-hackathon_user_context" USING btree ("sessionId");--> statement-breakpoint
CREATE INDEX "user_context_thread_idx" ON "gemini-hackathon_user_context" USING btree ("threadId");--> statement-breakpoint
CREATE INDEX "session_id_idx" ON "gemini-hackathon_user_session" USING btree ("sessionId");