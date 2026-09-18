import { bigint, boolean, char, decimal, index, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const projects = mysqlTable("projects", {
  id: char("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  title: varchar("title", { length: 120 }).notNull(),
  sourceLink: text("source_link"),
  fileUrl: text("file_url"),
  requirementsLink: text("requirements_link"),
  requirementsFile: text("requirements_file"),
  status: varchar("status", { length: 32 }).default("created").notNull(),
  processingError: text("processing_error"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, table => ({ userCreated: index("projects_user_created_idx").on(table.userId, table.createdAt) }));

export const generatedClips = mysqlTable("generated_clips", {
  id: char("id", { length: 36 }).primaryKey(),
  projectId: char("project_id", { length: 36 }).notNull(),
  title: varchar("title", { length: 120 }).notNull(),
  caption: text("caption"),
  clipUrl: text("clip_url"),
  status: varchar("status", { length: 32 }).default("ready").notNull(),
  startSeconds: decimal("start_seconds", { precision: 10, scale: 2 }),
  endSeconds: decimal("end_seconds", { precision: 10, scale: 2 }),
  durationSeconds: decimal("duration_seconds", { precision: 10, scale: 2 }),
  processingJobId: char("processing_job_id", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, table => ({ projectCreated: index("clips_project_created_idx").on(table.projectId, table.createdAt) }));

export const connectedAccounts = mysqlTable("connected_accounts", {
  id: char("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  platform: varchar("platform", { length: 32 }).notNull(),
  handle: varchar("handle", { length: 120 }).notNull(),
  status: varchar("status", { length: 32 }).default("placeholder").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  providerUserId: varchar("provider_user_id", { length: 160 }),
  providerAccountName: varchar("provider_account_name", { length: 160 }),
  providerMetadata: json("provider_metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, table => ({ uniqueAccount: uniqueIndex("connected_accounts_unique").on(table.userId, table.platform, table.handle) }));

export const clipperSettings = mysqlTable("clipper_settings", {
  userId: varchar("user_id", { length: 64 }).primaryKey(),
  tiktokRate: decimal("tiktok_rate", { precision: 12, scale: 2 }),
  instagramRate: decimal("instagram_rate", { precision: 12, scale: 2 }),
  youtubeRate: decimal("youtube_rate", { precision: 12, scale: 2 }),
  xRate: decimal("x_rate", { precision: 12, scale: 2 }),
  telegramChatId: varchar("telegram_chat_id", { length: 120 }),
  telegramEnabled: boolean("telegram_enabled").default(false).notNull(),
  telegramMilestone: int("telegram_milestone").default(10000).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const submissions = mysqlTable("submissions", {
  id: char("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  clipId: char("clip_id", { length: 36 }).notNull(),
  postUrl: text("post_url"),
  platform: varchar("platform", { length: 32 }),
  providerPostId: varchar("provider_post_id", { length: 160 }),
  providerStatus: varchar("provider_status", { length: 32 }),
  views: bigint("views", { mode: "number" }).default(0).notNull(),
  status: varchar("status", { length: 32 }).default("pending").notNull(),
  earnings: decimal("earnings", { precision: 12, scale: 2 }).default("0").notNull(),
  ratePerThousand: decimal("rate_per_thousand", { precision: 12, scale: 2 }),
  whopSubmissionStatus: varchar("whop_submission_status", { length: 32 }).default("not_submitted").notNull(),
  whopSubmittedAt: timestamp("whop_submitted_at"),
  postedAt: timestamp("posted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastViewSyncAt: timestamp("last_view_sync_at"),
  viewSyncError: text("view_sync_error"),
}, table => ({ userCreated: index("submissions_user_created_idx").on(table.userId, table.createdAt) }));

export const notifications = mysqlTable("klipflow_notifications", {
  id: char("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  type: varchar("type", { length: 64 }).notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  body: text("body").notNull(),
  href: varchar("href", { length: 255 }),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, table => ({ userCreated: index("notifications_user_created_idx").on(table.userId, table.createdAt) }));

export const reminderDeliveries = mysqlTable("klipflow_reminder_deliveries", {
  id: char("id", { length: 36 }).primaryKey(),
  submissionId: char("submission_id", { length: 36 }).notNull(),
  reminderMinute: int("reminder_minute").notNull(),
  channel: varchar("channel", { length: 32 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, table => ({ uniqueDelivery: uniqueIndex("reminder_delivery_unique").on(table.submissionId, table.reminderMinute, table.channel) }));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
