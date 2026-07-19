import { html } from "hono/html";

// Derive a version stamp for cache-busting static assets.
// HEROKU_RELEASE_VERSION is set by Heroku when runtime-dyno-metadata is enabled.
// Falls back to 'dev' for local development.
const STATIC_VERSION = process.env.HEROKU_RELEASE_VERSION || "dev";

// Base layout component
export const Layout = ({ title, children }) => html`
  <!DOCTYPE html>
  <html>
    <head>
      <title>${title}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="color-scheme" content="light dark" />
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css"
      />
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.colors.min.css"
      />
    </head>
    <body>
      <header></header>
      <main class="container">${children}</main>
      <footer></footer>
      <script
        type="module"
        src="/static/auth-client.js?v=${STATIC_VERSION}"
      ></script>
    </body>
  </html>
`;
// Navigation component
export const Navigation = ({ back, extra }) => html`
  <a href="${back.href}">← ${back.text}</a>
  ${extra ? html` | <a href="${extra.href}">${extra.text}</a>` : ""}
`;
