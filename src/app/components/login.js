import { html } from "hono/html";

// GitHub login
export const GitHubButton = ({ redirectUrl } = {}) => html`
  <h2>Using GitHub</h2>
  <button
    onclick="handleGitHubSignIn(event)"
    data-redirect-url="${redirectUrl || ""}"
  >
    Sign In with GitHub
  </button>
`;

// Magic link button component
export const MagicLinkButton = ({ redirectUrl } = {}) => html`
  <h2>Using magic link</h2>
  <form method="get" action="/login/magic-link">
    <input type="hidden" name="redirect_url" value="${redirectUrl}" />
    <button type="submit">Send Magic Link</button>
  </form>
`;
