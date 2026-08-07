// GitHub requires a descriptive User-Agent on API requests.
const GITHUB_API = "https://api.github.com";
const USER_AGENT = "codebar-auth";

/**
 * GET a GitHub API endpoint with the user's access token.
 * Returns parsed JSON, or null on a non-2xx response.
 */
async function githubFetch(path, accessToken) {
  try {
    const res = await fetch(`${GITHUB_API}${path}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": USER_AGENT,
        Accept: "application/vnd.github+json",
      },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    // Fail soft: a network error here must not turn the OAuth callback into a
    // 500. Better Auth's default getUserInfo returns null on failure too.
    return null;
  }
}

/**
 * Build the better-auth GitHub user from GitHub's profile + email endpoints.
 *
 * Resolves the email the same way the planner's legacy omniauth-github
 * integration did: prefer the primary and verified address from
 * /user/emails. Better Auth's default prioritises /user.email (the public
 * profile email), which routinely differs from the primary account email and
 * made returning users appear to be new signups.
 *
 * Returns the shape better-auth's github provider getUserInfo hook expects:
 * `{ user, data }`.
 */
export async function getGithubUserInfo({ accessToken }) {
  const [profile, emails] = await Promise.all([
    githubFetch("/user", accessToken),
    githubFetch("/user/emails", accessToken),
  ]);

  const primary = emails?.find((e) => e.primary && e.verified);
  const email = primary?.email || profile?.email || emails?.[0]?.email || "";
  const emailVerified =
    primary !== undefined
      ? true
      : (emails?.some((e) => e.email === email && e.verified) ?? false);

  return {
    user: {
      id: String(profile?.id ?? ""),
      name: profile?.name || profile?.login || "",
      email,
      image: profile?.avatar_url,
      emailVerified,
    },
    data: profile,
  };
}
