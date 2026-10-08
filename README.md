# auth-auth

Small authentication/profile system for Codebar.

## Local Setup

For login or registration via GitHub to work, you have create an [oauth2 application](https://github.com/settings/developers). Fetch client id and secret and setup the `.envrc` from included example (in `.envrc-dist`).

Then export `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` into the environment. We recommend using [direnv](https://direnv.net/).

---

For a new run the following:

```sh
npm ci
npm run db:generate
npm run db:migrate
npm run dev
```

To update your local copy:

```sh
npm ci
npm run db:migrate
npm run dev
```

### Intel Mac setup

Apple Container requires Apple silicon, so on an Intel Mac use native PostgreSQL instead:

```sh
brew install postgresql
brew services start postgresql
"$(brew --prefix postgresql)/bin/psql" postgres -c "CREATE ROLE auth WITH LOGIN PASSWORD 'auth';"
"$(brew --prefix postgresql)/bin/psql" postgres -c "CREATE DATABASE test OWNER auth;"
```

These credentials are for local development only; keep PostgreSQL bound to localhost and never reuse them for shared or production databases.

---

View the application:

```sh
open http://localhost:3000
```

### Context

- data is saved in a sqlite database
- the app currently supports username/password, magic-link and GitHub OAuth
- for magic-link, **inspect the log to fetch the URL**

## What's happening here?

Once the application is running, you can try out the the following flows:

- sign-up
- sign-in (username/password, GitHub OAuth, magic-link)

In addition `/admin` hosts a very basic admin ui (list user, update roles).

## Demo

There's an additional application (mounted in this setup), that would demonstrate how to determine if a user is logged in.

```sh
open http://localhost:3000/demo
```
