import { html } from "hono/html";

// Login status display
export const LoginStatus = ({ user }) => html`
  ${
    user
      ? html`
          <div class="pico-background-green-50">
            ✅ Logged in as: <strong>${user.name}</strong> (${user.email})
          </div>
          <a href="/profile">View Profile</a> |
          <form method="post" action="/logout">
            <button type="submit">Logout</button>
          </form>
        `
      : html`
          <div class="pico-background-red-50">❌ Not logged in</div>
          <a href="/login">Sign In</a>
        `
  }
`;
