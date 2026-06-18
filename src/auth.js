import { Pool } from "pg";
import { betterAuth } from "better-auth";
import { admin, magicLink } from "better-auth/plugins";
import appConfig from "./config.js";

// PostgreSQL connection pool for CI/production and local dev
const db = new Pool({
  connectionString: appConfig.database_url,
  max: 10,
});

db.on("error", (err) => {
  console.error("Unexpected database error", err);
  process.exit(-1);
});

export { db };

export const auth = betterAuth({
  database: db,
  baseURL: appConfig.base_url,
  logger: {
    disabled: false,
    level: "debug",
  },
  socialProviders: {
    github: {
      clientId: appConfig.social.github.id,
      clientSecret: appConfig.social.github.secret,
    },
  },
  telemetry: {
    enabled: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day (update session every day)
  },
  plugins: [
    magicLink({
      // eslint-disable-next-line no-unused-vars -- request is currently unused in this demo
      sendMagicLink: async ({ email, token, url }, request) => {
        console.log(`Magic Link for ${email}: ${url}`);
        console.log(`Token: ${token}`);
        console.log("---");
        // Return a resolved promise since we're just logging
        return Promise.resolve();
      },
    }),
    admin({
      // adminUserIds: [],
    }),
  ],
  // advanced: {
  //   crossSubDomainCookies: {
  //     enabled: true,
  //     domain: '.codebar.io',
  //   },
  // },
  // trustedOrigins: [
  //   'https://codebar.io',
  //   'https://stats.codebar.io',
  //   'https://calendar.codebar.io',
  //   'https://jobs.codebar.io'
  // ],
});
