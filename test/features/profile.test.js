import { test } from "tap";
import { getTestInstance } from "../helpers/test-instance.js";
import { createApp } from "../../src/app/app.js";

test("profile feature tests", async (t) => {
  t.test("authenticated user can view profile", async (t) => {
    const testInstance = await getTestInstance(t);
    const app = createApp(testInstance.auth);
    const { getAuthHeaders } = testInstance;

    const headers = await getAuthHeaders("profile@example.com");
    const res = await app.request("/profile", { headers });

    t.equal(res.status, 200, "profile page loads");
    const html = await res.text();
    t.match(html, /profile@example\.com/, "displays user email");
  });

  t.test("unauthenticated user redirects to login", async (t) => {
    const testInstance = await getTestInstance(t);
    const app = createApp(testInstance.auth);

    const res = await app.request("/profile");

    t.equal(res.status, 302, "redirects unauthenticated user");
    t.match(res.headers.get("location"), /\/login/, "redirects to login page");
  });

  t.test("profile with invalid session redirects to login", async (t) => {
    const testInstance = await getTestInstance(t);
    const app = createApp(testInstance.auth);

    // Use invalid cookie
    const res = await app.request("/profile", {
      headers: {
        cookie: "better-auth.session_token=invalid-token",
      },
    });

    t.equal(res.status, 302, "redirects with invalid session");
    t.match(res.headers.get("location"), /\/login/, "redirects to login");
  });
});
