import { test } from "tap";
import { getGithubAccountId } from "../../src/auth/id-token-claims.js";

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
