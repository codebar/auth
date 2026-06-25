import { Pool } from "pg";
import { betterAuth } from "better-auth";
import { admin, magicLink, jwt } from "better-auth/plugins";
import { oauthProvider } from "@better-auth/oauth-provider";
import appConfig from "./config.js";
import { devMagicLinks } from "./dev/magic-links.js";

// PostgreSQL connection pool for CI/production and local dev
// SSL only for non-local connections (Heroku requires it; local/CI does not)
const isLocal =
  appConfig.database_url.includes("@localhost") ||
  appConfig.database_url.includes("@127.0.0.1");
const db = new Pool({
  connectionString: appConfig.database_url,
  max: 10,
  ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
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
  // ponytail: the database strategy's extra signed state cookie check is
  // redundant — the state is already validated against the `verification`
  // table. Cloudflare strips `__Secure-` prefix cookies on ingress, so the
  // cookie fails on the GitHub OAuth callback redirect. skipStateCookieCheck
  // skips this check. Better Auth's own oauth-proxy plugin does the same.
  account: {
    skipStateCookieCheck: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day (update session every day)
  },
  plugins: [
    jwt({
      jwks: {
        keyPairConfig: { alg: "RS256" },
      },
      jwt: {
        issuer: appConfig.base_url,
        audience: "planner",
        expirationTime: "15m",
        definePayload: (session) => ({
          email: session.user.email,
          name: session.user.name,
        }),
      },
    }),
    oauthProvider({
      loginPage: "/login",
      scopes: ["openid", "profile", "email"],
      accessTokenExpiresIn: 900, // 15 minutes
      validAudiences: ["planner"],
      allowDynamicClientRegistration: false,
    }),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        if (process.env.NODE_ENV !== "production") {
          console.log(`Magic Link for ${email}: ${url}`);
          devMagicLinks.push({
            email,
            url,
            createdAt: new Date().toISOString(),
          });
          return;
        }

        const apiKey = process.env.SENDGRID_API_KEY;
        const fromEmail =
          process.env.MAGIC_LINK_FROM_EMAIL || "auth-noreply@codebar.io";

        if (!apiKey) {
          console.error(
            "SENDGRID_API_KEY is not set in production — magic links will not be sent",
          );
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
  trustedOrigins: [
    appConfig.base_url,
    ...(!appConfig.isProduction ? ["http://127.0.0.1:3001"] : []),
  ],
});
