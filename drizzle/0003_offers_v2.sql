-- Offers v2 (docs/OFFERS.md section I.2): page_versions.runtime_v (the runtime contract a published version
-- embeds: existing rows = 1, the order API validates v1 payloads against the newest v1 version) and
-- leads.selection (warehouse text of an abandoned lead's offer choice). MariaDB 10.4 has no JSON type:
-- documents stay LONGTEXT. Each column is added only when missing (a column added by hand, by
-- drizzle-kit push or by an interrupted run must not fail every boot), written portably: ADD COLUMN
-- IF NOT EXISTS is MariaDB-only, the app also runs on MySQL 8.
SET @pv_runtime_v_ddl := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `page_versions` ADD `runtime_v` tinyint NOT NULL DEFAULT 1', 'DO 0') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'page_versions' AND column_name = 'runtime_v');--> statement-breakpoint
PREPARE pv_runtime_v_stmt FROM @pv_runtime_v_ddl;--> statement-breakpoint
EXECUTE pv_runtime_v_stmt;--> statement-breakpoint
DEALLOCATE PREPARE pv_runtime_v_stmt;--> statement-breakpoint
SET @leads_selection_ddl := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE `leads` ADD `selection` varchar(400)', 'DO 0') FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'leads' AND column_name = 'selection');--> statement-breakpoint
PREPARE leads_selection_stmt FROM @leads_selection_ddl;--> statement-breakpoint
EXECUTE leads_selection_stmt;--> statement-breakpoint
DEALLOCATE PREPARE leads_selection_stmt;
