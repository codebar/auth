import { Hono } from "hono";
import { html } from "hono/html";
import { Layout, Navigation } from "../components/layout.js";
import { Message, FormSection } from "../components/common.js";
import { GitHubButton, MagicLinkButton } from "../components/login.js";
import { getAuthFromContext } from "../utils/auth.js";
import { logout } from "../handlers/logout.js";
import { getCallbackURL } from "../utils/callback-url.js";
import appConfig from "../../config.js";

function showLogin(c) {
  const error = c.req.query("error");
  const success = c.req.query("success");
  const callbackURL = getCallbackURL(c);

  return c.html(
    Layout({
      title: "Sign In",
      children: html`
        <h1>Sign In</h1>
        ${Navigation({ back: { href: "/", text: "Back to Home" } })}
        ${Message({ error, success })}
        ${FormSection({
          children: html`
            ${MagicLinkButton({ callbackURL })} ${GitHubButton({ callbackURL })}
          `,
        })}
      `,
    }),
  );
}

function showMagicLinkForm(c) {
  const callbackURL = c.req.query("callbackURL") || getCallbackURL(c);

  return c.html(
    Layout({
      title: "Magic Link Login",
      children: html`
        <h1>Magic Link Login</h1>
        ${Navigation({ back: { href: "/login", text: "Back to Login" } })}
        ${Message({
          error: c.req.query("error"),
          success: c.req.query("success"),
        })}
        ${FormSection({
          children: html`
            <form method="post" action="/login/magic-link">
              <input type="hidden" name="callbackURL" value="${callbackURL}" />
              <fieldset>
                <input
                  type="email"
                  name="email"
                  placeholder="Enter your email"
                  required
                />
              </fieldset>
              <button type="submit">Send Magic Link</button>
            </form>
          `,
        })}
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
      errorCallbackURL: `${appConfig.base_url}/login?error=${encodeURIComponent("The magic link has expired or already been used")}`,
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
  const { callbackURL } = body;

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
