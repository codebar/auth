# Postgres via Apple Container Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace SQLite with PostgreSQL running in an Apple Container for tests and local development.

**Architecture:** Single Postgres container managed by a bash script (`container` CLI). Each test gets an isolated Postgres schema. `getTestInstance(t)` creates a schema, runs Better Auth migrations inside it, and auto-teardowns via `t.teardown()`.

**Tech Stack:** Apple `container` CLI, `postgres:16-alpine`, `pg` (node-postgres), Better Auth (Kysely adapter), tap (test runner).

## Global Constraints

- `container` CLI must be installed (checked at runtime)
- Default Postgres port: 5433 (configurable via `AUTH_TEST_PG_PORT`)
- Env vars prefixed with `AUTH_`
- Container name: `auth-dev-pg`
- Per-test schema isolation (unique schema per `getTestInstance()` call)
- All SQLite references removed from codebase
- `better-sqlite3` removed from dependencies
- Health handler simplified to Postgres-only
- Test fakes use `async` `.query()` not `.prepare()`

---

### Task 1: Container script, npm scripts, prereqs checker

**Files:**
- Create: `scripts/container.sh`
- Create: `test/helpers/container.js`
- Modify: `package.json` (add scripts, remove `better-sqlite3`)

- [ ] **Step 1: Create `scripts/container.sh`**

```bash
#!/bin/bash
set -e

CONTAINER_NAME="auth-dev-pg"

# Env vars with defaults
AUTH_TEST_PG_PORT="${AUTH_TEST_PG_PORT:-5433}"
AUTH_TEST_PG_USER="${AUTH_TEST_PG_USER:-auth}"
AUTH_TEST_PG_PASSWORD="${AUTH_TEST_PG_PASSWORD:-auth}"
AUTH_TEST_PG_DB="${AUTH_TEST_PG_DB:-test}"

command -v container >/dev/null 2>&1 || { echo "Error: apple/container not installed. See https://github.com/apple/container"; exit 1; }

container_exists() {
    local output
    output=$(container inspect "$CONTAINER_NAME" 2>/dev/null)
    [ -n "$output" ] && [ "$output" != "[]" ]
}

wait_for_port() {
    local port="$1"
    for i in $(seq 1 30); do
        if nc -z 127.0.0.1 "$port" 2>/dev/null; then
            return 0
        fi
        sleep 1
    done
    return 1
}

start() {
    if container_exists "$CONTAINER_NAME"; then
        echo "$CONTAINER_NAME is already running (port $AUTH_TEST_PG_PORT -> 5432)"
        exit 0
    fi

    container stop "$CONTAINER_NAME" 2>/dev/null || true
    container delete "$CONTAINER_NAME" 2>/dev/null || true

    echo "Starting Postgres on port $AUTH_TEST_PG_PORT..."
    container run -d \
        --name "$CONTAINER_NAME" \
        -p "${AUTH_TEST_PG_PORT}:5432" \
        -e POSTGRES_USER="$AUTH_TEST_PG_USER" \
        -e POSTGRES_PASSWORD="$AUTH_TEST_PG_PASSWORD" \
        -e POSTGRES_DB="$AUTH_TEST_PG_DB" \
        postgres:16-alpine

    echo "Waiting for Postgres on port $AUTH_TEST_PG_PORT..."
    if wait_for_port "$AUTH_TEST_PG_PORT"; then
        echo "$CONTAINER_NAME is running (port $AUTH_TEST_PG_PORT -> 5432)"
    else
        echo "ERROR: Postgres failed to start"
        container logs "$CONTAINER_NAME"
        exit 1
    fi
}

stop() {
    echo "Stopping $CONTAINER_NAME..."
    container stop "$CONTAINER_NAME" 2>/dev/null || true
    container delete "$CONTAINER_NAME" 2>/dev/null || true
    echo "Stopped"
}

status() {
    if container_exists "$CONTAINER_NAME"; then
        echo "$CONTAINER_NAME: running (port ${AUTH_TEST_PG_PORT} -> 5432)"
    else
        echo "$CONTAINER_NAME: not running"
    fi
}

logs() {
    container logs "$CONTAINER_NAME" 2>/dev/null || echo "Container not found"
}

ensure() {
    if container_exists "$CONTAINER_NAME"; then
        # Already running — verify port is reachable
        if nc -z 127.0.0.1 "$AUTH_TEST_PG_PORT" 2>/dev/null; then
            exit 0
        fi
        # Container exists but port not reachable — restart
        echo "Container exists but port not reachable, restarting..."
        stop
    fi
    start
}

case "$1" in
    start) start ;;
    stop) stop ;;
    status) status ;;
    logs) logs ;;
    ensure) ensure ;;
    restart) stop; start ;;
    *)
        echo "Usage: $0 {start|stop|status|logs|ensure|restart}"
        echo ""
        echo "Environment variables (with defaults):"
        echo "  AUTH_TEST_PG_PORT      Host port (5433)"
        echo "  AUTH_TEST_PG_USER      Postgres user (auth)"
        echo "  AUTH_TEST_PG_PASSWORD  Postgres password (auth)"
        echo "  AUTH_TEST_PG_DB        Database name (test)"
        exit 1
        ;;
esac
```

