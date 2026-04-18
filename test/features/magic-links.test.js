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
    const testInstance = await getTestInstance();
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
    const testInstance = await getTestInstance();
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
    const testInstance = await getTestInstance();
    const app = createApp(testInstance.auth);

    const res = await app.request("/login/magic-link");

    t.equal(res.status, 200, "magic link page loads");
    const html = await res.text();
    t.match(html, /Magic Link/i, "displays magic link heading");
    t.match(html, /email/i, "has email input");
  });

  t.test("magic link URL is captured in test", async (t) => {
    const testInstance = await getTestInstance();
    const app = createApp(testInstance.auth);
    const { getMagicLinks } = testInstance;

    const formData = new URLSearchParams();
    formData.append("email", "magic-url@example.com");

    await app.request("/login/magic-link", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const magicLinks = getMagicLinks();
    t.ok(magicLinks.length > 0, "magic link was generated");
    t.equal(
      magicLinks[magicLinks.length - 1].email,
      "magic-url@example.com",
      "magic link for correct email",
    );
    t.ok(magicLinks[magicLinks.length - 1].url, "magic link has URL");
    t.ok(magicLinks[magicLinks.length - 1].token, "magic link has token");
  });
});
