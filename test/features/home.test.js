import { test } from "tap";
import { getTestInstance } from "../helpers/test-instance.js";
import { createApp } from "../../src/app/app.js";

test("home page feature tests", async (t) => {
  t.test("home page loads without authentication", async (t) => {
    const testInstance = await getTestInstance(t);
    const app = createApp(testInstance.auth);

    const res = await app.request("/");

    t.equal(res.status, 200, "returns 200 OK");
    const html = await res.text();
    t.match(html, /codebar authentication/i, "contains app title");
  });

  t.test("home page has login link", async (t) => {
    const testInstance = await getTestInstance(t);
    const app = createApp(testInstance.auth);

    const res = await app.request("/");
    const html = await res.text();

    t.match(html, /login/i, "contains login link");
  });
});