- [ ] **Step 2: Test the script starts the container**

Run:
```bash
chmod +x scripts/container.sh
scripts/container.sh start
```
Expected: container starts, port 5433 becomes reachable.

- [ ] **Step 3: Stop the container**

Run:
```bash
scripts/container.sh stop
```
Expected: container stopped and deleted.

- [ ] **Step 4: Create `test/helpers/container.js`**

```js
import { execSync } from "child_process";
import net from "net";
import { Pool } from "pg";

const PORT = parseInt(process.env.AUTH_TEST_PG_PORT || "5433");
const HOST = process.env.AUTH_TEST_PG_HOST || "localhost";
const USER = process.env.AUTH_TEST_PG_USER || "auth";
const PASSWORD = process.env.AUTH_TEST_PG_PASSWORD || "auth";
const DATABASE = process.env.AUTH_TEST_PG_DB || "test";

function log(message) {
  console.log(`[container] ${message}`);
}

function error(message) {
  console.error(`[container] ERROR: ${message}`);
}

function checkContainerCommand() {
  try {
    execSync("command -v container", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function checkContainerService() {
  try {
    const output = execSync("container system status", {
      encoding: "utf8",
    });
    return output.includes("running");
  } catch {
    return false;
  }
}

function checkPort(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function waitForPostgres(maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    if (await checkPort(PORT)) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function verifyPostgresConnection() {
  try {
    const pool = new Pool({
      host: HOST,
      port: PORT,
      database: DATABASE,
      user: USER,
      password: PASSWORD,
      connectionTimeoutMillis: 5000,
    });
    await pool.query("SELECT 1");
    await pool.end();
    return true;
  } catch {
    return false;
  }
}

export async function ensurePostgres() {
  log("Checking prerequisites...");

  if (!checkContainerCommand()) {
    error("apple/container is not installed.");
    error("Install from: https://github.com/apple/container");
    process.exit(1);
  }
  log("container CLI found");

  if (!checkContainerService()) {
    error("container service is not running.");
    error("Start it with: container system start");
    process.exit(1);
  }
  log("container service is running");

  const portOpen = await checkPort(PORT);
  if (!portOpen) {
    log("Postgres not reachable. Starting container...");
    try {
      execSync("scripts/container.sh ensure", { stdio: "inherit" });
    } catch {
      error("Failed to start Postgres container");
      process.exit(1);
    }

    const ready = await waitForPostgres();
    if (!ready) {
      error("Postgres did not become reachable");
      process.exit(1);
    }
  }

  log("Postgres port is reachable");

  const connected = await verifyPostgresConnection();
  if (!connected) {
    error("Cannot authenticate to Postgres");
    process.exit(1);
  }

  log("Postgres connection verified — ready");
}

// Run directly: node test/helpers/container.js
ensurePostgres()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
```

- [ ] **Step 5: Update `package.json` scripts and remove `better-sqlite3`**

Edit `package.json`:

