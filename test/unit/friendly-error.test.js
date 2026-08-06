import { test } from "tap";
import { friendlyError } from "../../src/app/utils/friendly-error.js";

test("friendlyError maps known Better Auth codes", async (t) => {
  t.match(
    friendlyError("INVALID_TOKEN"),
    /expired or already been used/,
    "INVALID_TOKEN gets friendly text",
  );
  t.equal(
    friendlyError("new_user_signup_disabled"),
    "New sign-ups are currently disabled. Please contact support.",
  );
  t.equal(
    friendlyError("failed_to_create_session"),
    "We couldn't start a session. Please try again.",
  );
});

test("friendlyError passes through unknown codes", async (t) => {
  t.equal(friendlyError("SOME_OTHER_CODE"), "SOME_OTHER_CODE");
  t.equal(friendlyError(""), "");
});
