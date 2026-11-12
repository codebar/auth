import { validateRedirectUrl } from "../utils/redirect.js";
import { getAuthFromContext } from "../utils/auth.js";

/**
 * Logout handler
 * @param {import("hono").Context} c
 * @returns
 */
export const logout = async (c) => {
  const auth = getAuthFromContext(c);
  const callbackURL = validateRedirectUrl(
    c.req.query("redirect_url"),
    "/?message=Bye!",
  );
  const signOut = await auth.api.signOut({
    headers: c.req.raw.headers,
    asResponse: true,
  });
  // asResponse turns APIErrors into error responses; other errors still throw.
  if (!signOut.ok) {
    console.error(`Logout failed with status ${signOut.status}`);
    return signOut;
  }

  const response = c.redirect(callbackURL);
  for (const cookie of signOut.headers.getSetCookie()) {
    response.headers.append("Set-Cookie", cookie);
  }

  return response;
};
