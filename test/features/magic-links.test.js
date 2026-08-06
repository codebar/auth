import { test } from "tap";
import { getTestInstance } from "../helpers/test-instance.js";
import { createApp } from "../../src/app/app.js";

/**
 * Make a magic link request to the app
 * @param {Object} app - Hono app instance
 * @param {string} email - Email address for the magic link
 * @returns {Promise<Response>} The response from the request
 */
async function makeMagicLinkRequest(app, email) {
  const formData = new URLSearchParams();
  formData.append("email", email);

  return app.request("/login/magic-link", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });
}

test("magic links feature tests", async (t) => {
  t.test("user can request magic link", async (t) => {
    const testInstance = await getTestInstance(t);
    const app = createApp(testInstance.auth);

    const res = await makeMagicLinkRequest(app, "magic@example.com");

    t.equal(res.status, 302, "redirects after requesting magic link");
    t.match(
      res.headers.get("location"),
      /success/,
      "redirects with success message",
    );
  });

  t.test("magic link request for nonexistent user succeeds", async (t) => {
    const testInstance = await getTestInstance(t);
    const app = createApp(testInstance.auth);

    const res = await makeMagicLinkRequest(app, "nonexistent@example.com");

    // Should still show success to prevent email enumeration
    t.equal(res.status, 302, "redirects after requesting magic link");
    t.match(
      res.headers.get("location"),
      /success/,
      "shows success message even for nonexistent user",
    );
  });

  t.test("magic link GET page renders form", async (t) => {
    const testInstance = await getTestInstance(t);
    const app = createApp(testInstance.auth);

    const res = await app.request("/login/magic-link");

    t.equal(res.status, 200, "magic link page loads");
    const html = await res.text();
    t.match(html, /Sign in with e-mail/, "displays e-mail sign-in page");
    t.match(html, /email/i, "has email input");
    t.match(html, /Sign in with e-mail/, "shows e-mail sign-in button");
  });

  t.test("login page shows friendly message for INVALID_TOKEN", async (t) => {
    const testInstance = await getTestInstance(t);
    const app = createApp(testInstance.auth);

    const res = await app.request("/login?error=INVALID_TOKEN");

    t.equal(res.status, 200, "login page loads");
    const html = await res.text();
    t.match(
      html,
      /expired or already been used/,
      "shows friendly message instead of raw code",
    );
    t.ok(!html.includes("INVALID_TOKEN"), "does not show raw error code");
  });
});
