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
