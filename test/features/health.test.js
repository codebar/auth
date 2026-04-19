import { test } from "tap";
import sinon from "sinon";
import { getTestInstance } from "../helpers/test-instance.js";
import { createApp } from "../../src/app/app.js";

test("health endpoint feature tests", async (t) => {
  t.test("GET /health returns 200 with healthy status", async (t) => {
    const testInstance = await getTestInstance();
    const app = createApp(testInstance.auth, testInstance.db);

    const res = await app.request("/health");

    t.equal(res.status, 200, "returns 200 OK");

    const body = await res.json();
    t.equal(body.status, 200, "status is 200");
    t.ok(body.timestamp, "has timestamp");
    t.ok(body.checks, "has checks");
    t.equal(body.checks.app.status, "up", "app status is up");
    t.equal(body.checks.database.status, "connected", "database is connected");
    t.ok(
      ["sqlite", "postgresql"].includes(body.checks.database.type),
      "database type is valid",
    );
  });

  t.test("GET /health returns JSON with correct structure", async (t) => {
    const testInstance = await getTestInstance();
    const app = createApp(testInstance.auth, testInstance.db);

    const res = await app.request("/health");
    const body = await res.json();

    t.ok(body.status, "has status field");
    t.ok(body.timestamp, "has timestamp field");
    t.ok("latency" in body, "has latency field");
    t.ok(body.checks, "has checks field");
    t.ok(body.checks.app, "has checks.app field");
    t.equal(body.checks.app.status, "up", "app status is up");
    t.ok(body.checks.database, "has checks.database field");
    t.equal(body.checks.database.status, "connected", "database is connected");
    t.ok(body.checks.database.type, "has database type");
  });

  t.test("timestamp is valid ISO 8601 format", async (t) => {
    const testInstance = await getTestInstance();
    const app = createApp(testInstance.auth, testInstance.db);

    const res = await app.request("/health");
    const body = await res.json();

    const date = new Date(body.timestamp);
    t.ok(!isNaN(date.getTime()), "timestamp is valid ISO 8601");
  });

  t.test(
    "GET /health?type=startup returns 200 with minimal checks",
    async (t) => {
      const testInstance = await getTestInstance();
      const app = createApp(testInstance.auth, testInstance.db);

      const res = await app.request("/health?type=startup");

      t.equal(res.status, 200, "returns 200 OK");
      const body = await res.json();
      t.equal(body.status, 200, "status is 200");
      t.ok("latency" in body, "has latency field");
      t.equal(body.checks.app.status, "up", "app status is up");
      t.notOk(body.checks.database, "no database check on startup");
    },
  );
});

test("health endpoint failure states", async (t) => {
  t.test(
    "returns 503 with RFC 9457 format when database query fails",
    async (t) => {
      // Create fake db - test instance uses SQLite (has .prepare(), no .query())
      const fakeGet = sinon.fake.throws(new Error("database is locked"));
      const fakePrepare = sinon.fake.returns({
        get: fakeGet,
      });
      const fakeDb = {
        prepare: fakePrepare,
      };

      // Create app with injected fake database
      const testInstance = await getTestInstance();
      const app = createApp(testInstance.auth, fakeDb);

      const res = await app.request("/health");

      t.equal(res.status, 503, "returns 503 Service Unavailable");
      t.match(
        res.headers.get("content-type"),
        /application\/problem\+json/,
        "content-type is application/problem+json",
      );

      const body = await res.json();
      t.equal(body.type, "/problems/database-unavailable", "has RFC 9457 type");
      t.equal(body.title, "Database Unavailable", "has RFC 9457 title");
      t.equal(body.status, 503, "has RFC 9457 status");
      t.ok(body.detail, "has RFC 9457 detail");
      t.ok(body.timestamp, "has timestamp");
      t.ok(body.checks, "has checks extension");
      t.equal(body.checks.app.status, "up", "app status is up");
      t.equal(
        body.checks.database.status,
        "disconnected",
        "database is disconnected",
      );

      // Verify specific error message for SQLite
      t.match(
        body.checks.database.message,
        /database is locked/,
        "error message matches expected",
      );

      // Verify appropriate fake was called
      t.ok(fakePrepare.calledOnce, "prepare was called");
      t.ok(fakeGet.calledOnce, "get was called");
    },
  );

  t.test(
    "returns 503 with RFC 9457 format on generic database error",
    async (t) => {
      // Create fake db that throws error (SQLite pattern)
      const fakeDb = {
        prepare: () => {
          throw new Error("database connection failed");
        },
      };

      // Create app with injected fake database
      const testInstance = await getTestInstance();
      const app = createApp(testInstance.auth, fakeDb);

      const res = await app.request("/health");

      t.equal(res.status, 503, "returns 503 Service Unavailable");
      t.match(
        res.headers.get("content-type"),
        /application\/problem\+json/,
        "content-type is application/problem+json",
      );

      const body = await res.json();
      t.equal(body.type, "/problems/database-unavailable", "has RFC 9457 type");
      t.equal(body.title, "Database Unavailable", "has RFC 9457 title");
      t.equal(body.status, 503, "has RFC 9457 status");
      t.ok(body.timestamp, "has timestamp");
      t.ok(body.checks, "has checks extension");
      t.equal(body.checks.app.status, "up", "app status is up");

      // Verify specific error message for SQLite
      t.match(
        body.detail,
        /database connection failed/,
        "error detail matches expected for sqlite",
      );
    },
  );

  t.test("returns 503 when database is null", async (t) => {
    // Create app with null database
    const testInstance = await getTestInstance();
    const app = createApp(testInstance.auth, null);

    const res = await app.request("/health");

    t.equal(res.status, 503, "returns 503 Service Unavailable");

    const body = await res.json();
    t.equal(body.type, "/problems/database-unavailable", "has RFC 9457 type");
    t.equal(body.title, "Database Unavailable", "has RFC 9457 title");
    t.equal(body.status, 503, "has RFC 9457 status");
    t.equal(
      body.detail,
      "Database connection is not available",
      "detail says database not available",
    );
    t.equal(body.checks.app.status, "up", "app status is up");
    t.equal(
      body.checks.database.status,
      "disconnected",
      "database is disconnected",
    );
    t.equal(
      body.checks.database.message,
      "Database not available",
      "error message is correct",
    );
  });

  t.test("returns 503 when PostgreSQL-style db query fails", async (t) => {
    // Create fake db that has .query() method (PostgreSQL-style)
    const fakeQuery = sinon.fake.rejects(new Error("connection refused"));
    const fakeDb = {
      query: fakeQuery,
    };

    const testInstance = await getTestInstance();
    const app = createApp(testInstance.auth, fakeDb);

    const res = await app.request("/health");

    t.equal(res.status, 503, "returns 503 Service Unavailable");
    const body = await res.json();
    t.equal(
      body.checks.database.status,
      "disconnected",
      "database is disconnected",
    );
    t.match(
      body.checks.database.message,
      /connection refused/,
      "error message matches",
    );
    t.ok(fakeQuery.calledOnce, "query was called");
  });
});
