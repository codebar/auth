import { test } from "tap";
import sinon from "sinon";
import { getTestInstance } from "../helpers/test-instance.js";
import { createApp } from "../../src/app/app.js";

/**
 * Convenience: create a health-request function bound to an auth/pool pair
 */
function makeHealthRequest(auth, pool) {
  const app = createApp(auth, pool);
  return () => app.request("/health");
}

/**
 * Assert standard RFC 9457 error fields on a 503 response body
 */
function assertProblemDetails(t, body) {
  t.equal(body.type, "/problems/database-unavailable", "has RFC 9457 type");
  t.equal(body.title, "Database Unavailable", "has RFC 9457 title");
  t.equal(body.status, 503, "has RFC 9457 status");
  t.ok(body.timestamp, "has timestamp");
  t.ok(body.checks, "has checks extension");
  t.equal(body.checks.app.status, "up", "app status is up");
  t.equal(
    body.checks.database.status,
    "disconnected",
    "database is disconnected",
  );
}

/**
 * Fetch /health and assert it returns a 503 RFC 9457 problem response
 * @returns {Promise<Object>} parsed response body
 */
async function expect503Problem(t, auth, pool) {
  const res = await makeHealthRequest(auth, pool)();
  t.equal(res.status, 503, "returns 503 Service Unavailable");
  t.match(
    res.headers.get("content-type"),
    /application\/problem\+json/,
    "content-type is application/problem+json",
  );
  const body = await res.json();
  assertProblemDetails(t, body);
  return body;
}

test("health endpoint feature tests", async (t) => {
  t.test("GET /health returns 200 with healthy status", async (t) => {
    const ti = await getTestInstance(t);
    const res = await makeHealthRequest(ti.auth, ti.pool)();
    t.equal(res.status, 200, "returns 200 OK");

    const body = await res.json();
    t.equal(body.status, 200, "status is 200");
    t.ok(body.timestamp, "has timestamp");
    t.ok(body.checks, "has checks");
    t.equal(body.checks.app.status, "up", "app status is up");
    t.equal(body.checks.database.status, "connected", "database is connected");
    t.equal(
      body.checks.database.type,
      "postgresql",
      "database type is postgresql",
    );
  });

  t.test("GET /health returns JSON with correct structure", async (t) => {
    const ti = await getTestInstance(t);
    const res = await makeHealthRequest(ti.auth, ti.pool)();
    const body = await res.json();

    t.ok(body.status, "has status field");
    t.ok(body.timestamp, "has timestamp field");
    t.ok("latency" in body, "has latency field");
    t.ok(body.checks, "has checks field");
    t.ok(body.checks.app, "has checks.app field");
    t.equal(body.checks.app.status, "up", "app status is up");
    t.ok(body.checks.database, "has checks.database field");
    t.equal(body.checks.database.status, "connected", "database is connected");
    t.equal(
      body.checks.database.type,
      "postgresql",
      "database type is postgresql",
    );
  });

  t.test("timestamp is valid ISO 8601 format", async (t) => {
    const ti = await getTestInstance(t);
    const res = await makeHealthRequest(ti.auth, ti.pool)();
    const body = await res.json();

    const date = new Date(body.timestamp);
    t.ok(!isNaN(date.getTime()), "timestamp is valid ISO 8601");
  });

  t.test(
    "GET /health?type=startup returns 200 with minimal checks",
    async (t) => {
      const ti = await getTestInstance(t);
      const app = createApp(ti.auth, ti.pool);
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
      const fakeQuery = sinon.fake.rejects(new Error("database is locked"));
      const ti = await getTestInstance(t);
      const body = await expect503Problem(t, ti.auth, {
        query: fakeQuery,
      });

      t.ok(body.detail, "has RFC 9457 detail");
      t.match(
        body.checks.database.message,
        /database is locked/,
        "error message matches expected",
      );
      t.ok(fakeQuery.calledOnce, "query was called");
    },
  );

  t.test("returns 503 with generic database error", async (t) => {
    const fakeDb = {
      query: async () => {
        throw new Error("database connection failed");
      },
    };

    const ti = await getTestInstance(t);
    const body = await expect503Problem(t, ti.auth, fakeDb);

    t.match(
      body.detail,
      /database connection failed/,
      "error detail matches expected from fake",
    );
  });

  t.test("returns 503 when database is null", async (t) => {
    const ti = await getTestInstance(t);
    const body = await expect503Problem(t, ti.auth, null);

    t.equal(
      body.detail,
      "Database connection is not available",
      "detail says database not available",
    );
    t.equal(
      body.checks.database.message,
      "Database not available",
      "error message is correct",
    );
  });

  t.test("returns 503 when PostgreSQL-style db query fails", async (t) => {
    const fakeQuery = sinon.fake.rejects(new Error("connection refused"));
    const ti = await getTestInstance(t);
    const body = await expect503Problem(t, ti.auth, { query: fakeQuery });

    t.match(
      body.checks.database.message,
      /connection refused/,
      "error message matches",
    );
    t.ok(fakeQuery.calledOnce, "query was called");
  });
});
