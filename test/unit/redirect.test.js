import { test } from "tap";
import { validateRedirectUrl } from "../../src/app/utils/redirect.js";
import config from "../../src/config.js";

const original = config.allowed_redirects;

test("redirect validation - exact match", async (t) => {
  config.allowed_redirects = ["http://localhost:3000/demo"];

  t.after(() => {
    config.allowed_redirects = original;
  });

  t.equal(
    validateRedirectUrl("http://localhost:3000/demo"),
    "http://localhost:3000/demo",
  );
  t.equal(validateRedirectUrl("http://evil.com/steal"), "/profile");
  t.equal(validateRedirectUrl(""), "/profile");
  t.equal(validateRedirectUrl(null), "/profile");
  t.equal(validateRedirectUrl("   "), "/profile");
});

test("allows subdomain wildcard", async (t) => {
  config.allowed_redirects = ["https://*.codebar.io"];

  t.after(() => {
    config.allowed_redirects = original;
  });

  t.equal(
    validateRedirectUrl("https://auth.codebar.io"),
    "https://auth.codebar.io",
  );
  t.equal(
    validateRedirectUrl("https://staging.codebar.io"),
    "https://staging.codebar.io",
  );
  t.equal(
    validateRedirectUrl("https://app.codebar.io"),
    "https://app.codebar.io",
  );
});

test("rejects non-matching domain with wildcard", async (t) => {
  config.allowed_redirects = ["https://*.codebar.io"];

  t.after(() => {
    config.allowed_redirects = original;
  });

  t.equal(validateRedirectUrl("https://codebar.io"), "/profile");
  t.equal(validateRedirectUrl("https://evil.com"), "/profile");
});

test("allows path wildcard", async (t) => {
  config.allowed_redirects = ["https://codebar.io/*"];

  t.after(() => {
    config.allowed_redirects = original;
  });

  t.equal(
    validateRedirectUrl("https://codebar.io/profile"),
    "https://codebar.io/profile",
  );
  t.equal(
    validateRedirectUrl("https://codebar.io/anything/here"),
    "https://codebar.io/anything/here",
  );
});

test("allows multiple wildcards", async (t) => {
  config.allowed_redirects = ["https://*.example.com/*"];

  t.after(() => {
    config.allowed_redirects = original;
  });

  t.equal(
    validateRedirectUrl("https://auth.example.com/page"),
    "https://auth.example.com/page",
  );
  t.equal(
    validateRedirectUrl("https://api.example.com/v1/users"),
    "https://api.example.com/v1/users",
  );
});

test("exact match takes precedence over wildcard", async (t) => {
  config.allowed_redirects = [
    "http://localhost:3000/demo",
    "http://localhost:3000/*",
  ];

  t.after(() => {
    config.allowed_redirects = original;
  });

  t.equal(
    validateRedirectUrl("http://localhost:3000/demo"),
    "http://localhost:3000/demo",
  );
});
