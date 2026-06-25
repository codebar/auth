/**
 * Run Better Auth database migrations.
 *
 * Usage: node scripts/migrate.js
 *
 * This is idempotent — safe to run multiple times.
 * Intended for Heroku release phase or one-off commands,
 * not the web process boot path.
 */
import { getMigrations } from "better-auth/db/migration";
import { auth, db } from "../src/auth.js";
import { seedPlannerClient } from "../src/app/db/seed-client.js";
import appConfig from "../src/config.js";

const migrations = await getMigrations(auth.options);
await migrations.runMigrations();

// Seed the planner OAuth client after migrations
await seedPlannerClient(db, appConfig.planner_redirect_uris);

console.log("Migrations complete. Planner client seeded.");

process.exit(0);
