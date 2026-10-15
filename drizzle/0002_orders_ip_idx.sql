-- orders_ip_idx (ip_hash, created_at): the per-IP order checks. Created only when missing (an index
-- added by hand, by drizzle-kit push or by an interrupted run must not fail every boot), written
-- portably: CREATE INDEX IF NOT EXISTS is MariaDB-only, the app also runs on MySQL 8.
SET @orders_ip_idx_ddl := (SELECT IF(COUNT(*) = 0, 'CREATE INDEX `orders_ip_idx` ON `orders` (`ip_hash`,`created_at`)', 'DO 0') FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'orders' AND index_name = 'orders_ip_idx');--> statement-breakpoint
PREPARE orders_ip_idx_stmt FROM @orders_ip_idx_ddl;--> statement-breakpoint
EXECUTE orders_ip_idx_stmt;--> statement-breakpoint
DEALLOCATE PREPARE orders_ip_idx_stmt;
