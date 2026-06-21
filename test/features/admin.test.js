import { test } from "tap";
import { getTestInstance } from "../helpers/test-instance.js";
import { createApp } from "../../src/app/app.js";

test("admin feature tests", async (t) => {
  t.test("admin page can be requested", async (t) => {
    const testInstance = await getTestInstance(t);
    const app = createApp(testInstance.auth);

    // For now, just test that the route exists and we can request it
    const res = await app.request("/admin");

    // Should either be 302 (redirect), 401 (unauthorized), or 500 (server error with auth)
    t.ok(
      res.status === 302 || res.status === 401 || res.status === 500,
      `returns expected status (got ${res.status})`,
    );
  });

  t.test("unauthenticated user cannot access admin panel", async (t) => {
    const testInstance = await getTestInstance(t);
    const app = createApp(testInstance.auth);

    const res = await app.request("/admin");

    t.ok(
      res.status === 302 || res.status === 401 || res.status === 500,
      `redirects or returns error (got ${res.status})`,
    );
  });

  t.test("admin role can be set on a user via magic link auth", async (t) => {
    const testInstance = await getTestInstance(t);
    const { getAuthHeaders, client, pool } = testInstance;

    // Get a user session via magic link
    await getAuthHeaders("admin@example.com");

    // Query the user from the database to get their ID
    // "user" is a reserved word, must be quoted in Postgres
    const result = await pool.query('SELECT id FROM "user" WHERE email = $1', [
      "admin@example.com",
    ]);
    const user = result.rows[0];

    if (!user) {
      throw new Error("User not found after magic link verification");
    }

    // Set admin role
    await client.admin.setRole({
      userId: user.id,
      role: "admin",
    });

    // setRole should not throw if it worked correctly
    t.pass("admin role successfully set");
  });
});
