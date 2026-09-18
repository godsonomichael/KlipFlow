CREATE TABLE `clipper_settings` (
	`user_id` varchar(64) NOT NULL,
	`tiktok_rate` decimal(12,2),
	`instagram_rate` decimal(12,2),
	`youtube_rate` decimal(12,2),
	`x_rate` decimal(12,2),
	`telegram_chat_id` varchar(120),
	`telegram_enabled` boolean NOT NULL DEFAULT false,
	`telegram_milestone` int NOT NULL DEFAULT 10000,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clipper_settings_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `connected_accounts` (
	`id` char(36) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`platform` varchar(32) NOT NULL,
	`handle` varchar(120) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'placeholder',
	`access_token` text,
	`refresh_token` text,
	`token_expires_at` timestamp,
	`provider_user_id` varchar(160),
	`provider_account_name` varchar(160),
	`provider_metadata` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `connected_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `connected_accounts_unique` UNIQUE(`user_id`,`platform`,`handle`)
);
--> statement-breakpoint
CREATE TABLE `generated_clips` (
	`id` char(36) NOT NULL,
	`project_id` char(36) NOT NULL,
	`title` varchar(120) NOT NULL,
	`caption` text,
	`clip_url` text,
	`status` varchar(32) NOT NULL DEFAULT 'ready',
	`start_seconds` decimal(10,2),
	`end_seconds` decimal(10,2),
	`duration_seconds` decimal(10,2),
	`processing_job_id` char(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `generated_clips_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `klipflow_notifications` (
	`id` char(36) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`type` varchar(64) NOT NULL,
	`title` varchar(160) NOT NULL,
	`body` text NOT NULL,
	`href` varchar(255),
	`is_read` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `klipflow_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` char(36) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`title` varchar(120) NOT NULL,
	`source_link` text,
	`file_url` text,
	`requirements_link` text,
	`requirements_file` text,
	`status` varchar(32) NOT NULL DEFAULT 'created',
	`processing_error` text,
	`processed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `klipflow_reminder_deliveries` (
	`id` char(36) NOT NULL,
	`submission_id` char(36) NOT NULL,
	`reminder_minute` int NOT NULL,
	`channel` varchar(32) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `klipflow_reminder_deliveries_id` PRIMARY KEY(`id`),
	CONSTRAINT `reminder_delivery_unique` UNIQUE(`submission_id`,`reminder_minute`,`channel`)
);
--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` char(36) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`clip_id` char(36) NOT NULL,
	`post_url` text,
	`platform` varchar(32),
	`provider_post_id` varchar(160),
	`provider_status` varchar(32),
	`views` bigint NOT NULL DEFAULT 0,
	`status` varchar(32) NOT NULL DEFAULT 'pending',
	`earnings` decimal(12,2) NOT NULL DEFAULT '0',
	`rate_per_thousand` decimal(12,2),
	`whop_submission_status` varchar(32) NOT NULL DEFAULT 'not_submitted',
	`whop_submitted_at` timestamp,
	`posted_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`last_view_sync_at` timestamp,
	`view_sync_error` text,
	CONSTRAINT `submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `clips_project_created_idx` ON `generated_clips` (`project_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `notifications_user_created_idx` ON `klipflow_notifications` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `projects_user_created_idx` ON `projects` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `submissions_user_created_idx` ON `submissions` (`user_id`,`created_at`);