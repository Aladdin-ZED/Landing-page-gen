/**
 * drizzle-kit configuration (MariaDB 10.4+ / MySQL 8 — "mysql" dialect).
 *
 *   npm run db:generate   → writes SQL migrations to ./drizzle from src/lib/db/schema.ts
 *   npm run db:migrate    → applies them (the app also applies them at boot, see src/instrumentation.ts)
 *
 * Credentials come from DATABASE_URL, loaded from .env.local first, then .env (first file wins).
 */
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  dialect: "mysql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  // `generate` works offline; commands that connect (migrate/studio/push) fail with a clear error when unset.
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  breakpoints: true,
  strict: true,
  verbose: true,
});
