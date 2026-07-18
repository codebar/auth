import { html } from "hono/html";
import { STATIC_VERSION } from "../version.js";

// Login status display
export const LoginStatus = ({ user }) => html`
  <div class="auth-status">
    ${
      user
        ? html`
            <div class="alert alert-cb-success mb-4">
              <strong>Logged in</strong> as ${user.name} (${user.email})
            </div>
            <div class="d-flex gap-2">
              <a href="/profile" class="btn btn-cb-primary">View Profile</a>
              <form method="post" action="/logout" class="d-inline">
                <button type="submit" class="btn btn-outline-danger">
                  Logout
                </button>
              </form>
            </div>
          `
        : html`
            <div class="text-center py-5">
              <img
                src="/static/codebar-logo.svg?v=${STATIC_VERSION}"
                alt="codebar mark"
                height="180"
                class="mb-4"
              />
              <h1 class="display-welcome display-5 mb-3">Welcome to codebar</h1>
              <p
                class="text-muted mb-4"
                style="max-width: 400px; margin-inline: auto;"
              >
                Sign in to manage your profile and access workshops.
              </p>
              <a href="/login" class="btn btn-cb-primary btn-lg px-5"
                >Sign In</a
              >
            </div>
          `
    }
  </div>
`;
