import appConfig from "../../config.js";

/**
 * Build the OAuth authorize callback URL from the current request.
 *
 * If the request carries OAuth 2.1 authorize params (response_type, client_id,
 * etc.), they are forwarded to the auth app. Otherwise a default authorize
 * URL for the planner client is returned.
 *
 * @param {import("hono").Context} c - Hono context
 * @returns {string} Authorize URL
 */
export function getCallbackURL(c) {
  const url = new URL(c.req.url);
  const search = new URLSearchParams(url.search);
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

  const params = new URLSearchParams({
    client_id: "planner",
    redirect_uri: appConfig.allowed_redirects[0],
    response_type: "code",
    scope: "openid profile email",
  });
  return `${base}/api/auth/oauth2/authorize?${params.toString()}`;
}
