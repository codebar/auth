# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**When editing this file:** Use the `elements-of-style:writing-clearly-and-concisely` skill to ensure clear, concise prose.

**Code formatting:** All code must follow the Prettier rules defined in this repository. Before committing any code changes:

- Run `npm run prettier:check` to verify formatting
- Run `npm run prettier:write` to auto-format files

**Optional commit hooks:**

To automatically run Prettier and ESLint before each commit, enable the hooks:

```sh
npm run hooks:install
```

This installs Git hooks that run `lint-staged` on commit. To skip the hooks for a single commit, use `git commit --no-verify`.

## Project Overview

Authentication service for Codebar using [Better Auth](https://www.better-auth.com/). A Node.js application built with Hono and PostgreSQL. It signs users in with GitHub OAuth or magic links, and acts as an OAuth 2.1 provider for the planner.

## Essential Setup

1. Create a GitHub OAuth2 application at https://github.com/settings/developers
2. Copy `.envrc-dist` to `.envrc` and add your GitHub credentials:
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`
3. For new setup:
   ```sh
   npm ci
   npm run db:migrate
   npm run dev
   ```
4. To update existing setup:
   ```sh
   npm ci
   npm run db:migrate
   npm run dev
   ```

## Deployment

See [docs/heroku-setup.md](docs/heroku-setup.md) for initial Heroku setup and [docs/deployment.md](docs/deployment.md) for deployment instructions.

## Development Commands

**Running the app:**

- `npm run dev` - Development mode with hot reload (watches for changes)
- `npm start` - Production mode

**Database:**

- `npm run db:migrate` - Run database migrations and seed the planner OAuth client
- `scripts/container.sh destroy` - Delete the local Postgres container and its data to start fresh

**Local development and tests use a Postgres container** (`scripts/container.sh`, port 5433, started by `npm run dev` and `pretest`).
**CI and production use PostgreSQL** (configured via `DATABASE_URL` environment variable).

**Code quality:**

- `npm run lint` - Run ESLint
- `npm run prettier:check` - Check code formatting
- `npm run prettier:write` - Auto-format code

The application runs at http://localhost:3001. Set `PORT` to override.

## Testing

**Running tests:**

- `npm test` - Run all tests with coverage
- `npm run test:coverage` - Run tests and view coverage report

`pretest` starts the PostgreSQL container with `apple/container`, which is macOS-only. On Linux, start PostgreSQL yourself and run `npx tap` directly.

**Expected Error Messages:**

During test execution, you will see ERROR and WARN messages in stderr. These are EXPECTED and do NOT indicate test failures:

- `WARN [Better Auth]: Social provider github is missing clientId or clientSecret` - Test instances use placeholder credentials
- `ERROR [Better Auth]: Database schema mismatch`, followed by a list of missing tables - Better Auth checks the schema when the instance is created, before the test's migrations run

These are logged by Better Auth's internal error handling. Tests pass if assertions succeed.

**Test Structure:**

- `test/` - Test files organized by kind
- `test/helpers/` - Shared test utilities and fixtures
  - `test-instance.js` - Creates an isolated auth instance per test, in its own PostgreSQL schema
  - `oauth-flow.js` - Authorize and token request helpers for the OAuth provider tests
  - `container.js` - Starts the local PostgreSQL container before the suite runs

**Test Files:**

- `test/features/` - End-to-end feature tests (admin, authentication, health, home, magic links, OAuth provider, profile)
- `test/integration/` - Multi-step flows (OAuth round trip, JWT payload, cookie attributes)
- `test/unit/` - Single-module tests (callback URLs, redirects, ID token claims, magic link email)

**Writing Tests:**

1. Use `test()` and `t.test()` from the `tap` module
2. Assert with tap's `t.equal`, `t.same`, `t.ok` and `t.match`
3. Use `getTestInstance(t)` from `test/helpers/test-instance.js` to create an isolated auth instance; passing `t` registers teardown that drops the schema
4. Each test file must be independent and runnable in any order

**Coverage:**

`.taprc` sets `allow-incomplete-coverage: true`, so the suite enforces no coverage threshold. `npm run test:coverage` writes an HTML report.

## Git Workflow

**IMPORTANT: Commit all work to feature branches, never to `main`.**

**Branch workflow:**

1. Create a feature branch from `main`:

   ```sh
   git checkout main
   git pull
   git checkout -b feature/your-feature-name
   ```

2. Commit changes:

   ```sh
   git add <files>
   git commit -m "feat: add user profile page"
   ```

3. Push and create pull request:

   ```sh
   git push -u origin feature/your-feature-name
   gh pr create --title "feat: add user profile page" --body "Description of changes"
   ```

4. Merge through pull requests only.

**Conventional commits:**
Follow this format:

```
<type>(<optional scope>): <description>

[optional body]

[optional footer]
```

Types:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `chore:` - Maintenance (dependencies, config)
- `refactor:` - Code restructuring
- `test:` - Tests
- `style:` - Formatting

Examples:

- `feat: add GitHub OAuth support`
- `fix: resolve session expiration bug`
- `chore(deps): bump hono from 4.10.7 to 4.11.7`
- `docs: update setup instructions`

**Writing guidance:**
Use `elements-of-style:writing-clearly-and-concisely` skill when writing:

- Commit messages (especially bodies and footers)
- Pull request titles and descriptions
- Documentation files (README, AGENTS.md, etc.)

## Architecture

### Application Structure

```
src/
├── index.js          # Entry point, server setup with graceful shutdown
├── auth.js           # Better Auth configuration and PostgreSQL pool
├── config.js         # Application configuration
├── app/
│   ├── app.js        # Main Hono app setup, middleware, route registration
│   ├── routes/       # Route handlers (auth, home, profile, admin, whoami, health)
│   ├── components/   # HTML rendering functions
│   ├── handlers/     # Business logic handlers (e.g., logout)
│   ├── utils/        # Utilities (redirects, magic link email)
│   ├── db/           # Planner OAuth client seeding
│   └── demo/         # Demo application showing auth integration
├── auth/             # GitHub provider and ID token claim helpers
└── dev/              # Dev-only magic link capture
static/
└── auth-client.js    # Browser-side auth client
```

### Key Architecture Patterns

**Better Auth Integration:**

- `src/auth.js` exports a configured Better Auth instance backed by a PostgreSQL pool
- API routes mounted at `/api/auth/*` (app.js:69-71), with the discovery documents at `/.well-known/oauth-authorization-server` and `/.well-known/openid-configuration` (app.js:73-78)
- Session middleware runs on all routes, populating `c.get('user')` and `c.get('session')` (app.js:84-100)
- Plugins: JWT, OAuth provider, magic links, admin

**Hono Framework:**

- All routes use Hono's context (`c`) for request/response
- Session data available via `c.get('user')` and `c.get('session')`
- Routes registered in app.js using `app.route()`
- Pino logger middleware with sensitive data redaction

**Authentication Flows:**
The app supports three ways to authenticate:

- GitHub OAuth (auth.js:36-49), with `getUserInfo` resolving the primary verified email
- Magic links (auth.js:91-138), logged to the console outside production and sent through SendGrid in production
- OAuth 2.1 provider for the planner (auth.js:80-90), issuing ID tokens with a `github_id` claim

**Database:**

- PostgreSQL everywhere: local development, tests, CI and production
- Local development and tests use the container on port 5433 (`scripts/container.sh`)
- `DATABASE_URL` defaults to `postgres://auth:auth@localhost:5433/test`
- SSL is enabled for any non-local connection
- Better Auth manages the schema through its Kysely adapter

### Important Configuration

**Environment Variables:**

- `PORT` - Server port (default: 3001)
- `DATABASE_URL` - PostgreSQL connection (default: `postgres://auth:auth@localhost:5433/test`)
- `GITHUB_CLIENT_ID` - GitHub OAuth client ID (required)
- `GITHUB_CLIENT_SECRET` - GitHub OAuth secret (required)
- `CODEBAR_AUTH_URL` - Public base URL of this service (default: `http://localhost:3001`)
- `PLANNER_URL` - Planner base URL (default: `http://localhost:3000`)
- `PLANNER_REDIRECT_URIS` - Comma-separated callback URLs allowed for the planner client
- `SENDGRID_API_KEY` - SendGrid key used to send magic links in production
- `MAGIC_LINK_FROM_EMAIL` - Sender address (default: `auth-noreply@codebar.io`)
- `AUTH_TEST_PG_*` - Host, port, database, user and password for the test PostgreSQL instance

**Allowed Redirects:**

- `config.js` builds `allowed_redirects` from `PLANNER_REDIRECT_URIS`
- The default is `http://localhost:3000/auth/codebar/callback`
- Add an entry to allow redirects to another origin

**Session Configuration:**

- 7-day expiration and a 24-hour update interval (auth.js:61-64)

### Demo Application

A separate demo app is mounted at `/demo` to demonstrate cross-application authentication patterns. Access it at http://localhost:3001/demo after logging in.

### Admin UI

Basic admin interface at `/admin` for user management (list users, update roles). The admin plugin is configured in src/auth.js:139.

## Development Notes

**Magic Links:**
Outside production, magic link URLs are logged to the console and captured in `src/dev/magic-links.js`. The dev-only `/api/test/magic-links` route returns them, and only answers requests from loopback. In production they are sent through SendGrid.

**Graceful Shutdown:**
The server closes the database pool and the listener on SIGINT and SIGTERM (src/index.js:28-57).
