import { html } from "hono/html";

export const GitHubButton = ({ callbackURL } = {}) => html`
  <form method="post" action="/login/github">
    <input type="hidden" name="callbackURL" value="${callbackURL || ""}" />
    <button type="submit" class="btn btn-cb-primary w-100">
      Sign in with GitHub
    </button>
  </form>
`;

export const MagicLinkButton = ({ callbackURL } = {}) => html`
  <form method="get" action="/login/magic-link">
    <input type="hidden" name="callbackURL" value="${callbackURL || ""}" />
    <button type="submit" class="btn btn-cb-primary w-100">
      Send magic link
    </button>
  </form>
`;
