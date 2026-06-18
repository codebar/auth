import { test } from "tap";
import { getTestInstance } from "../helpers/test-instance.js";
import { createApp } from "../../src/app/app.js";

test("authentication feature tests", async (t) => {
  t.test("user can logout", async (t) => {
    const testInstance = await getTestInstance(t);
    const app = createApp(testInstance.auth);
    const { getAuthHeaders } = testInstance;

    // Get auth headers via magic link
    const headers = await getAuthHeaders("logout@example.com");

    // Verify user is logged in by accessing profile
    const profileBefore = await app.request("/profile", { headers });
    t.equal(profileBefore.status, 200, "user is logged in");

    // Logout
    const res = await app.request("/logout", {
      method: "POST",
      headers,
    });

    t.equal(res.status, 302, "redirects after logout");
    t.match(res.headers.get("location"), /\//, "redirects to home");

    // Verify session is invalidated
    const profileAfter = await app.request("/profile", { headers });
    t.equal(profileAfter.status, 302, "profile requires authentication");
    t.match(
      profileAfter.headers.get("location"),
      /\/login/,
      "redirects to login",
    );
  });
});
