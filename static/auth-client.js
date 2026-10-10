// TODO: we need a bundler, so we can re-use what we have in node_modules already
// Pinned to the server's better-auth version: the browser client must match
// what the server runs. Update this pin whenever package-lock.json bumps
// better-auth. No bundler yet — see TODO above.
import { createAuthClient } from "https://esm.sh/better-auth@1.7.6/client";

export const authClient = createAuthClient({
  baseURL: window.location.origin,
  plugins: [],
});

export const { signIn, signUp } = authClient;

const handleGitHubSignIn = async (event) => {
  event.preventDefault();
  const button = event.target;
  const redirectUrl = button.dataset.redirectUrl || "/profile";

  try {
    await authClient.signIn.social({
      provider: "github",
      callbackURL: redirectUrl,
    });
  } catch (error) {
    console.error("GitHub sign in failed:", error);
    window.location.href =
      "/login?error=" +
      encodeURIComponent("GitHub sign in failed: " + error.message);
  }
};

// Attach event listeners when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.handleGitHubSignIn = handleGitHubSignIn;
});
