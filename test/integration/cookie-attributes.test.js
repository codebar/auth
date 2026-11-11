import { test } from "tap";
import { getTestInstance } from "../helpers/test-instance.js";
import { createApp } from "../../src/app/app.js";
import { authorizeParams } from "../helpers/oauth-flow.js";

const SESSION_COOKIE = "better-auth.session_token";

const LOGOUT_COOKIES = [
  "better-auth.dont_remember",
  "better-auth.session_data",
  "better-auth.session_token",
];

function readSetCookie(headers) {
  if (!headers) return [];
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  if (typeof headers.get === "function") {
    const value = headers.get("set-cookie");
    return value ? [value] : [];
  }
  if (Array.isArray(headers)) {
    const entry = headers.find(([name]) => name.toLowerCase() === "set-cookie");
    return entry ? [entry[1]] : [];
  }
  return [];
}

function cookieNamed(headers, name) {
  return readSetCookie(headers).find((cookie) => cookie.startsWith(`${name}=`));
}

function attributes(cookie) {
  return cookie
    .split(";")
    .slice(1)
    .map((part) => part.trim());
}

function attributeValue(cookie, name) {
  const part = attributes(cookie).find(
    (attribute) => attribute.split("=")[0].toLowerCase() === name.toLowerCase(),
  );
  return part?.split("=").slice(1).join("=");
}

function hasLifetime(cookie) {
  return Boolean(
    attributeValue(cookie, "Max-Age") || attributeValue(cookie, "Expires"),
  );
}

async function magicLinkHeaders(auth, getMagicLinks, email) {
  const callbackURL = "http://localhost:3000/profile";
  await auth.api.signInMagicLink({
    body: { email, callbackURL },
    headers: new Headers(),
  });
  const magicLink = getMagicLinks().find((link) => link.email === email);
  if (!magicLink) throw new Error(`No magic link found for ${email}`);

  try {
    const result = await auth.api.magicLinkVerify({
      query: { token: magicLink.token, callbackURL },
      headers: new Headers(),
      returnHeaders: true,
    });
    return result.headers;
  } catch (error) {
    if (error.statusCode === 302) return error.headers;
    throw error;
  }
}

test("session cookie keeps its security attributes on magic-link verification", async (t) => {
  const instance = await getTestInstance(t);
  const headers = await magicLinkHeaders(
    instance.auth,
    instance.getMagicLinks,
    "cookie-attributes@example.com",
  );
  const cookie = cookieNamed(headers, SESSION_COOKIE);

  t.ok(cookie, "session cookie is set");
  t.equal(attributeValue(cookie, "HttpOnly"), "", "HttpOnly is set");
  t.equal(attributeValue(cookie, "SameSite"), "Lax", "SameSite=Lax is set");
  t.equal(attributeValue(cookie, "Path"), "/", "Path=/ is set");
  t.ok(hasLifetime(cookie), "session cookie has a lifetime");
});

test("authorize response sets no cookie", async (t) => {
  const instance = await getTestInstance(t);
  const app = createApp(instance.auth, instance.db);
  const { cookie: sessionCookie } = await instance.getAuthHeaders(
    "authorize-cookie@example.com",
  );

  // OAuth state travels in a signed query string (sig=), not in a cookie.
  const params = authorizeParams({ state: "authorize-cookie" });
  const res = await app.request(
    `/api/auth/oauth2/authorize?${params.toString()}`,
    { headers: { cookie: sessionCookie } },
  );

  t.equal(res.status, 302, "authorize redirects to the callback");
  t.same(readSetCookie(res.headers), [], "no cookie is set");
});

test("logout clears every better-auth cookie", async (t) => {
  const instance = await getTestInstance(t);
  const app = createApp(instance.auth, instance.db);
  const { cookie: sessionCookie } = await instance.getAuthHeaders(
    "logout-cookies@example.com",
  );

  const res = await app.request("/logout", {
    method: "POST",
    headers: { cookie: sessionCookie },
  });

  t.equal(res.status, 302, "redirects after logout");
  const names = readSetCookie(res.headers)
    .map((cookie) => cookie.split("=")[0])
    .sort();
  t.same(names, LOGOUT_COOKIES, "forwards one clearing cookie per cookie");
});

test("logout clearing cookies keep their attributes", async (t) => {
  const instance = await getTestInstance(t);
  const app = createApp(instance.auth, instance.db);
  const { cookie: sessionCookie } = await instance.getAuthHeaders(
    "logout-attributes@example.com",
  );

  const res = await app.request("/logout", {
    method: "POST",
    headers: { cookie: sessionCookie },
  });
  const cookies = readSetCookie(res.headers);

  t.equal(cookies.length, LOGOUT_COOKIES.length, "every cookie is forwarded");
  for (const cookie of cookies) {
    const name = cookie.split("=")[0];
    t.equal(attributeValue(cookie, "Max-Age"), "0", `${name} expires now`);
    t.equal(attributeValue(cookie, "Path"), "/", `${name} keeps Path=/`);
    t.equal(attributeValue(cookie, "HttpOnly"), "", `${name} keeps HttpOnly`);
    t.equal(
      attributeValue(cookie, "SameSite"),
      "Lax",
      `${name} keeps SameSite=Lax`,
    );
  }
});
