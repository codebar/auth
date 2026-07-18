import { Hono } from "hono";
import { html } from "hono/html";
import { Layout } from "../components/layout.js";
import { Message } from "../components/common.js";
import { UsersList } from "../components/admin.js";
import { getAuthFromContext } from "../utils/auth.js";

export default new Hono()
  .get("/admin", async (c) => {
    const auth = getAuthFromContext(c);
    const users = await auth.api.listUsers({
      query: { query: {} },
      headers: c.req.raw.headers,
    });

    const error = c.req.query("error");
    const success = c.req.query("success");

    return c.html(
      Layout({
        title: "Admin",
        children: html`
          <h1 class="h3 mb-3 fw-semibold">Admin</h1>
          <a href="/" class="btn btn-outline-secondary btn-sm mb-3"
            >← Back to Home</a
          >

          ${Message({ error, success })}
          ${UsersList({ users: users.users, total: users.total })}
        `,
      }),
    );
  })
  .post("/admin/user/role", async (c) => {
    const auth = getAuthFromContext(c);
    const body = await c.req.parseBody();
    const { userId, role } = body;

    try {
      await auth.api.setRole({
        body: { userId, role },
        headers: c.req.raw.headers,
      });

      return c.redirect(
        "/admin?success=" + encodeURIComponent(`User role updated to ${role}`),
      );
    } catch (error) {
      console.error("Update role error:", error);
      return c.redirect(
        "/admin?error=" + encodeURIComponent("Failed to update user role"),
      );
    }
  });
