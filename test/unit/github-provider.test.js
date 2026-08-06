import { test } from "tap";
import { getGithubUserInfo } from "../../src/auth/github-provider.js";

const originalFetch = global.fetch;

function mockFetch(routes) {
  global.fetch = async (url) => {
    const path = new URL(url).pathname;
    const body = routes[path];
    if (!body) {
      return { ok: false, json: async () => null };
    }
    return { ok: true, json: async () => body };
  };
}

function afterFetch(t) {
  t.after(() => {
    global.fetch = originalFetch;
  });
}

test("prefers primary verified email over the public profile email", async (t) => {
  afterFetch(t);
  mockFetch({
    "/user": {
      id: 12345678,
      login: "jdoe",
      name: "Jane Doe",
      email: "jane@example.com",
    },
    "/user/emails": [
      { email: "jane@example.com", primary: false, verified: true },
      { email: "jane.doe@work.example", primary: true, verified: true },
    ],
  });

  const { user } = await getGithubUserInfo({ accessToken: "token" });

  t.equal(user.email, "jane.doe@work.example");
  t.equal(user.emailVerified, true);
  t.equal(user.id, "12345678");
  t.equal(user.name, "Jane Doe");
});

test("falls back to the public profile email when no primary is verified", async (t) => {
  afterFetch(t);
  mockFetch({
    "/user": {
      id: 1,
      login: "alice",
      name: "Alice",
      email: "alice@example.com",
    },
    "/user/emails": [
      { email: "alice@example.com", primary: true, verified: false },
    ],
  });

  const { user } = await getGithubUserInfo({ accessToken: "token" });

  t.equal(user.email, "alice@example.com");
  t.equal(user.emailVerified, false);
});

test("uses the public profile email when /user/emails has no entries", async (t) => {
  afterFetch(t);
  mockFetch({
    "/user": { id: 2, login: "bob", email: "bob@example.com" },
    "/user/emails": [],
  });

  const { user } = await getGithubUserInfo({ accessToken: "token" });

  t.equal(user.email, "bob@example.com");
});

test("falls back to the first listed email when profile email is blank", async (t) => {
  afterFetch(t);
  mockFetch({
    "/user": { id: 3, login: "carol" },
    "/user/emails": [
      { email: "carol@example.com", primary: true, verified: true },
    ],
  });

  const { user } = await getGithubUserInfo({ accessToken: "token" });

  t.equal(user.email, "carol@example.com");
  t.equal(user.emailVerified, true);
});

test("returns a user without throwing when GitHub call throws", async (t) => {
  afterFetch(t);
  global.fetch = async () => {
    throw new Error("network down");
  };

  const { user } = await getGithubUserInfo({ accessToken: "token" });

  t.equal(user.email, "");
  t.equal(user.emailVerified, false);
});
