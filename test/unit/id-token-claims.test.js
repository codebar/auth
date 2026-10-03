import { test } from "tap";
import {
  getGithubAccountId,
  plannerIdTokenClaims,
} from "../../src/auth/id-token-claims.js";

function makeDb(rows) {
  return {
    query: async () => {
      return { rows };
    },
  };
}

test("returns the linked GitHub account id", async (t) => {
  const db = makeDb([{ accountId: "12345" }]);
  const id = await getGithubAccountId(db, "user-1");
  t.equal(id, "12345");
});

test("returns null when the user has no linked GitHub account", async (t) => {
  const db = makeDb([]);
  const id = await getGithubAccountId(db, "user-1");
  t.equal(id, null);
});

test("propagates database errors instead of swallowing them", async (t) => {
  const db = {
    query: async () => {
      throw new Error("connection lost");
    },
  };

  await t.rejects(
    () => getGithubAccountId(db, "user-1"),
    { message: "connection lost" },
    "database error is propagated",
  );
});

test("claims carry the user-record email and name", async (t) => {
  const claims = plannerIdTokenClaims(makeDb([]));
  const result = await claims({
    user: { id: "user-1", email: "ada@example.com", name: "Ada" },
  });

  t.same(result, { email: "ada@example.com", name: "Ada" });
});

test("claims add github_id for a linked GitHub account", async (t) => {
  const claims = plannerIdTokenClaims(makeDb([{ accountId: "12345" }]));
  const result = await claims({
    user: { id: "user-1", email: "ada@example.com", name: "Ada" },
  });

  t.same(result, {
    email: "ada@example.com",
    name: "Ada",
    github_id: "12345",
  });
});

test("claims omit github_id without a linked GitHub account", async (t) => {
  const claims = plannerIdTokenClaims(makeDb([]));
  const result = await claims({
    user: { id: "user-1", email: "ada@example.com", name: "Ada" },
  });

  t.notOk(Object.prototype.hasOwnProperty.call(result, "github_id"));
});
