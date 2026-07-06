import { test } from "tap";
import { getCallbackURL } from "../../src/app/utils/callback-url.js";
import appConfig, {
  AUTH_DEFAULT_PORT,
  PLANNER_DEFAULT_PORT,
} from "../../src/config.js";

const BASE = `http://localhost:${AUTH_DEFAULT_PORT}`;
const REDIRECT_URI = `http://localhost:${PLANNER_DEFAULT_PORT}/auth/codebar/callback`;

function mockCtx(url) {
  return { req: { url } };
}

test("preserves OAuth params from request", async (t) => {
  const url =
    `${BASE}/login?response_type=code&client_id=planner` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&state=abc123&scope=openid+profile+email` +
    `&code_challenge=xyz&code_challenge_method=S256`;

  const result = getCallbackURL(mockCtx(url));

  t.equal(
    result,
    `${BASE}/api/auth/oauth2/authorize?response_type=code&client_id=planner&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=abc123&scope=openid+profile+email&code_challenge=xyz&code_challenge_method=S256`,
  );
});

test("preserves only present OAuth params", async (t) => {
  const url = `${BASE}/login?response_type=code&client_id=planner&state=abc`;

  const result = getCallbackURL(mockCtx(url));

  t.equal(
    result,
    `${BASE}/api/auth/oauth2/authorize?response_type=code&client_id=planner&state=abc`,
  );
});

test("returns /profile when no OAuth params", async (t) => {
  const url = `${BASE}/login`;

  const result = getCallbackURL(mockCtx(url));

  t.equal(result, `${BASE}/profile`);
});

test("returns /profile with empty search", async (t) => {
  const url = `${BASE}/login?`;

  const result = getCallbackURL(mockCtx(url));

  t.equal(result, `${BASE}/profile`);
});

test("uses base_url for /profile redirect", async (t) => {
  const result = getCallbackURL(mockCtx(`${BASE}/login`));

  t.equal(result, `${appConfig.base_url}/profile`);
});
