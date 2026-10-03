/**
 * Resolve the linked GitHub account id for a user.
 *
 * The planner uses this stable id to match returning members whose GitHub
 * email differs from their stored planner email.
 *
 * Failures are allowed to propagate: a transient database error here would
 * otherwise silently omit `github_id` and cause the planner to fall back to
 * email matching, re-creating the duplicate-member bug this claim is meant
 * to prevent.
 */
export async function getGithubAccountId(db, userId) {
  const result = await db.query(
    'SELECT "accountId" FROM "account" WHERE "userId" = $1 AND "providerId" = \'github\' LIMIT 1',
    [userId],
  );

  return result.rows[0]?.accountId ?? null;
}

/**
 * Build the `customIdTokenClaims` hook shared by the app and the tests.
 *
 * Every id_token carries the user-record `email` and `name` claims: the
 * planner resolves members by `email` and falls back to `sub` (the
 * better-auth user id) when the claim is absent, which keys a duplicate
 * member. `github_id` is added for linked accounts so returning members
 * resolve even when their GitHub email diverges from the stored one.
 */
export function plannerIdTokenClaims(db) {
  return async ({ user }) => {
    const claims = { email: user.email, name: user.name };
    const githubId = await getGithubAccountId(db, user.id);
    return githubId ? { ...claims, github_id: String(githubId) } : claims;
  };
}
