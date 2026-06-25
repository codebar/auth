export const AUTH_DEFAULT_PORT = 3001;
export const PLANNER_DEFAULT_PORT = 3000;

// There is no staging auth app — the production auth app (auth.codebar.io)
// serves both the production and staging planners. PLANNER_REDIRECT_URIS
// should list callback URLs for every environment.
const parseRedirectUris = () =>
  (
    process.env.PLANNER_REDIRECT_URIS ||
    `http://localhost:${PLANNER_DEFAULT_PORT}/auth/codebar/callback`
  )
    .split(",")
    .map((s) => s.trim());

const config = {
  port: process.env.PORT || AUTH_DEFAULT_PORT,
  isProduction: process.env.NODE_ENV === "production",
  base_url:
    process.env.CODEBAR_AUTH_URL || `http://localhost:${AUTH_DEFAULT_PORT}`,
  database_url:
    process.env.DATABASE_URL || "postgres://auth:auth@localhost:5433/test",
  planner_url:
    process.env.PLANNER_URL || `http://localhost:${PLANNER_DEFAULT_PORT}`,
  planner_redirect_uris: parseRedirectUris(),
  allowed_redirects: parseRedirectUris(),
  social: {
    github: {
      id: process.env.GITHUB_CLIENT_ID,
      secret: process.env.GITHUB_CLIENT_SECRET,
    },
  },
};

export default config;
