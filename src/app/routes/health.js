import { Hono } from "hono";

const healthHandler = new Hono();

healthHandler.get("/health", async (c) => {
  const timestamp = new Date().toISOString();
  const startTime = Date.now();

  // Get database from context (allows injection for testing)
  const db = c.get("db");

  // Check for Heroku startup health check (skip DB check for fast startup)
  const isStartupCheck = c.req.query("type") === "startup";

  try {
    if (isStartupCheck) {
      return c.json(
        {
          status: 200,
          timestamp,
          latency: Date.now() - startTime,
          checks: {
            app: { status: "up" },
          },
        },
        200,
        { "Content-Type": "application/json" },
      );
    }

    if (!db) {
      return c.json(
        {
          type: "/problems/database-unavailable",
          title: "Database Unavailable",
          status: 503,
          detail: "Database connection is not available",
          timestamp,
          latency: Date.now() - startTime,
          checks: {
            app: { status: "up" },
            database: {
              status: "disconnected",
              message: "Database not available",
            },
          },
        },
        503,
        { "Content-Type": "application/problem+json" },
      );
    }

    // Check database connectivity
    await db.query("SELECT 1");

    return c.json(
      {
        status: 200,
        timestamp,
        latency: Date.now() - startTime,
        checks: {
          app: { status: "up" },
          database: {
            status: "connected",
            type: "postgresql",
          },
        },
      },
      200,
      { "Content-Type": "application/json" },
    );
  } catch (error) {
    return c.json(
      {
        type: "/problems/database-unavailable",
        title: "Database Unavailable",
        status: 503,
        detail: error.message,
        timestamp,
        latency: Date.now() - startTime,
        checks: {
          app: { status: "up" },
          database: {
            status: "disconnected",
            message: error.message,
          },
        },
      },
      503,
      { "Content-Type": "application/problem+json" },
    );
  }
});

export default healthHandler;
