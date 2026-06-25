import { test } from "tap";
import { getCallbackURL } from "../../src/app/utils/callback-url.js";
import appConfig, { PLANNER_DEFAULT_PORT } from "../../src/config.js";

const BASE = appConfig.base_url;
const REDIRECT = appConfig.allowed_redirects[0];
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

test("returns default authorize URL when no OAuth params", async (t) => {
  const url = `${BASE}/login`;

  const result = getCallbackURL(mockCtx(url));

  const expected =
    `${BASE}/api/auth/oauth2/authorize?` +
    `client_id=planner&redirect_uri=${encodeURIComponent(REDIRECT)}` +
    `&response_type=code&scope=openid+profile+email`;
  t.equal(result, expected);
});

test("returns default authorize URL with empty search", async (t) => {
  const url = `${BASE}/login?`;

  const result = getCallbackURL(mockCtx(url));

  const expected =
    `${BASE}/api/auth/oauth2/authorize?` +
    `client_id=planner&redirect_uri=${encodeURIComponent(REDIRECT)}` +
    `&response_type=code&scope=openid+profile+email`;
  t.equal(result, expected);
});

test("uses base_url from config", async (t) => {
  const original = appConfig.base_url;
  appConfig.base_url = "https://auth.codebar.io";
  t.after(() => {
    appConfig.base_url = original;
  });

  const result = getCallbackURL(mockCtx("https://auth.codebar.io/login"));

  t.ok(result.startsWith("https://auth.codebar.io/"));
  t.ok(result.includes("/api/auth/oauth2/authorize"));
});

test("uses allowed_redirects[0] for default redirect_uri", async (t) => {
  const original = appConfig.allowed_redirects;
  appConfig.allowed_redirects = ["https://planner.test/callback"];
  t.after(() => {
    appConfig.allowed_redirects = original;
  });

  const result = getCallbackURL(mockCtx(`${BASE}/login`));

  t.ok(result.includes(encodeURIComponent("https://planner.test/callback")));
});
