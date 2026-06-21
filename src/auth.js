import { betterAuth } from "better-auth";
import { admin, magicLink } from "better-auth/plugins";
import Database from "better-sqlite3";
import { Pool } from "pg";
import appConfig from "./config.js";

// Detect database type from connection string
const isPostgres = appConfig.database_url.startsWith("postgres://");

let db;
if (isPostgres) {
  // PostgreSQL for CI/production
  db = new Pool({
    connectionString: appConfig.database_url,
    max: 10, // reasonable pool size
    ssl: { rejectUnauthorized: false },
  });

  db.on("error", (err) => {
    console.error("Unexpected database error", err);
    process.exit(-1);
  });
} else {
  // SQLite for local development
  db = new Database(appConfig.database_url);

  try {
    db.pragma("busy_timeout = 5000");
    db.pragma("synchronous = NORMAL");
  } catch (e) {
    console.error(`error occurred: ${e.message}`);
    process.exit(-1);
  }
}

// Export db for graceful shutdown
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
      sendMagicLink: async ({ email, url }) => {
        const apiKey = process.env.SENDGRID_API_KEY;
        const fromEmail =
          process.env.MAGIC_LINK_FROM_EMAIL || "auth-noreply@codebar.io";

        if (!apiKey) {
          console.log(`Magic Link for ${email}: ${url}`);
          return;
        }

        try {
          const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              personalizations: [{ to: [{ email }] }],
              from: { email: fromEmail },
              subject: "Sign in to codebar",
              content: [
                {
                  type: "text/plain",
                  value: `Click the link below to sign in to codebar:\n\n${url}\n\nThis link expires in 5 minutes.`,
                },
              ],
            }),
          });

          if (!res.ok) {
            console.error(`SendGrid error: ${res.status} ${await res.text()}`);
          }
        } catch (err) {
          console.error("Failed to send magic link:", err);
        }
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
