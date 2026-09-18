CREATE TABLE `generation_jobs` (
	`id` char(36) NOT NULL,
	`project_id` char(36) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'queued',
	`progress` int NOT NULL DEFAULT 0,
	`current_step` varchar(160),
	`error_message` text,
	`cancel_requested` boolean NOT NULL DEFAULT false,
	`started_at` timestamp,
	`completed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `generation_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `generation_jobs_project_created_idx` ON `generation_jobs` (`project_id`,`created_at`);