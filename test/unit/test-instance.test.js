import pg from "pg";
import { test } from "tap";
import { getTestInstance } from "../helpers/test-instance.js";

test("getTestInstance requires the tap context", async (t) => {
  for (const [label, context] of [
    ["no argument", undefined],
    ["null", null],
    ["an object without teardown", {}],
    ["a non-function teardown", { teardown: "not a function" }],
  ]) {
    await t.rejects(
      getTestInstance(context),
      { message: /requires the tap context/ },
      `rejects ${label}`,
    );
  }
});

test("getTestInstance registers a teardown that drops its schema", async (t) => {
  const registered = [];
  const instance = await getTestInstance({
    teardown: (fn) => registered.push(fn),
  });
  t.equal(registered.length, 1, "registers one teardown");

  const { rows } = await instance.pool.query("SELECT current_schema() AS name");
  const schemaName = rows[0].name;
  t.match(schemaName, /^test_/, "instance runs in its own schema");

  await registered[0]();

  const checker = new pg.Pool(instance.pool.options);
  try {
    const gone = await checker.query(
      "SELECT 1 FROM pg_namespace WHERE nspname = $1",
      [schemaName],
    );
    t.equal(gone.rowCount, 0, "teardown drops the schema");
  } finally {
    await checker.end();
  }
  await t.rejects(
    instance.pool.query("SELECT 1"),
    /after calling end/,
    "teardown ends the pool",
  );
});

test("teardown runs once", async (t) => {
  const registered = [];
  const instance = await getTestInstance({
    teardown: (fn) => registered.push(fn),
  });

  await instance.teardown();
  await t.resolves(
    registered[0](),
    "the registered teardown is a no-op after a manual teardown",
  );
});
