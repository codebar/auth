import { test } from "tap";
import { buildMagicLinkPayload } from "../../src/app/utils/magic-link-email.js";

test("buildMagicLinkPayload disables SendGrid click tracking", async (t) => {
  const payload = buildMagicLinkPayload({
    email: "user@codebar.io",
    url: "https://auth.codebar.io/api/auth/magic-link/verify?token=abc",
    fromEmail: "auth-noreply@codebar.io",
    subject: "Sign in to codebar",
  });

  t.equal(payload.tracking_settings.click_tracking.enable, false);
  t.equal(payload.tracking_settings.open_tracking.enable, false);
});

test("buildMagicLinkPayload embeds the real URL in the plain-text body", async (t) => {
  const url = "https://auth.codebar.io/api/auth/magic-link/verify?token=xyz";
  const payload = buildMagicLinkPayload({
    email: "user@codebar.io",
    url,
    fromEmail: "auth-noreply@codebar.io",
    subject: "Sign in to codebar",
  });

  t.equal(payload.personalizations[0].to[0].email, "user@codebar.io");
  t.equal(payload.from.email, "auth-noreply@codebar.io");
  t.equal(payload.subject, "Sign in to codebar");
  t.equal(payload.content[0].type, "text/plain");
  t.ok(payload.content[0].value.includes(url));
});
