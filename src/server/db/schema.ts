// SEED Database Schema
// https://orm.drizzle.team/docs/sql-schema-declaration

import { sql } from "drizzle-orm";
import { index, pgTableCreator, uuid, varchar, text, timestamp, jsonb } from "drizzle-orm/pg-core";

/**
 * Multi-project schema feature of Drizzle ORM.
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `gemini-hackathon_${name}`);

/**
 * User sessions (no auth, just session tracking)
 */
export const userSessions = createTable(
  "user_session",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    sessionId: d.varchar({ length: 256 }).notNull().unique(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    lastActiveAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [index("session_id_idx").on(t.sessionId)]
);

/**
 * User contexts from onboarding Q&A (multimodal input processed to JSON)
 */
export const userContexts = createTable(
  "user_context",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    sessionId: d.varchar({ length: 256 }).notNull(),
    // Structured context extracted by onboarding agent
    context: d.jsonb().$type<{
      name?: string;
      location?: string;
      biggestPriority?: string;
      lookingFor?: string;
      funActivities?: string[];
      skills?: string[];
      goals?: string[];
      preferences?: Record<string, unknown>;
    }>().notNull(),
    // Raw conversation thread ID for reference
    threadId: d.varchar({ length: 256 }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("user_context_session_idx").on(t.sessionId),
    index("user_context_thread_idx").on(t.threadId)
  ]
);

/**
 * Conversations (public, stored for future reference)
 */
export const conversations = createTable(
  "conversation",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    threadId: d.varchar({ length: 256 }).notNull().unique(),
    // Type: onboarding, search, simulation
    type: d.varchar({ length: 50 }).notNull(),
    // Participants (e.g., [sessionId1, profileId2])
    participants: d.jsonb().$type<string[]>().notNull(),
    // AI-generated summary of the conversation
    summary: d.text(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("conversation_thread_idx").on(t.threadId),
    index("conversation_type_idx").on(t.type)
  ]
);

/**
 * Chat messages (stores conversation history)
 */
export const chatMessages = createTable(
  "chat_message",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    conversationId: d.uuid().notNull().references(() => conversations.id, { onDelete: "cascade" }),
    role: d.varchar({ length: 50 }).notNull(), // user, assistant, system
    content: d.text().notNull(),
    // Optional: multimodal metadata (e.g., image URLs, voice transcripts)
    metadata: d.jsonb().$type<{
      imageUrl?: string;
      audioUrl?: string;
      originalFormat?: string;
    }>(),
    timestamp: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  }),
  (t) => [
    index("chat_message_conversation_idx").on(t.conversationId),
    index("chat_message_timestamp_idx").on(t.timestamp)
  ]
);

/**
 * Profile matches (user → recommended profiles from Vectara search)
 */
export const matches = createTable(
  "match",
  (d) => ({
    id: d.uuid().primaryKey().defaultRandom(),
    // User session ID
    sessionId: d.varchar({ length: 256 }).notNull(),
    // Matched profile username from hackathon dataset
    profileUsername: d.varchar({ length: 256 }).notNull(),
    // Match score from Vectara
    score: d.varchar({ length: 50 }),
    // AI-generated reasoning for the match
    reasoning: d.text(),
    // Status: pending, accepted, simulated, contacted
    status: d.varchar({ length: 50 }).notNull().default('pending'),
    // Reference to simulation conversation if created
    simulationThreadId: d.varchar({ length: 256 }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("match_session_idx").on(t.sessionId),
    index("match_profile_idx").on(t.profileUsername),
    index("match_status_idx").on(t.status)
  ]
);
