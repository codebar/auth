import { html } from "hono/html";
import { STATIC_VERSION } from "../version.js";

// Base layout component
export const Layout = ({ title, children, hideNav }) => html`
  <!DOCTYPE html>
  <html data-bs-theme="auto">
    <head>
      <title>codebar Auth — ${title}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <link
        rel="stylesheet"
        href="/static/bootstrap.min.css?v=${STATIC_VERSION}"
      />
      <link rel="stylesheet" href="/static/codebar.css?v=${STATIC_VERSION}" />
    </head>
    <body>
      ${
        !hideNav
          ? html`
              <nav
                class="navbar navbar-expand-lg navbar-light bg-white fixed-top py-3"
              >
                <div class="container">
                  <a
                    class="navbar-brand border-0 d-flex align-items-center gap-2"
                    href="/"
                  >
                    <img
                      src="/static/codebar-logo.png?v=${STATIC_VERSION}"
                      alt="codebar logo"
                      width="200"
                      height="54"
                    />
                    <span
                      class="fw-semibold text-muted"
                      style="font-size: 0.85rem;"
                      >auth</span
                    >
                  </a>
                </div>
              </nav>
            `
          : ""
      }
      <main class="container py-4">${children}</main>
      <script
        type="module"
        src="/static/auth-client.js?v=${STATIC_VERSION}"
      ></script>
      <script src="/static/bootstrap.bundle.min.js?v=${STATIC_VERSION}"></script>
    </body>
  </html>
`;

// Navigation component
export const Navigation = ({ back, extra }) => html`
  <a href="${back.href}" class="btn btn-outline-secondary btn-sm"
    >← ${back.text}</a
  >
  ${
    extra
      ? html`<a
          href="${extra.href}"
          class="btn btn-outline-secondary btn-sm ms-1"
          >${extra.text}</a
        >`
      : ""
  }
`;
