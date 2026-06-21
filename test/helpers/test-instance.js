import pg from "pg";
import { betterAuth } from "better-auth";
import { admin, magicLink } from "better-auth/plugins";
import { getMigrations } from "better-auth/db/migration";

/**
 * Parse DATABASE_URL into a pool config, falling back to defaults on failure
 */
function getPoolConfig() {
  const {
    AUTH_TEST_PG_HOST: host = "localhost",
    AUTH_TEST_PG_PORT: port = "5433",
    AUTH_TEST_PG_DB: database = "test",
    AUTH_TEST_PG_USER: user = "auth",
    AUTH_TEST_PG_PASSWORD: password = "auth",
  } = process.env;

  const cfg = { host, port: parseInt(port), database, user, password, max: 1 };

  if (!process.env.DATABASE_URL) return cfg;

  try {
    const p = new URL(process.env.DATABASE_URL);
    cfg.host = p.hostname || cfg.host;
    cfg.port = parseInt(p.port) || cfg.port;
    cfg.database = p.pathname.replace(/^\//, "") || cfg.database;
    cfg.user = decodeURIComponent(p.username) || cfg.user;
    cfg.password = decodeURIComponent(p.password) || cfg.password;
  } catch {
    /* keep defaults */
  }

  return cfg;
}

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
  const poolConfig = getPoolConfig();
  const pool = new pg.Pool(poolConfig);

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
        await pool.query('UPDATE "user" SET role = $1 WHERE id = $2', [
          role,
          userId,
        ]);
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
