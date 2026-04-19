import { serve } from "@hono/node-server";
import { createApp } from "./app/app.js";
import appConfig from "./config.js";
import { auth, db } from "./auth.js";

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
