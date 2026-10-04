import { boolean, integer, pgEnum, pgTable, primaryKey, real, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  displayName: text("display_name"),
  targetRole: text("target_role"),
  resumeText: text("resume_text"),
  leaderboardOptIn: boolean("leaderboard_opt_in").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const accounts = pgTable("accounts", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"), access_token: text("access_token"),
  expires_at: integer("expires_at"), token_type: text("token_type"),
  scope: text("scope"), id_token: text("id_token"), session_state: text("session_state"),
}, (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })]);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
}, (t) => [primaryKey({ columns: [t.identifier, t.token] })]);

export const topics = pgTable("topics", {
  id: uuid("id").primaryKey().defaultRandom(),
  parentId: uuid("parent_id"),
  name: text("name").notNull(),
  track: text("track").notNull(),
});

export const cardType = pgEnum("card_type", ["flashcard", "mcq", "free_text", "math"]);
export const cardSource = pgEnum("card_source", ["ai_fast", "ai_heavy", "book", "user"]);

export const cards = pgTable("cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  topicId: uuid("topic_id").notNull().references(() => topics.id),
  ownerUserId: uuid("owner_user_id").references(() => users.id),
  type: cardType("type").notNull(),
  prompt: text("prompt").notNull(),
  answer: text("answer").notNull(),
  choices: text("choices").array(),
  difficulty: integer("difficulty").notNull().default(1),
  source: cardSource("source").notNull(),
  citation: text("citation"),
  qualityStatus: text("quality_status").notNull().default("ok"),
  flagCount: integer("flag_count").notNull().default(0),
});

export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  cardId: uuid("card_id").notNull().references(() => cards.id),
  clientAnswerId: text("client_answer_id").notNull(),
  rating: integer("rating").notNull(),
  correct: boolean("correct").notNull(),
  responseMs: integer("response_ms").notNull(),
  stability: real("stability").notNull(),
  fsrsDifficulty: real("fsrs_difficulty").notNull(),
  reps: integer("reps").notNull(),
  lapses: integer("lapses").notNull(),
  state: integer("state").notNull(),
  learningSteps: integer("learning_steps").notNull().default(0),
  dueAt: timestamp("due_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("reviews_client_answer_uq").on(t.userId, t.clientAnswerId)]);

export type Card = typeof cards.$inferSelect;
export type Review = typeof reviews.$inferSelect;