- Add `"test:pg:start": "scripts/container.sh start"` to scripts
- Add `"test:pg:stop": "scripts/container.sh stop"` to scripts
- Add `"test:pg:status": "scripts/container.sh status"` to scripts
- Change `"dev"` to `"scripts/container.sh ensure && node --watch src/index.js"`
- Add `"pretest": "node test/helpers/container.js"` to scripts
- Remove `"better-sqlite3"` from `dependencies`

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add container.sh and prereqs checker for Postgres test container"
```

---

### Task 2: Auth module, config, health handler — remove SQLite branches

**Files:**
- Modify: `src/auth.js`
- Modify: `src/config.js`
- Modify: `src/app/routes/health.js`

- [ ] **Step 1: Rewrite `src/auth.js` — remove SQLite branch**

The current file has:
```js
import Database from "better-sqlite3";
// ...
const isPostgres = appConfig.database_url.startsWith("postgres://");

let db;
if (isPostgres) {
  db = new Pool({ connectionString: appConfig.database_url, max: 10 });
  db.on("error", (err) => { ... });
} else {
  db = new Database(appConfig.database_url);
  db.pragma("busy_timeout = 5000");
  db.pragma("synchronous = NORMAL");
}
```

Replace with Postgres-only:

```js
import { Pool } from "pg";
import { betterAuth } from "better-auth";
import { admin, magicLink } from "better-auth/plugins";
import appConfig from "./config.js";

const db = new Pool({
  connectionString: appConfig.database_url,
  max: 10,
});

db.on("error", (err) => {
  console.error("Unexpected database error", err);
  process.exit(-1);
});

export { db };

export const auth = betterAuth({
  database: db,
  baseURL: appConfig.base_url,
  logger: {
    disabled: false,
    level: "debug",
  },
  socialProviders: {
    github: {
      clientId: appConfig.social.github.id,
      clientSecret: appConfig.social.github.secret,
    },
  },
  telemetry: {
    enabled: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, token, url }, request) => {
        console.log(`Magic Link for ${email}: ${url}`);
        console.log(`Token: ${token}`);
        console.log("---");
        return Promise.resolve();
      },
    }),
    admin(),
  ],
});
```

Key changes:
- Removed `import Database from "better-sqlite3"`
- Removed `const isPostgres = ...` detection
- Removed `if/else` — always use `new Pool()`
- Removed `db.pragma()` calls (SQLite-specific)
- Everything else stays identical

- [ ] **Step 2: Update `src/config.js` default DATABASE_URL**

Change:
```js
database_url: process.env.DATABASE_URL || "./auth.db",
```
To:
```js
database_url: process.env.DATABASE_URL || "postgres://auth:auth@localhost:5433/test",
```

- [ ] **Step 3: Simplify `src/app/routes/health.js` — remove SQLite branch**

Find the section:
```js
// Determine database type by checking object capabilities
const isPostgres = typeof db?.query === "function";

// ...

if (isPostgres) {
  await db.query("SELECT 1");
} else {
  db.prepare("SELECT 1").get();
}
```

Replace with:
```js
await db.query("SELECT 1");
```

Also change the response body from:
```js
type: isPostgres ? "postgresql" : "sqlite",
```
To:
```js
type: "postgresql",
```

Remove the `isPostgres` variable entirely since it's no longer needed.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove SQLite branches from auth, config, and health handler"
```

---

### Task 3: Rewrite test helper — per-test Postgres schema isolation

**Files:**
- Modify: `test/helpers/test-instance.js`

This is the core change. The helper gets rewritten to create a Postgres pool per test, create an isolated schema, run Better Auth migrations inside it, and auto-teardown.

- [ ] **Step 1: Write the new `test/helpers/test-instance.js`**

