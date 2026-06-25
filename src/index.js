import { serve } from "@hono/node-server";
import { createApp } from "./app/app.js";
import appConfig from "./config.js";
import { auth, db } from "./auth.js";

const githubId = appConfig.social.github.id;
const githubSecret = appConfig.social.github.secret;
if (!githubId || !githubSecret) {
  console.error("GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET must be set.");
  console.error(
    "Copy .envrc-dist to .envrc, fill in your values, and run: source .envrc",
  );
  process.exit(1);
}

const app = createApp(auth);

const server = serve(
  {
    fetch: app.fetch,
    port: appConfig.port,
  },
  () => {
    console.log(`Server is running on ${appConfig.base_url}`);
  },
);

// graceful shutdown
process.on("SIGINT", async () => {
  // Close database connection pool if using Postgres
  if (db.end) {
    try {
      await db.end();
    } catch (err) {
      console.error("Error closing database connection:", err);
    }
  }
  server.close();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  // Close database connection pool if using Postgres
  if (db.end) {
    try {
      await db.end();
    } catch (err) {
      console.error("Error closing database connection:", err);
    }
  }
  server.close((err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    process.exit(0);
  });
});
