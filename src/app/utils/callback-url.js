import appConfig from "../../config.js";

/**
 * Build the post-auth callback URL from the current request.
 *
 * If the request carries OAuth 2.1 authorize params (response_type, client_id,
 * etc.), the user came from the planner — forward them to the authorize
 * endpoint so the OAuth flow completes.
 *
 * Otherwise the user came directly to the auth app — redirect to the auth
 * app's own /profile page. The planner session can only be started from
 * the planner (it holds the PKCE verifier + state), so there's no point
 * trying to initiate an OAuth flow here.
 *
 * @param {import("hono").Context} c - Hono context
 * @returns {string} Redirect URL
 */
export function getCallbackURL(c) {
  const url = new URL(c.req.url);
  const search = new URLSearchParams(url.search);
  // Use the configured base URL rather than request origin — behind
  // Heroku/Cloudflare TLS terminates at the edge, so origin would be
  // http:// not https://, which Better Auth rejects in trustedOrigins.
  const base = appConfig.base_url;

  if (search.has("response_type")) {
    const params = new URLSearchParams();
    for (const key of [
      "response_type",
      "client_id",
      "redirect_uri",
      "state",
      "scope",
      "code_challenge",
      "code_challenge_method",
    ]) {
      if (search.has(key)) params.set(key, search.get(key));
    }
    return `${base}/api/auth/oauth2/authorize?${params.toString()}`;
  }

  // Direct visit — no OAuth flow to resume, send to profile
  return `${base}/profile`;
}