```js
import pg from "pg";
import { betterAuth } from "better-auth";
import { admin, magicLink } from "better-auth/plugins";
import { getMigrations } from "better-auth/db/migration";

/**
 * Creates a Better Auth test instance with isolated PostgreSQL schema
 *
 * @param {Object} t - Tap test context (for auto-teardown via t.teardown())
 * @returns {Promise<{auth: Object, pool: pg.Pool, client: Object, getAuthHeaders: Function, teardown: Function}>}
 */
export async function getTestInstance(t) {
  // Unique schema per test instance
  const schemaName = `test_${crypto.randomUUID().replace(/-/g, "_")}`;

  // Create a small pool for this test
  const pool = new pg.Pool({
    host: process.env.AUTH_TEST_PG_HOST || "localhost",
    port: parseInt(process.env.AUTH_TEST_PG_PORT || "5433"),
    database: process.env.AUTH_TEST_PG_DB || "test",
    user: process.env.AUTH_TEST_PG_USER || "auth",
    password: process.env.AUTH_TEST_PG_PASSWORD || "auth",
    max: 1,
  });

  // Create the schema and set search_path so Better Auth tables go here
  await pool.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
  await pool.query(`SET search_path TO "${schemaName}"`);

  // Store magic links for test retrieval
  const magicLinksStore = [];

  // Configure Better Auth with the pool as database
  const auth = betterAuth({
    database: pool,
    baseURL: "http://localhost:3000",
    logger: {
      disabled: true,
    },
    socialProviders: {
      github: {
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
      },
    },
    telemetry: {
      enabled: false,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
    },
    plugins: [
      magicLink({
        sendMagicLink: async ({ email, token, url }) => {
          magicLinksStore.push({ email, token, url });
        },
      }),
      admin(),
    ],
  });

  // Run Better Auth migrations inside the test's schema
  const { runMigrations } = await getMigrations(auth.options);
  await runMigrations();

  // Create helpers
  const getAuthHeaders = createGetAuthHeaders(auth, magicLinksStore);
  const client = createTestClient(pool);

  // Auto-teardown via tap context
  if (t && typeof t.teardown === "function") {
    t.teardown(async () => {
      await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      await pool.end();
    });
  }

  return {
    auth,
    pool,
    client,
    getAuthHeaders,
    getMagicLinks: () => magicLinksStore,
    teardown: async () => {
      try {
        await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      } catch {
        // Ignore teardown errors
      }
      await pool.end();
    },
  };
}

/**
 * Creates a test client helper with admin operations
 * @param {pg.Pool} pool
 * @returns {Object} Client helper object with admin methods
 */
function createTestClient(pool) {
  return {
    admin: {
      setRole: async ({ userId, role }) => {
        // "user" is a reserved word, must be quoted
        await pool.query(
          'UPDATE "user" SET role = $1 WHERE id = $2',
          [role, userId],
        );
      },
    },
  };
}

/**
 * Creates a function to get authentication headers for test requests
 * @param {Object} auth - Better Auth instance
 * @param {Array} magicLinksStore - Array storing captured magic links
 * @returns {Function} Async function that takes an email and returns auth headers
 */
function createGetAuthHeaders(auth, magicLinksStore) {
  return async function getAuthHeaders(email) {
    // Send magic link
    await auth.api.signInMagicLink({
      body: {
        email,
        callbackURL: "http://localhost:3000/profile",
      },
      headers: new Headers(),
    });

    // Get the magic link from the test array
    const magicLink = magicLinksStore.find((link) => link.email === email);

    if (!magicLink) {
      throw new Error(`No magic link found for ${email}`);
    }

    // Verify the magic link to get a session
    let result;
    try {
      result = await auth.api.magicLinkVerify({
        query: {
          token: magicLink.token,
          callbackURL: "http://localhost:3000/profile",
        },
        headers: new Headers(),
        returnHeaders: true,
      });
    } catch (error) {
      // magicLinkVerify may throw an APIError with the redirect response
      const cookieFromError = extractCookieFromError(error);
      if (cookieFromError) {
        return cookieFromError;
      }
      throw new Error(`Magic link verification failed: ${error.message}`, {
        cause: error,
      });
    }

    if (!result.headers) {
      throw new Error("No headers returned from magic link verification");
    }

    const setCookie = result.headers.get("set-cookie");
    if (!setCookie) {
      throw new Error("No session cookie in magic link verification response");
    }

    return parseSessionCookie(setCookie);
  };
}

/**
 * Extract session cookie from a 302 redirect error response
 * @param {Error} error - The error thrown by magicLinkVerify
 * @returns {{cookie: string}|null} Session cookie object or null if not found
 */
function extractCookieFromError(error) {
  if (error.statusCode !== 302) {
    return null;
  }

  let setCookie;
  if (error.headers && typeof error.headers.get === "function") {
    setCookie = error.headers.get("set-cookie");
  } else if (error.headers && Array.isArray(error.headers)) {
    const setCookieHeader = error.headers.find(
      (h) => h[0].toLowerCase() === "set-cookie",
    );
    setCookie = setCookieHeader ? setCookieHeader[1] : null;
  }

  if (setCookie) {
    return parseSessionCookie(setCookie);
  }

  return null;
}

/**
 * Parse a Set-Cookie header to extract the better-auth session token
 * @param {string} setCookie - The Set-Cookie header value
 * @returns {{cookie: string}} Object containing the cookie header value
 * @throws {Error} If no session token cookie is found
 */
function parseSessionCookie(setCookie) {
  const cookies = setCookie.split(",").map((c) => c.trim());
  const sessionCookie = cookies.find((c) =>
    c.startsWith("better-auth.session_token"),
  );

  if (!sessionCookie) {
    throw new Error("No session token cookie found");
  }

  // Return just the cookie header value (before the semicolon)
  return { cookie: sessionCookie.split(";")[0] };
}
```

