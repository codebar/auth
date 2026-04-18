import { betterAuth } from "better-auth";
import { admin, magicLink } from "better-auth/plugins";
import { getMigrations } from "better-auth/db/migration";
import Database from "better-sqlite3";

/**
 * Creates a Better Auth test instance with in-memory database
 * Adapted from Better Auth's test utilities for use with tap
 *
 * EXPECTED ERROR MESSAGES DURING TESTS:
 *
 * You will see these errors in test output - they are EXPECTED and do NOT indicate test failures:
 *
 * 1. "INTERNAL_SERVER_ERROR SqliteError: no such table: session"
 *    - Occurs when tests provide invalid session tokens/cookies
 *    - Better Auth attempts to query the session table before catching the error
 *    - Tests verify the app correctly handles this (redirects to login)
 *
 * These errors are logged by Better Auth's internal error handling and cannot be
 * suppressed without hiding legitimate errors. They indicate the application is
 * correctly catching and handling error conditions.
 *
 * Tests pass if assertions succeed - ignore these stderr messages.
 *
 * @returns {Promise<{auth: Object, client: Object, db: Database}>}
 */
export async function getTestInstance() {
  // Create in-memory database
  const db = new Database(":memory:");

  // Configure Better Auth for testing
  const auth = betterAuth({
    database: db,
    baseURL: "http://localhost:3000",
    logger: {
      disabled: true, // Suppress logs during tests
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
          // Store magic link for testing
          // Tests can access this via the returned magicLinks array
          if (!auth._testMagicLinks) {
            auth._testMagicLinks = [];
          }
          auth._testMagicLinks.push({ email, token, url });
          return Promise.resolve();
        },
      }),
      admin(),
    ],
  });

  // Run migrations to create database tables
  const migrations = await getMigrations(auth.options);
  await migrations.runMigrations();

  // Create client helper for common operations
  const client = {
    // Admin methods (based on spike findings)
    admin: {
      setRole: async ({ userId, role }) => {
        // Based on spike findings: direct database UPDATE is required
        // The admin.setRole endpoint requires authentication, so direct DB access is simpler for testing
        const db = auth.options?.database;
        if (!db) throw new Error("Cannot access database for role update");
        db.prepare("UPDATE user SET role = ? WHERE id = ?").run(role, userId);
      },
    },
  };

  // Helper to get session headers for authenticated requests via magic link
  const getAuthHeaders = async (email) => {
    // Send magic link
    await auth.api.signInMagicLink({
      body: {
        email,
        callbackURL: "http://localhost:3000/profile",
      },
      headers: new Headers(),
    });

    // Get the magic link from the test array
    const magicLinks = auth._testMagicLinks || [];
    const magicLink = magicLinks.find((link) => link.email === email);

    if (!magicLink) {
      throw new Error(`No magic link found for ${email}`);
    }

    // Verify the magic link to get a session
    // magicLinkVerify returns a 302 redirect with session cookie headers
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
      // Extract the headers from the error if it's a 302 redirect
      if (error.statusCode === 302) {
        // error.headers is a Map-like object from Headers
        let setCookie;
        if (error.headers && typeof error.headers.get === "function") {
          setCookie = error.headers.get("set-cookie");
        } else if (error.headers && Array.isArray(error.headers)) {
          // If it's an array of tuples
          const setCookieHeader = error.headers.find(
            (h) => h[0].toLowerCase() === "set-cookie",
          );
          setCookie = setCookieHeader ? setCookieHeader[1] : null;
        }

        if (setCookie) {
          return parseSessionCookie(setCookie);
        }
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

  return {
    auth,
    client,
    db,
    getAuthHeaders,
    getMagicLinks: () => auth._testMagicLinks || [],
  };
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
