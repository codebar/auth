import { test, expect } from "@playwright/test";
import { AUTH_DEFAULT_PORT, PLANNER_DEFAULT_PORT } from "../src/config.js";

const authBase = `http://localhost:${AUTH_DEFAULT_PORT}`;

test("OAuth 2.1 magic link flow", async ({ page, request }) => {
  const email = `e2e-${Date.now()}@example.com`;

  // Clear any stale magic links
  await request.delete(`${authBase}/api/test/magic-links`);

  // Start OAuth flow: unauthenticated user hits authorize endpoint with PKCE
  const codeChallenge = "MJk6-W6P2z_PgOvWcEvbyqeIyc-GthZov8-QX37r0Vo";
  const authorizeParams = new URLSearchParams({
    client_id: "planner",
    redirect_uri: `http://localhost:${PLANNER_DEFAULT_PORT}/auth/codebar/callback`,
    response_type: "code",
    state: "e2e-state-123",
    scope: "openid profile email",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  await page.goto(
    `${authBase}/api/auth/oauth2/authorize?${authorizeParams.toString()}`,
  );

  // OAuth provider redirects unauthenticated users to the login page
  await expect(page).toHaveURL(/\/login/);

  // Click through to the magic link form
  await page.getByRole("button", { name: /Sign in with e-mail/i }).click();
  await expect(page).toHaveURL(/\/login\/magic-link/);

  // Submit email
  await page.fill('input[name="email"]', email);
  await page.click('button[type="submit"]');

  // Success page is shown
  await expect(page).toHaveURL(/\/login\/magic-link\?success=/);
  await expect(page.locator("body")).toContainText("Magic link sent");

  // Fetch the magic link from the auth dev endpoint
  const linksRes = await request.get(`${authBase}/api/test/magic-links`);
  const links = await linksRes.json();
  const link = links.find((l) => l.email === email);
  expect(link).toBeDefined();
  expect(link.url).toMatch(/magic-link\/verify/);

  // Call the magic link verify endpoint via API to establish a session.
  // APIRequestContext automatically stores and sends cookies across requests.
  const verifyRes = await request.get(link.url, { maxRedirects: 0 });
  expect(verifyRes.status()).toBe(302);
  const verifyLocation = verifyRes.headers()["location"];
  expect(verifyLocation).toContain("/api/auth/oauth2/authorize");

  // Call the authorize endpoint with the session cookie (don't follow redirects)
  const authRes = await request.get(
    `${authBase}/api/auth/oauth2/authorize?${authorizeParams.toString()}`,
    { maxRedirects: 0 },
  );

  // Should get a 302 redirect to the planner callback with the code
  expect(authRes.status()).toBe(302);
  const location = authRes.headers()["location"];
  expect(location).toBeTruthy();
  expect(location).toContain("code=");
  expect(location).toContain("state=e2e-state-123");
});
