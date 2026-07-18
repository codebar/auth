import { Hono } from "hono";
import { html } from "hono/html";
import { Layout } from "../components/layout.js";
import { Message } from "../components/common.js";
import { UserInfo } from "../components/profile.js";

export default new Hono().get("/profile", async (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/login?error=no+session");

  const error = c.req.query("error");
  const success = c.req.query("success");

  return c.html(
    Layout({
      title: "Profile",
      children: html`
        <h1 class="h3 mb-3 fw-semibold">Profile</h1>

        ${Message({ error, success })} ${UserInfo({ user })}

        <div class="mt-3 d-flex gap-2">
          <a href="/" class="btn btn-outline-secondary">← Back to Home</a>
          <form method="post" action="/logout" class="d-inline">
            <button type="submit" class="btn btn-outline-danger">Logout</button>
          </form>
        </div>
      `,
    }),
  );
});
