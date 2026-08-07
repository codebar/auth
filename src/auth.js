import { Pool } from "pg";
import { betterAuth } from "better-auth";
import { admin, magicLink, jwt } from "better-auth/plugins";
import { oauthProvider } from "@better-auth/oauth-provider";
import appConfig from "./config.js";
import { getGithubUserInfo } from "./auth/github-provider.js";
import { devMagicLinks } from "./dev/magic-links.js";
import { buildMagicLinkPayload } from "./app/utils/magic-link-email.js";

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
      // Resolve the account email from /user/emails (primary + verified) so
      // returning GitHub users match their existing planner accounts.
      getUserInfo: getGithubUserInfo,
      // Re-derive the stored email from the provider on every sign-in so users
      // who linked BEFORE getUserInfo shipped (with their old public-email
      // address) self-heal to the primary instead of staying bound to a
      // duplicate planner account.
      overrideUserInfoOnSignIn: true,
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
            body: JSON.stringify(
              buildMagicLinkPayload({
                email,
                url,
                fromEmail,
                subject: "Sign in to codebar",
              }),
            ),
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
