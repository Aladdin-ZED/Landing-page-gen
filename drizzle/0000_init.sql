CREATE TABLE `assets` (
	`id` varchar(64) NOT NULL,
	`kind` enum('image','video') NOT NULL DEFAULT 'image',
	`mime` varchar(40) NOT NULL,
	`width` int NOT NULL,
	`height` int NOT NULL,
	`bytes` int NOT NULL,
	`alpha` boolean NOT NULL DEFAULT false,
	`dominant` char(7) NOT NULL DEFAULT '#cccccc',
	`palette` longtext,
	`variants` longtext NOT NULL,
	`original_name` varchar(200),
	`source_asset_id` varchar(64),
	`tags` longtext,
	`created_by` varchar(26),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `assets_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`user_id` varchar(26),
	`action` varchar(64) NOT NULL,
	`target` varchar(191),
	`meta` longtext,
	`ip` varchar(64),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE `blocklist` (
	`id` varchar(26) NOT NULL,
	`kind` enum('phone','ip') NOT NULL,
	`value` varchar(64) NOT NULL,
	`reason` varchar(200),
	`created_by` varchar(26),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `blocklist_id` PRIMARY KEY(`id`),
	CONSTRAINT `block_uq` UNIQUE(`kind`,`value`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE `exports` (
	`id` varchar(26) NOT NULL,
	`page_id` varchar(26) NOT NULL,
	`version_id` varchar(26) NOT NULL,
	`mode` enum('connected','php','whatsapp') NOT NULL,
	`public_key` varchar(40) NOT NULL,
	`allowed_origins` longtext NOT NULL,
	`file_name` varchar(160),
	`bytes` int,
	`created_by` varchar(26),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`revoked_at` datetime(3),
	CONSTRAINT `exports_id` PRIMARY KEY(`id`),
	CONSTRAINT `exports_key_uq` UNIQUE(`public_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` varchar(26) NOT NULL,
	`page_id` varchar(26) NOT NULL,
	`idem` char(36) NOT NULL,
	`phone` varchar(24) NOT NULL,
	`name` varchar(120),
	`city` varchar(120),
	`bundle_id` varchar(40),
	`utm` longtext,
	`converted_order_id` varchar(20),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `leads_id` PRIMARY KEY(`id`),
	CONSTRAINT `leads_idem_uq` UNIQUE(`idem`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE `media_chunks` (
	`key` varchar(120) NOT NULL,
	`idx` int NOT NULL,
	`data` mediumblob NOT NULL,
	CONSTRAINT `media_chunks_key_idx_pk` PRIMARY KEY(`key`,`idx`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE `media_files` (
	`key` varchar(120) NOT NULL,
	`asset_id` varchar(64) NOT NULL,
	`mime` varchar(40) NOT NULL,
	`bytes` int NOT NULL,
	`chunks` int NOT NULL,
	`sha256` char(64) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `media_files_key` PRIMARY KEY(`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` varchar(20) NOT NULL,
	`page_id` varchar(26) NOT NULL,
	`version_id` varchar(26),
	`export_id` varchar(26),
	`source` enum('live','export','php') NOT NULL DEFAULT 'live',
	`status` varchar(20) NOT NULL DEFAULT 'new',
	`name` varchar(120) NOT NULL,
	`phone` varchar(24) NOT NULL,
	`phone_raw` varchar(40),
	`city` varchar(120),
	`address` varchar(300),
	`note` varchar(400),
	`email` varchar(160),
	`product_name` varchar(160) NOT NULL,
	`items` longtext NOT NULL,
	`qty` int NOT NULL,
	`subtotal` decimal(12,2) NOT NULL,
	`shipping` decimal(12,2) NOT NULL,
	`total` decimal(12,2) NOT NULL,
	`currency` char(3) NOT NULL,
	`locale` varchar(5),
	`utm` longtext,
	`ref` varchar(500),
	`ip_hash` char(64),
	`ua` varchar(300),
	`event_id` varchar(64),
	`idem` char(36) NOT NULL,
	`risk_score` int NOT NULL DEFAULT 0,
	`flags` longtext,
	`upsell_token_hash` char(64),
	`sheet_status` enum('pending','synced','failed','disabled') NOT NULL DEFAULT 'pending',
	`sheet_attempts` int NOT NULL DEFAULT 0,
	`sheet_error` varchar(500),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_idem_uq` UNIQUE(`idem`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE `page_versions` (
	`id` varchar(26) NOT NULL,
	`page_id` varchar(26) NOT NULL,
	`kind` enum('generation','save','publish','restore','import','autosave') NOT NULL,
	`label` varchar(160),
	`doc` longtext NOT NULL,
	`html` longtext,
	`thank_you_html` longtext,
	`csp` text,
	`thank_you_csp` text,
	`etag` varchar(64),
	`thumbnail_asset_id` varchar(64),
	`starred` boolean NOT NULL DEFAULT false,
	`checksum` char(64) NOT NULL,
	`created_by` varchar(26),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `page_versions_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE `pages` (
	`id` varchar(26) NOT NULL,
	`slug` varchar(80) NOT NULL,
	`name` varchar(160) NOT NULL,
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`locale` varchar(5) NOT NULL DEFAULT 'ar',
	`public_key` varchar(40) NOT NULL,
	`draft` longtext NOT NULL,
	`published_version_id` varchar(26),
	`is_home` boolean NOT NULL DEFAULT false,
	`created_by` varchar(26),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `pages_id` PRIMARY KEY(`id`),
	CONSTRAINT `pages_slug_uq` UNIQUE(`slug`),
	CONSTRAINT `pages_key_uq` UNIQUE(`public_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`bucket` varchar(191) NOT NULL,
	`count` int NOT NULL,
	`reset_at` datetime(3) NOT NULL,
	CONSTRAINT `rate_limits_bucket` PRIMARY KEY(`bucket`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` char(64) NOT NULL,
	`user_id` varchar(26) NOT NULL,
	`mfa_passed` boolean NOT NULL DEFAULT false,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`expires_at` datetime(3) NOT NULL,
	`last_seen_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`ip` varchar(64),
	`ua` varchar(300),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` varchar(64) NOT NULL,
	`value` longtext NOT NULL,
	`encrypted` boolean NOT NULL DEFAULT false,
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `settings_key` PRIMARY KEY(`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE `stats_daily` (
	`page_id` varchar(26) NOT NULL,
	`day` date NOT NULL,
	`views` int NOT NULL DEFAULT 0,
	`uniques` int NOT NULL DEFAULT 0,
	`form_starts` int NOT NULL DEFAULT 0,
	`orders` int NOT NULL DEFAULT 0,
	`revenue` decimal(12,2) NOT NULL DEFAULT 0,
	CONSTRAINT `stats_daily_page_id_day_pk` PRIMARY KEY(`page_id`,`day`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE `stats_visitors` (
	`page_id` varchar(26) NOT NULL,
	`day` date NOT NULL,
	`vid_hash` char(32) NOT NULL,
	CONSTRAINT `stats_visitors_page_id_day_vid_hash_pk` PRIMARY KEY(`page_id`,`day`,`vid_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(26) NOT NULL,
	`email` varchar(191) NOT NULL,
	`name` varchar(120) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`role` enum('owner','editor','agent') NOT NULL DEFAULT 'editor',
	`totp_secret_enc` text,
	`totp_enabled` boolean NOT NULL DEFAULT false,
	`recovery_codes` longtext,
	`failed_logins` int NOT NULL DEFAULT 0,
	`locked_until` datetime(3),
	`disabled` boolean NOT NULL DEFAULT false,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`last_login_at` datetime(3),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_uq` UNIQUE(`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE INDEX `assets_created_idx` ON `assets` (`created_at`);--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `exports_page_idx` ON `exports` (`page_id`);--> statement-breakpoint
CREATE INDEX `leads_page_idx` ON `leads` (`page_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `mf_asset_idx` ON `media_files` (`asset_id`);--> statement-breakpoint
CREATE INDEX `orders_phone_idx` ON `orders` (`phone`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_page_idx` ON `orders` (`page_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `orders` (`status`);--> statement-breakpoint
CREATE INDEX `orders_sheet_idx` ON `orders` (`sheet_status`);--> statement-breakpoint
CREATE INDEX `pv_page_idx` ON `page_versions` (`page_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_exp_idx` ON `sessions` (`expires_at`);