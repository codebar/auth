import { test } from "tap";
import { randomUUID } from "node:crypto";
import { getTestInstance } from "../helpers/test-instance.js";
import { createApp } from "../../src/app/app.js";
import {
  authorizeParams,
  authorizeAndGetCode,
  tokenBody,
} from "../helpers/oauth-flow.js";

function decodeJwtPayload(idToken) {
  return JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString());
}

test("id_token includes github_id for users with a linked GitHub account", async (t) => {
  const testInstance = await getTestInstance(t);
  const app = createApp(testInstance.auth, testInstance.db);
  const { getAuthHeaders } = testInstance;
  const email = "github-linked@example.com";

  const authHeaders = await getAuthHeaders(email);

  const userResult = await testInstance.db.query(
    'SELECT id FROM "user" WHERE email = $1',
    [email],
  );
  const userId = userResult.rows[0]?.id;
  t.ok(userId, "user record found");

  await testInstance.db.query(
    'INSERT INTO "account" ("id", "accountId", "providerId", "userId", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, NOW(), NOW())',
    [randomUUID(), "987654321", "github", userId],
  );

  const params = authorizeParams({ state: "jwt-github-state" });
  const { code } = await authorizeAndGetCode(app, authHeaders, params);

  const tokenRes = await app.request("/api/auth/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenBody(code),
  });

  t.equal(tokenRes.status, 200, "token endpoint returns 200");
  const body = await tokenRes.json();
  t.ok(body.id_token, "response contains id_token");

  const payload = decodeJwtPayload(body.id_token);
  t.equal(payload.github_id, "987654321", "payload includes linked github_id");
});

test("id_token omits github_id for users without a linked GitHub account", async (t) => {
  const testInstance = await getTestInstance(t);
  const app = createApp(testInstance.auth, testInstance.db);
  const { getAuthHeaders } = testInstance;
  const email = "magic-link-only@example.com";

  const authHeaders = await getAuthHeaders(email);

  const params = authorizeParams({ state: "jwt-no-github-state" });
  const { code } = await authorizeAndGetCode(app, authHeaders, params);

  const tokenRes = await app.request("/api/auth/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenBody(code),
  });

  t.equal(tokenRes.status, 200, "token endpoint returns 200");
  const body = await tokenRes.json();
  t.ok(body.id_token, "response contains id_token");

  const payload = decodeJwtPayload(body.id_token);
  t.notOk(
    Object.prototype.hasOwnProperty.call(payload, "github_id"),
    "payload does not include github_id",
  );
});