- [ ] **Step 2: Start container and verify the helper works**

Run:
```bash
scripts/container.sh ensure
scripts/container.sh status
```
Expected: container is running.

- [ ] **Step 3: Test the new helper in isolation**

```bash
node -e "
import { getTestInstance } from './test/helpers/test-instance.js';
const inst = await getTestInstance();
console.log('Schema created and migrations run');
await inst.teardown();
console.log('Schema dropped');
process.exit(0);
"
```
Expected: runs without errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: rewrite test helper with per-test Postgres schema isolation"
```

---

### Task 4: Update test files — pass `t`, use `pool`, fix health fakes

**Files:**
- Modify: `test/features/admin.test.js` (3 calls)
- Modify: `test/features/authentication.test.js` (1 call)
- Modify: `test/features/health.test.js` (9 calls + fake DBs)
- Modify: `test/features/home.test.js` (2 calls)
- Modify: `test/features/magic-links.test.js` (4 calls)
- Modify: `test/features/profile.test.js` (3 calls)

- [ ] **Step 1: Update `test/features/home.test.js`**

Two calls to `getTestInstance()`. Change both from:
```js
const testInstance = await getTestInstance();
```
To:
```js
const testInstance = await getTestInstance(t);
```

No other changes — these tests only use `testInstance.auth` and `app`.

- [ ] **Step 2: Update `test/features/authentication.test.js`**

One call. Change:
```js
const testInstance = await getTestInstance();
```
To:
```js
const testInstance = await getTestInstance(t);
```

- [ ] **Step 3: Update `test/features/profile.test.js`**

Three calls. Change each from:
```js
const testInstance = await getTestInstance();
```
To:
```js
const testInstance = await getTestInstance(t);
```

- [ ] **Step 4: Update `test/features/magic-links.test.js`**

Four calls. Change each from:
```js
const testInstance = await getTestInstance();
```
To:
```js
const testInstance = await getTestInstance(t);
```

- [ ] **Step 5: Update `test/features/admin.test.js`**

Three calls. Change each from:
```js
const testInstance = await getTestInstance();
```
To:
```js
const testInstance = await getTestInstance(t);
```

- [ ] **Step 6: Update `test/features/health.test.js`**

This file has the most changes. Changes needed:

a) All 4 calls that pass `testInstance.db` → `testInstance.pool`:
```js
// Before:
const app = createApp(testInstance.auth, testInstance.db);
// After:
const app = createApp(testInstance.auth, testInstance.pool);
```
(lines 9, 29, 47, 60)

b) All 9 calls to `getTestInstance()` → `getTestInstance(t)`:
Each `const testInstance = await getTestInstance()` becomes `await getTestInstance(t)`.

c) The fake DB at line 104-118 changes from SQLite-style:
```js
// OLD: SQLite-style fake
const fakeGet = sinon.fake.throws(new Error("database is locked"));
const fakePrepare = sinon.fake.returns({
  get: fakeGet,
});
const fakeDb = {
  prepare: fakePrepare,
};
```
To Postgres-style:
```js
// NEW: Postgres-style fake
const fakeDb = {
  query: sinon.fake.rejects(new Error("database is locked")),
};
```

d) The fake DB at line 134-139 changes from:
```js
// OLD: SQLite-style
const fakeDb = {
  prepare: () => {
    throw new Error("database connection failed");
  },
};
```
To:
```js
// NEW: Postgres-style
const fakeDb = {
  query: async () => {
    throw new Error("database connection failed");
  },
};
```

e) The `database.type` assertion at line 43:
```js
// OLD:
t.ok(["sqlite", "postgresql"].includes(body.checks.database.type), "database type is valid");
```
To:
```js
// NEW:
t.equal(body.checks.database.type, "postgresql", "database type is postgresql");
```

f) Remove SQLite-specific assertions:
- Remove: `t.ok(fakePrepare.calledOnce, "prepare was called");` — `.prepare()` no longer exists
- Remove: `t.ok(fakeGet.calledOnce, "get was called");` — `.get()` no longer exists
- Update: `t.match(body.detail, /database connection failed/, "error detail matches expected for sqlite");` → change description to `"error detail matches expected from fake"` (the assertion itself works since `body.detail` comes from `error.message` regardless of DB type)

- [ ] **Step 7: Run the full test suite**

Run:
```bash
npm test
```
Expected: all tests pass. Note: the "expected error messages" about `SqliteError: no such table: session` should no longer appear since we're using Postgres.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "test: update test files for Postgres — pass t, pool, fix health fakes"
```

