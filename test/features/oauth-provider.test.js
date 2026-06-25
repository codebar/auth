import { test } from "tap";
import { getTestInstance } from "../helpers/test-instance.js";
import { createApp } from "../../src/app/app.js";
import {
  authorizeParams,
  authorizeAndGetCode,
  tokenBody,
} from "../helpers/oauth-flow.js";
import { PLANNER_DEFAULT_PORT } from "../../src/config.js";

test("OAuth Provider plugin tests", async (t) => {
  t.test("planner client exists after test setup", async (t) => {
    const testInstance = await getTestInstance(t);
    const db = testInstance.db;

    const result = await db.query(
      'SELECT * FROM "oauthClient" WHERE "clientId" = $1',
      ["planner"],
    );
    const client = result.rows[0];

    t.ok(client, "planner client exists");
    t.equal(client.clientId, "planner", "clientId is planner");
    t.equal(client.public, true, "client is public");
    t.equal(client.requirePKCE, true, "PKCE is required");
    t.equal(
      client.tokenEndpointAuthMethod,
      "none",
      "no client secret required",
    );
    t.ok(
      client.redirectUris.includes(
        `http://localhost:${PLANNER_DEFAULT_PORT}/auth/codebar/callback`,
      ),
      "has planner redirect URI",
    );
  });

  t.test(
    "authorize endpoint redirects unauthenticated users to login",
    async (t) => {
      const testInstance = await getTestInstance();
      const app = createApp(testInstance.auth, testInstance.db);

      const params = authorizeParams({ state: "test-state" });

      const res = await app.request(
        `/api/auth/oauth2/authorize?${params.toString()}`,
      );

      t.equal(res.status, 302, "redirects");
      const location = res.headers.get("location");
      t.match(location, /\/login/, "redirects to login page");
      // The OAuth provider signs the authorize params and appends them to the login URL
      t.match(location, /response_type=code/, "preserves response_type");
      t.match(location, /client_id=planner/, "preserves client_id");
    },
  );

  t.test("authorize endpoint issues code when authenticated", async (t) => {
    const testInstance = await getTestInstance();
    const app = createApp(testInstance.auth, testInstance.db);
    const { getAuthHeaders } = testInstance;

    const params = authorizeParams({ state: "auth-state" });
    const { res, location, code } = await authorizeAndGetCode(
      app,
      await getAuthHeaders("oauthuser@example.com"),
      params,
    );

    t.equal(res.status, 302, "redirects to planner callback");
    t.ok(location, "has redirect location");
    t.match(
      location,
      new RegExp(
        `http://localhost:${PLANNER_DEFAULT_PORT}/auth/codebar/callback`,
      ),
      "redirects to planner callback",
    );
    t.ok(code, "includes authorization code");
    t.match(location, /state=auth-state/, "preserves state");
  });

  t.test(
    "token endpoint exchanges code for access token with PKCE",
    async (t) => {
      const testInstance = await getTestInstance();
      const app = createApp(testInstance.auth, testInstance.db);
      const { getAuthHeaders } = testInstance;

      const params = authorizeParams({ state: "token-state" });
      const { code } = await authorizeAndGetCode(
        app,
        await getAuthHeaders("tokenuser@example.com"),
        params,
      );

      const tokenRes = await app.request("/api/auth/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenBody(code),
      });

      t.equal(tokenRes.status, 200, "token endpoint returns 200");
      const body = await tokenRes.json();
      t.ok(body.access_token, "response contains access_token");
      t.equal(body.token_type, "Bearer", "token_type is Bearer");
      t.ok(body.expires_in, "response contains expires_in");
    },
  );

  t.test("token endpoint rejects code without code_verifier", async (t) => {
    const testInstance = await getTestInstance();
    const app = createApp(testInstance.auth, testInstance.db);
    const { getAuthHeaders } = testInstance;

    const params = authorizeParams({ state: "nopkce-state" });
    const { code } = await authorizeAndGetCode(
      app,
      await getAuthHeaders("nopkce@example.com"),
      params,
    );

    const tokenRes = await app.request("/api/auth/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody(code, { code_verifier: undefined }),
    });

    t.equal(tokenRes.status, 400, "token endpoint returns 400 without PKCE");
    const body = await tokenRes.json();
    t.ok(body.error, "response contains error");
  });

  t.test("token endpoint rejects invalid code", async (t) => {
    const testInstance = await getTestInstance();
    const app = createApp(testInstance.auth, testInstance.db);

    const tokenRes = await app.request("/api/auth/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody("invalid-code-123"),
    });

    t.ok(
      tokenRes.status >= 400,
      "token endpoint returns error status for invalid code",
    );
    const body = await tokenRes.json();
    t.ok(body.error || body.code, "response contains error");
  });

  t.test("token endpoint rejects mismatched redirect_uri", async (t) => {
    const testInstance = await getTestInstance();
    const app = createApp(testInstance.auth, testInstance.db);
    const { getAuthHeaders } = testInstance;

    const params = authorizeParams({ state: "badredirect-state" });
    const { code } = await authorizeAndGetCode(
      app,
      await getAuthHeaders("badredirect@example.com"),
      params,
    );

    const tokenRes = await app.request("/api/auth/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody(code, {
        redirect_uri: "http://127.0.0.1:9999/callback",
      }),
    });

    t.equal(
      tokenRes.status,
      400,
      "token endpoint returns 400 for mismatched redirect_uri",
    );
    const body = await tokenRes.json();
    t.ok(body.error || body.code, "response contains error");
  });
});
