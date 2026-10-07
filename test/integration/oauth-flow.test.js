import { test } from "tap";
import { getTestInstance } from "../helpers/test-instance.js";
import { createApp } from "../../src/app/app.js";

test("end-to-end OAuth 2.1 flow", async (t) => {
  const testInstance = await getTestInstance();
  const app = createApp(testInstance.auth, testInstance.db);
  const { getAuthHeaders, pool } = testInstance;

  // Step 1: Authenticate a user via magic link
  const email = "oauth-integration@example.com";
  const { cookie: sessionCookie } = await getAuthHeaders(email);
  t.ok(sessionCookie, "session token extracted");

  // Give the user a display name so the `name` claim has a real value to assert
  await pool.query('UPDATE "user" SET name = $1 WHERE email = $2', [
    "Ada Lovelace",
    email,
  ]);

  // Step 2: Call authorize endpoint with PKCE
  const codeVerifier = "test-verifier-123456789";
  const codeChallenge = "MJk6-W6P2z_PgOvWcEvbyqeIyc-GthZov8-QX37r0Vo";

  const authorizeParams = new URLSearchParams({
    client_id: "planner",
    redirect_uri: "http://localhost:3000/auth/codebar/callback",
    response_type: "code",
    state: "integration-state",
    scope: "openid profile email",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  const authorizeRes = await app.request(
    `/api/auth/oauth2/authorize?${authorizeParams.toString()}`,
    { headers: { cookie: sessionCookie } },
  );

  t.equal(authorizeRes.status, 302, "authorize returns redirect");

  const location = authorizeRes.headers.get("location");
  t.ok(location, "has redirect location");
  t.match(
    location,
    /http:\/\/localhost:3000\/auth\/codebar\/callback/,
    "redirects to planner callback",
  );
  t.match(location, /code=/, "includes authorization code");
  t.match(location, /state=integration-state/, "preserves state");

  const codeMatch = location.match(/code=([^&]+)/);
  t.ok(codeMatch, "authorization code found in redirect");
  const code = decodeURIComponent(codeMatch[1]);

  // Step 3: Exchange code for tokens
  const tokenRes = await app.request("/api/auth/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: "planner",
      redirect_uri: "http://localhost:3000/auth/codebar/callback",
      code_verifier: codeVerifier,
    }).toString(),
  });

  t.equal(tokenRes.status, 200, "token endpoint returns 200");

  const tokens = await tokenRes.json();
  t.ok(tokens.access_token, "response contains access_token");
  t.equal(tokens.token_type, "Bearer", "token_type is Bearer");
  t.ok(tokens.expires_in, "response contains expires_in");
  t.ok(tokens.id_token, "response contains id_token");

  // Step 4: Verify id_token via JWKS
  const jwksRes = await app.request("/api/auth/jwks");
  t.equal(jwksRes.status, 200, "JWKS endpoint returns 200");

  const jwks = await jwksRes.json();
  t.ok(jwks.keys, "JWKS contains keys array");
  t.ok(jwks.keys.length > 0, "JWKS has at least one key");

  // Decode header to find kid
  const idToken = tokens.id_token;
  const headerJson = Buffer.from(idToken.split(".")[0], "base64url").toString();
  const header = JSON.parse(headerJson);
  t.ok(header.kid, "id_token has kid in header");

  const keyData = jwks.keys.find((k) => k.kid === header.kid);
  t.ok(keyData, "JWKS contains matching key");

  // Verify the JWT structure (signature verification would need jose or similar)
  const payloadJson = Buffer.from(
    idToken.split(".")[1],
    "base64url",
  ).toString();
  const payload = JSON.parse(payloadJson);

  t.ok(payload.sub, "payload has sub claim");
  t.ok(payload.iss, "payload has issuer");
  t.ok(payload.aud, "payload has audience");
  t.ok(payload.iat, "payload has issued-at");
  t.ok(payload.exp, "payload has expiration");

  // Step 5: Fetch the OIDC UserInfo response. Since better-auth 1.7 the id_token
  // is sparse and the scope-gated claims (email, name) live here, which is where
  // the planner resolves member identity from.
  const userinfoRes = await app.request("/api/auth/oauth2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  t.equal(userinfoRes.status, 200, "userinfo endpoint returns 200");

  const userinfo = await userinfoRes.json();
  t.equal(userinfo.sub, payload.sub, "userinfo sub matches the id_token sub");
  t.equal(userinfo.email, email, "userinfo carries the email claim");
  t.equal(userinfo.email_verified, true, "userinfo carries email_verified");
  t.equal(userinfo.name, "Ada Lovelace", "userinfo carries the name claim");

  // Introspection is not covered here because it requires client authentication.
});
