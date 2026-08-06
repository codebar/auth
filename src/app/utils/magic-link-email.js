// Build the SendGrid v3 mail/send request body for a magic-link email.
// Tracked separately so the request shape can be unit-tested without a
// SendGrid API call or the auth instance's DB pool.
export const buildMagicLinkPayload = ({ email, url, fromEmail, subject }) => ({
  personalizations: [{ to: [{ email }] }],
  from: { email: fromEmail },
  subject,
  content: [
    {
      type: "text/plain",
      value: `Click the link below to sign in to codebar:\n\n${url}\n\nThis link expires in 5 minutes.`,
    },
  ],
});
