import { Hono } from "hono";
import { pinoLogger } from "hono-pino";
import { serveStatic } from "@hono/node-server/serve-static";

import { db } from "../auth.js";
import authHandler from "./routes/auth.js";
import healthHandler from "./routes/health.js";
import homeHandler from "./routes/home.js";
import profileHandler from "./routes/profile.js";
import whoamiHandler from "./routes/whoami.js";
import adminHandler from "./routes/admin.js";

// demo
import demoHandler from "./demo/routes.js";

/**
 * Creates the Hono application instance
 * @param {Object} auth - Better Auth instance
 * @param {Object|null} [injectedDb] - Optional database to inject for testing.
 *   When null, health endpoint returns 503 (database unavailable).
 *   When undefined (not provided), uses the default db from auth.js.
 * @returns {Hono} Configured Hono application
 */
export function createApp(auth, injectedDb) {
  // Validate auth instance
  if (!auth?.api?.getSession) {
    throw new Error("Invalid auth instance passed to createApp");
  }

  const app = new Hono();

  // register middlewares
  app.use(
    pinoLogger({
      pino: {
        level: "debug",
        formatters: {
          level: (label) => {
            return { level: label };
          },
        },
        redact: [
          "req.headers.cookie",
          "req.headers.authorization",
          'req.headers["user-agent"]',
        ],
      },
      // Skip logging for health endpoints to reduce noise
      // Returns true to skip logging, false to log
      onRequest: (c) => {
        return c.req.path === "/health";
      },
    }),
  );

  // Auth and DB context middleware
  // injectedDb === undefined: use default db (production)
  // injectedDb === null: health endpoint sees null (test null scenario)
  // injectedDb is object: use injected db (test fake scenarios)
  app.use("*", (c, next) => {
    c.set("auth", auth);
    c.set("db", injectedDb !== undefined ? injectedDb : db);
    return next();
  });

  // Better-auth API routes
  app.on(["POST", "GET"], "/api/auth/*", (c) => {
    return auth.handler(c.req.raw);
  });

  // Health check routes (no session required)
  app.route("/", healthHandler);

  // Session middleware - adds user and session to context
  app.use("*", async (c, next) => {
    const authInstance = c.get("auth");
    try {
      const session = await authInstance.api.getSession({
        headers: c.req.raw.headers,
      });

      c.set("user", session?.user || null);
      c.set("session", session?.session || null);
    } catch (error) {
      console.error(`Failed to set user in session: ${error}`);
      c.set("user", null);
      c.set("session", null);
    }

    return next();
  });

  // register all route handlers
  app.route("/", authHandler);
  app.route("/", homeHandler);
  app.route("/", profileHandler);
  app.route("/", whoamiHandler);
  app.route("/", adminHandler);

  app.route("/demo", demoHandler);

  // serve assets, etc.
  app.use("/static/*", serveStatic({ root: "./" }));

  return app;
}
