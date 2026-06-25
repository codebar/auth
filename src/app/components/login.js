import { html } from "hono/html";

export const GitHubButton = ({ callbackURL } = {}) => html`
  <h2>Using GitHub</h2>
  <form method="post" action="/login/github">
    <input type="hidden" name="callbackURL" value="${callbackURL || ""}" />
    <button type="submit">Sign In with GitHub</button>
  </form>
`;

export const MagicLinkButton = ({ callbackURL } = {}) => html`
  <h2>Using magic link</h2>
  <form method="get" action="/login/magic-link">
    <input type="hidden" name="callbackURL" value="${callbackURL || ""}" />
    <button type="submit">Send Magic Link</button>
  </form>
`;
