// Version stamp for cache-busting static assets.
// HEROKU_RELEASE_VERSION is set by Heroku when runtime-dyno-metadata is enabled.
// Falls back to 'dev' for local development.
export const STATIC_VERSION = process.env.HEROKU_RELEASE_VERSION || "dev";
