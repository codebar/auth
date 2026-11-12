import { test } from "tap";
import { getTestInstance } from "../helpers/test-instance.js";
import { createApp } from "../../src/app/app.js";
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
    return headers
      .filter(([name]) => name.toLowerCase() === "set-cookie")
      .map(([, value]) => value);
  }
  return [];
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

test("GET /logout clears every better-auth cookie", async (t) => {
  const instance = await getTestInstance(t);
  const app = createApp(instance.auth, instance.db);
  const { cookie: sessionCookie } = await instance.getAuthHeaders(
    "logout-get@example.com",
  );

  const res = await app.request("/logout", {
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

test("logout surfaces a failed signOut instead of redirecting", async (t) => {
  const auth = {
    api: {
      getSession: async () => null,
      signOut: async () =>
        new Response(JSON.stringify({ message: "signOut failed" }), {
          status: 500,
        }),
    },
  };
  const app = createApp(auth, null);

  const res = await app.request("/logout");

  t.equal(res.status, 500, "propagates the signOut status");
  t.equal(res.headers.get("location"), null, "does not redirect");
});
