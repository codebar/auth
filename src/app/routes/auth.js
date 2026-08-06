import { Hono } from "hono";
import { html } from "hono/html";
import { Layout, Navigation } from "../components/layout.js";
import { Message } from "../components/common.js";
import { GitHubButton, MagicLinkButton } from "../components/login.js";
import { getAuthFromContext } from "../utils/auth.js";
import { logout } from "../handlers/logout.js";
import { getCallbackURL } from "../utils/callback-url.js";
import { friendlyError } from "../utils/friendly-error.js";
import appConfig from "../../config.js";

function showLogin(c) {
  const error = c.req.query("error");
  const success = c.req.query("success");
  const callbackURL = getCallbackURL(c);
  const friendly = error ? friendlyError(decodeURIComponent(error)) : null;

  return c.html(
    Layout({
      title: "Sign In",
      children: html`
        <div class="row justify-content-center">
          <div class="col-md-8 col-lg-6">
            <h1 class="h3 mb-3 fw-semibold">Sign In</h1>
            ${Navigation({ back: { href: "/", text: "Back to Home" } })}
            <hr class="my-3" />
            ${Message({ error: friendly, success })}
            <div class="row g-3">
              <div class="col-sm-6">${GitHubButton({ callbackURL })}</div>
              <div class="col-sm-6">${MagicLinkButton({ callbackURL })}</div>
            </div>
          </div>
        </div>
      `,
    }),
  );
}

function showMagicLinkForm(c) {
  const callbackURL = c.req.query("callbackURL") || getCallbackURL(c);
  const error = c.req.query("error");
  const friendly = error ? friendlyError(decodeURIComponent(error)) : null;

  return c.html(
    Layout({
      title: "Sign in with e-mail",
      children: html`
        <div class="row justify-content-center">
          <div class="col-md-6 col-lg-5">
            <h1 class="h3 mb-3 fw-semibold">Sign In</h1>
            ${Navigation({ back: { href: "/login", text: "Back to Login" } })}
            <hr class="my-3" />
            ${Message({
              error: friendly,
              success: c.req.query("success"),
            })}
            <form method="post" action="/login/magic-link">
              <input type="hidden" name="callbackURL" value="${callbackURL}" />
              <div class="mb-3">
                <label for="email" class="form-label">Email address</label>
                <input
                  type="email"
                  class="form-control"
                  id="email"
                  name="email"
                  placeholder="you@example.com"
                  required
                />
              </div>
              <button type="submit" class="btn btn-cb-primary w-100">
                Sign in with e-mail
              </button>
            </form>
          </div>
        </div>
      `,
    }),
  );
}

async function sendMagicLink(c) {
  const auth = getAuthFromContext(c);
  const body = await c.req.parseBody();
  const { email, callbackURL } = body;

  await auth.api.signInMagicLink({
    body: {
      email,
      callbackURL,
      errorCallbackURL: `${appConfig.base_url}/login`,
    },
    headers: c.req.raw.headers,
  });
  return c.redirect(
    `/login/magic-link?success=${encodeURIComponent("Magic link sent! Check your email.")}`,
  );
}

async function startGitHubOAuth(c) {
  const auth = getAuthFromContext(c);
  const body = await c.req.parseBody();
  const callbackURL = body.callbackURL || "/";

  const data = await auth.api.signInSocial({
    body: { provider: "github", callbackURL },
  });

  if (data.url) {
    return c.redirect(data.url);
  }

  return c.redirect(
    `/login?error=${encodeURIComponent("Failed to initiate GitHub sign-in")}`,
  );
}

export default new Hono()
  .get("/login", showLogin)
  .get("/logout", logout)
  .post("/logout", logout)
  .get("/login/magic-link", showMagicLinkForm)
  .post("/login/magic-link", sendMagicLink)
  .post("/login/github", startGitHubOAuth);