---

### Task 5: Cleanup — remove SQLite artifacts, update docs, update envrc

**Files:**
- Delete: `auth.db` (SQLite database file)
- Modify: `docs/development.md`
- Modify: `.envrc-dist`

- [ ] **Step 1: Delete `auth.db`**

```bash
git rm auth.db
```

- [ ] **Step 2: Update `.envrc-dist`**

Add the new environment variables:

```bash
export GITHUB_CLIENT_ID=
export GITHUB_CLIENT_SECRET=
export DATABASE_URL=postgres://auth:auth@localhost:5433/test
export AUTH_TEST_PG_HOST=localhost
export AUTH_TEST_PG_PORT=5433
export AUTH_TEST_PG_USER=auth
export AUTH_TEST_PG_PASSWORD=auth
export AUTH_TEST_PG_DB=test
```

- [ ] **Step 3: Update `docs/development.md`**

Replace the old Docker-based `make run-dev` instructions with:

```markdown
# Development

## Prerequisites

1. Install [Apple Container](https://github.com/apple/container)
2. Install the `container` CLI and start the service:
   ```sh
   container system start
   ```

## Running the app

The app automatically starts the Postgres container if needed:

```sh
npm run dev
```

Or manually manage the container:

```sh
npm run test:pg:start   # Start Postgres container
npm run test:pg:stop    # Stop Postgres container
npm run test:pg:status  # Check container status
```

## Environment

Copy `.envrc-dist` to `.envrc` and add your GitHub OAuth credentials.
The default `DATABASE_URL` points to the local Postgres container.

## Database

Run migrations after pulling new changes:

```sh
npm run db:migrate
```

## Testing

Tests automatically start the Postgres container if it's not running:

```sh
npm test
```
```

- [ ] **Step 4: Final verification — clean test run**

```bash
npm test
```
Expected: all tests pass. No SQLite errors in stderr.

- [ ] **Step 5: Verify `better-sqlite3` is truly gone**

Run:
```bash
npm ls better-sqlite3 2>&1
```
Expected: `missing` or nothing (already removed from package.json in Task 1).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove SQLite artifacts, update docs and envrc"
```
