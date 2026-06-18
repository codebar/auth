# Replace SQLite with Postgres via Apple Container

## Problem

Tests use an in-memory SQLite database via `better-sqlite3`. Production/CI use
PostgreSQL. This divergence means the test environment doesn't match production.
It also introduces a build dependency (`better-sqlite3` native addon) that isn't
needed anymore.

## Goals

- Run Postgres in an Apple Container (`container`) for tests and local dev
- Custom port to avoid conflicts with other Postgres instances
- Per-test database isolation via PostgreSQL schemas
- Auto-start Postgres on `npm run dev` and `npm test`
- Same test API surface (`getTestInstance(t)`)
- Remove all SQLite code, including `better-sqlite3` dependency

## Non-goals

- Changing production database setup (Heroku / `DATABASE_URL` still works)
- Changing the Hono application structure
- Adding Redis or other services

## Approach

### Container script (`scripts/container.sh`)

A bash script that manages the Postgres container lifecycle using Apple's
`container` CLI. Only manages Postgres (no Redis, MySQL, etc.).

Commands:

- `start` — Create and start the container if not running
- `stop` — Stop and delete the container
- `status` — Check if container exists
- `logs` — Show container logs
- `ensure` — Start if not running, wait for readiness, exit 0; used by `npm run dev`

Container configuration:

| Parameter | Value | Configurable via |
|---|---|---|
| Image | `postgres:16-alpine` | — |
| Container name | `auth-dev-pg` | — |
| Host port | 5433 | `AUTH_TEST_PG_PORT` (default: 5433) |
| User | `auth` | `AUTH_TEST_PG_USER` (default: auth) |
| Password | `auth` | `AUTH_TEST_PG_PASSWORD` (default: auth) |
| Database | `test` | `AUTH_TEST_PG_DB` (default: test) |

Start command:

```bash
container run -d \
  --name auth-dev-pg \
  -p "${AUTH_TEST_PG_PORT:-5433}:5432" \
  -e POSTGRES_USER="${AUTH_TEST_PG_USER:-auth}" \
  -e POSTGRES_PASSWORD="${AUTH_TEST_PG_PASSWORD:-auth}" \
  -e POSTGRES_DB="${AUTH_TEST_PG_DB:-test}" \
  postgres:16-alpine
```

After starting, waits for the port to be reachable via `nc -z` (up to 30s).

### Prereqs checker (`test/helpers/container.js`)

A Node.js module that checks prerequisites before the test suite runs. Called
from a `--before` hook in `.taprc` or imported directly.

Checks:

1. Is `container` CLI installed?
2. Is the container service running (`container system status`)?
3. Is the Postgres port reachable via TCP?
4. If not reachable, run `scripts/container.sh start`
5. Wait up to 30s for Postgres to accept connections
6. Verify connection with `SELECT 1`

Exits with non-zero if prerequisites cannot be satisfied.

### Test helper (`test/helpers/test-instance.js`)

Rewritten to use PostgreSQL with per-test schema isolation.

```js
import pg from "pg";
import { betterAuth } from "better-auth";
import { admin, magicLink } from "better-auth/plugins";
import { getMigrations } from "better-auth/db/migration";

// createGetAuthHeaders, extractCookieFromError, and parseSessionCookie
// remain unchanged from the current implementation but accept an explicit
// magicLinksStore parameter instead of relying on closure scope.

function createGetAuthHeaders(auth, magicLinksStore) {
  return async function getAuthHeaders(email) {
    await auth.api.signInMagicLink({
      body: {
        email,
        callbackURL: "http://localhost:3000/profile",
      },
      headers: new Headers(),
    });

    const magicLink = magicLinksStore.find((link) => link.email === email);
    if (!magicLink) {
      throw new Error(`No magic link found for ${email}`);
    }

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
      const cookieFromError = extractCookieFromError(error);
      if (cookieFromError) return cookieFromError;
      throw new Error(`Magic link verification failed: ${error.message}`, {
        cause: error,
      });
    }

    const setCookie = result.headers?.get("set-cookie");
    if (!setCookie) throw new Error("No session cookie in response");
    return parseSessionCookie(setCookie);
  };
}

export async function getTestInstance(t) {
  const schemaName = `test_${crypto.randomUUID().replace(/-/g, "_")}`;

  const pool = new pg.Pool({
    host: process.env.AUTH_TEST_PG_HOST || "localhost",
    port: parseInt(process.env.AUTH_TEST_PG_PORT || "5433"),
    database: process.env.AUTH_TEST_PG_DB || "test",
    user: process.env.AUTH_TEST_PG_USER || "auth",
    password: process.env.AUTH_TEST_PG_PASSWORD || "auth",
    max: 1,
  });

  // Create schema and set search_path so Better Auth tables go here
  await pool.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
  await pool.query(`SET search_path TO "${schemaName}"`);

  // Configure Better Auth
  const magicLinksStore = [];
  const auth = betterAuth({
    database: pool,
    baseURL: "http://localhost:3000",
    logger: { disabled: true },
    socialProviders: {
      github: {
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
      },
    },
    telemetry: { enabled: false },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
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

  // Run migrations — tables land in the test's schema via search_path
  const { runMigrations } = await getMigrations(auth.options);
  await runMigrations();

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
    client: createTestClient(pool),
    getAuthHeaders: createGetAuthHeaders(auth, magicLinksStore),
    getMagicLinks: () => magicLinksStore,
    teardown: async () => {
      await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      await pool.end();
    },
  };
}
```

