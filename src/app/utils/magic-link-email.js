// Escape a URL for safe embedding in an HTML attribute.
const escapeHtml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

// Build the SendGrid v3 mail/send request body for a magic-link email.
// Tracked separately so the request shape can be unit-tested without a
// SendGrid API call or the auth instance's DB pool.
export const buildMagicLinkPayload = ({ email, url, fromEmail, subject }) => ({
  personalizations: [{ to: [{ email }] }],
  from: { email: fromEmail },
  subject,
  tracking_settings: {
    // Magic-link URL must read as the real codebar.io link,
    // not a Sendgrid /LsClick tracking redirect.
    click_tracking: { enable: false },
    open_tracking: { enable: false },
  },
  content: [
    {
      type: "text/plain",
      value: `Click the link below to sign in to codebar:\n\n${url}\n\nThis link expires in 5 minutes.`,
    },
    {
      type: "text/html",
      value: `<p>Click the button below to sign in to codebar.</p><p><a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 18px;background-color:#2e5fa3;color:#ffffff;border-radius:4px;text-decoration:none;">Sign in to codebar</a></p><p>This link expires in 5 minutes.</p>`,
    },
  ],
});
