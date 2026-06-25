import { PLANNER_DEFAULT_PORT } from "../../src/config.js";

const REDIRECT_URI = `http://localhost:${PLANNER_DEFAULT_PORT}/auth/codebar/callback`;
const CODE_CHALLENGE = "MJk6-W6P2z_PgOvWcEvbyqeIyc-GthZov8-QX37r0Vo";
const CODE_VERIFIER = "test-verifier-123456789";

export function authorizeParams(overrides = {}) {
  return new URLSearchParams({
    client_id: "planner",
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "openid profile",
    code_challenge: CODE_CHALLENGE,
    code_challenge_method: "S256",
    ...overrides,
  });
}

export async function authorizeAndGetCode(app, headers, params) {
  const res = await app.request(
    `/api/auth/oauth2/authorize?${params.toString()}`,
    { headers },
  );
  const location = res.headers.get("location");
  const match = location?.match(/code=([^&]+)/);
  if (!match) throw new Error("No code in authorize response");
  return { res, location, code: decodeURIComponent(match[1]) };
}

export function tokenBody(code, overrides = {}) {
  const body = {
    grant_type: "authorization_code",
    code,
    client_id: "planner",
    redirect_uri: REDIRECT_URI,
    code_verifier: CODE_VERIFIER,
    ...overrides,
  };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined) params.set(key, value);
  }
  return params.toString();
}
