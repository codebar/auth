/**
 * Seed the planner OAuth client directly into the database.
 *
 * Bypasses the admin-only createOAuthClient API by inserting the
 * first-party client row via raw SQL.
 */

// ponytail: raw SQL because Better Auth doesn't expose a public API to
// create OAuth clients without admin auth. If the schema changes, update here.
export async function seedPlannerClient(db, redirectUris, schemaName) {
  const uris = Array.isArray(redirectUris) ? redirectUris : [redirectUris];
  // Validate schemaName to prevent SQL injection — only alphanumeric + underscore
  if (
    schemaName !== undefined &&
    !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schemaName)
  ) {
    throw new Error(`Invalid schema name: ${schemaName}`);
  }
  const table = schemaName ? `"${schemaName}"."oauthClient"` : `"oauthClient"`;
  const sql = `INSERT INTO ${table} (
    id, "clientId", "clientSecret", name, "redirectUris",
    "grantTypes", "responseTypes", "tokenEndpointAuthMethod",
    "public", "skipConsent", "requirePKCE", "createdAt", "updatedAt"
  ) VALUES (
    'planner-seed', 'planner', NULL, 'Codebar Planner',
    $1::jsonb, to_jsonb(ARRAY['authorization_code']),
    to_jsonb(ARRAY['code']), 'none', true, true, true,
    NOW(), NOW()
  )
  ON CONFLICT ("clientId") DO UPDATE SET "redirectUris" = $1::jsonb`;
  await db.query(sql, [JSON.stringify(uris)]);
}
