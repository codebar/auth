// Better Auth redirects magic-link errors by setting the `error` query param
// to a short code (e.g. INVALID_TOKEN), overwriting whatever message we set
// in errorCallbackURL. Map codes to human-friendly text at render time.
const FRIENDLY = {
  INVALID_TOKEN:
    "This sign-in link has expired or already been used. Please request a new one.",
  new_user_signup_disabled:
    "New sign-ups are currently disabled. Please contact support.",
  failed_to_create_user: "We couldn't create your account. Please try again.",
  failed_to_create_session: "We couldn't start a session. Please try again.",
};

export const friendlyError = (code) => FRIENDLY[code] ?? code;
