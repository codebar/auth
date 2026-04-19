import config from "../../config.js";

const matchesGlob = (url, pattern) => {
  if (!pattern.includes("*")) return false;
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  const regex = new RegExp(`^${escaped}$`);
  return regex.test(url);
};

const isValidRedirectUrl = (redirectUrl) => {
  if (!redirectUrl || typeof redirectUrl !== "string") {
    return false;
  }

  const trimmed = redirectUrl.trim();
  if (!trimmed) {
    return false;
  }

  return config.allowed_redirects.some(
    (pattern) => trimmed === pattern || matchesGlob(trimmed, pattern),
  );
};

/**
 * Validates a redirect URL against the allowlist and returns a safe redirect URL
 * @param {string} redirectUrl - The URL to validate
 * @param {string} fallback - Fallback URL if validation fails (default: '/profile')
 * @returns {string} - Safe redirect URL
 */
export const validateRedirectUrl = (redirectUrl, fallback = "/profile") => {
  return isValidRedirectUrl(redirectUrl) ? redirectUrl.trim() : fallback;
};