The `createTestClient` helper changes from SQLite `db.prepare()` to
parameterized queries via the pool:

```js
function createTestClient(pool) {
  return {
    admin: {
      setRole: async ({ userId, role }) => {
        await pool.query(
          'UPDATE "user" SET role = $1 WHERE id = $2',
          [role, userId]
        );
      },
    },
  };
}
```

### Configuration (`config.js`)

Default `DATABASE_URL` changes to point at the local container:

```js
database_url: process.env.DATABASE_URL || "postgres://auth:auth@localhost:5433/test"
```

### Auth module (`src/auth.js`)

Remove the SQLite branch entirely. Always use `pg.Pool`:

```js
import { Pool } from "pg";
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
  // ... rest unchanged ...
});
```

Also remove the `import Database from "better-sqlite3";` line at the top.

### Package scripts (`package.json`)

```json
{
  "scripts": {
    "dev": "scripts/container.sh ensure && node --watch src/index.js",
    "db:generate": "npx @better-auth/cli generate --yes",
    "db:migrate": "npx @better-auth/cli migrate --yes",
    "test": "tap",
    "test:watch": "tap --watch",
    "test:coverage": "tap --coverage-report=html",
    "test:pg:start": "scripts/container.sh start",
    "test:pg:stop": "scripts/container.sh stop",
    "test:pg:status": "scripts/container.sh status"
  }
}
```

Remove `better-sqlite3` from `dependencies`.

### Test file changes

Every test file that calls `getTestInstance()` must pass the tap context `t`:

```js
// Before
const testInstance = await getTestInstance();

// After
const testInstance = await getTestInstance(t);
```

Affected files:

- `test/features/admin.test.js` — pass `t` to `getTestInstance(t)` (3 calls)
- `test/features/authentication.test.js` — pass `t` to `getTestInstance(t)` (1 call)
- `test/features/health.test.js` — pass `t`, and update fake DB objects from SQLite-style to Postgres-style (9 calls)
- `test/features/home.test.js` — pass `t` to `getTestInstance(t)` (2 calls)
- `test/features/magic-links.test.js` — pass `t` to `getTestInstance(t)` (4 calls)
- `test/features/profile.test.js` — pass `t` to `getTestInstance(t)` (3 calls)

#### Health test specifics

The health handler currently detects DB type at runtime (`isPostgres = typeof db?.query === 'function'`).
Postgres-only means we remove the SQLite branch. The handler simplifies to:

```js
// Before: dual-branch
if (isPostgres) {
  await db.query("SELECT 1");
} else {
  db.prepare("SELECT 1").get();
}

// After: Postgres-only
await db.query("SELECT 1");
```

Health `createTestInstance(a, testInstance.db)` → `createTestInstance(a, testInstance.pool)`.

Fake DB objects in health tests change:
- `{ prepare: () => { throw Error(...) } }` → `{ query: async () => { throw Error(...) } }`
- `{ prepare: () => { return { get: sinon.fake.throws() } } }` → `{ query: sinon.fake.rejects(...) }`

The `database.type` assertion `["sqlite", "postgresql"].includes(...)` simplifies to `"postgresql"`.

### `.taprc`

No changes needed.

### `.envrc-dist`

Add the new environment variables for documentation:

```bash
export DATABASE_URL=postgres://auth:auth@localhost:5433/test
export AUTH_TEST_PG_HOST=localhost
export AUTH_TEST_PG_PORT=5433
export AUTH_TEST_PG_USER=auth
export AUTH_TEST_PG_PASSWORD=auth
export AUTH_TEST_PG_DB=test
```

### What's removed

- `better-sqlite3` from `package.json` and `node_modules/`
- The SQLite branch in `src/auth.js`
- `./auth.db` file (delete)
- SQLite `import Database from "better-sqlite3"` from `src/auth.js`
- SQLite `db.prepare()` branch in `src/app/routes/health.js`
- SQLite-style fake DB objects in `test/features/health.test.js`
- Any other references to SQLite in the codebase

## Test performance impact

Postgres in an Apple Container on Apple Silicon adds ~50–100ms per test for
schema creation + migration. Existing suite of 38 tests should complete within
reasonable time (tap's 30s timeout remains sufficient).

Per-test schema isolation ensures tests can run in parallel (tap's default)
without interference.

### Outdated docs

`docs/development.md` references a Docker-based `make run-dev` — update to
reflect the new Apple Container-based local dev workflow.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Container not installed | Clear error message in prereqs checker |
| Port conflict with local Postgres | Configurable via `AUTH_TEST_PG_PORT` |
| Migration SQL uses Postgres-specific syntax | Already confirmed — Better Auth generates cross-dialect SQL |
| CI already uses Postgres | No CI changes needed |
| Developer forgets to start container | `ensure` command in `npm run dev` handles it |
| `testInstance.db` → `testInstance.pool` rename breaks tests | All test files passing `testInstance.db` to `createApp()` need to pass `testInstance.pool` instead |
