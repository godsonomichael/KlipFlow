CREATE TABLE IF NOT EXISTS projects (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  title VARCHAR(120) NOT NULL,
  source_link TEXT NULL,
  file_url TEXT NULL,
  requirements_link TEXT NULL,
  requirements_file TEXT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'created',
  processing_error TEXT NULL,
  processed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX projects_user_created_idx (user_id, created_at),
  CONSTRAINT projects_user_fk FOREIGN KEY (user_id) REFERENCES users(openId) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS generated_clips (
  id CHAR(36) NOT NULL PRIMARY KEY,
  project_id CHAR(36) NOT NULL,
  title VARCHAR(120) NOT NULL,
  caption TEXT NULL,
  clip_url TEXT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ready',
  start_seconds DECIMAL(10,2) NULL,
  end_seconds DECIMAL(10,2) NULL,
  duration_seconds DECIMAL(10,2) NULL,
  processing_job_id CHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX clips_project_created_idx (project_id, created_at),
  CONSTRAINT clips_project_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS connected_accounts (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  platform VARCHAR(32) NOT NULL,
  handle VARCHAR(120) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'placeholder',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY connected_accounts_unique (user_id, platform, handle),
  CONSTRAINT connected_accounts_user_fk FOREIGN KEY (user_id) REFERENCES users(openId) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS clipper_settings (
  user_id VARCHAR(64) NOT NULL PRIMARY KEY,
  tiktok_rate DECIMAL(12,2) NULL,
  instagram_rate DECIMAL(12,2) NULL,
  youtube_rate DECIMAL(12,2) NULL,
  x_rate DECIMAL(12,2) NULL,
  telegram_chat_id VARCHAR(120) NULL,
  telegram_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  telegram_milestone INT NOT NULL DEFAULT 10000,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT clipper_settings_user_fk FOREIGN KEY (user_id) REFERENCES users(openId) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS submissions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  clip_id CHAR(36) NOT NULL,
  post_url TEXT NULL,
  platform VARCHAR(32) NULL,
  provider_post_id VARCHAR(160) NULL,
  provider_status VARCHAR(32) NULL,
  views BIGINT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  earnings DECIMAL(12,2) NOT NULL DEFAULT 0,
  rate_per_thousand DECIMAL(12,2) NULL,
  whop_submission_status VARCHAR(32) NOT NULL DEFAULT 'not_submitted',
  whop_submitted_at TIMESTAMP NULL,
  posted_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_view_sync_at TIMESTAMP NULL,
  view_sync_error TEXT NULL,
  INDEX submissions_user_created_idx (user_id, created_at),
  CONSTRAINT submissions_user_fk FOREIGN KEY (user_id) REFERENCES users(openId) ON DELETE CASCADE,
  CONSTRAINT submissions_clip_fk FOREIGN KEY (clip_id) REFERENCES generated_clips(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS klipflow_notifications (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  type VARCHAR(64) NOT NULL,
  title VARCHAR(160) NOT NULL,
  body TEXT NOT NULL,
  href VARCHAR(255) NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX notifications_user_created_idx (user_id, created_at),
  CONSTRAINT notifications_user_fk FOREIGN KEY (user_id) REFERENCES users(openId) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS klipflow_reminder_deliveries (
  id CHAR(36) NOT NULL PRIMARY KEY,
  submission_id CHAR(36) NOT NULL,
  reminder_minute INT NOT NULL,
  channel VARCHAR(32) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY reminder_delivery_unique (submission_id, reminder_minute, channel),
  CONSTRAINT reminder_submission_fk FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
);
