# Development

## Prerequisites

1. Install [Apple Container](https://github.com/apple/container)
2. Start the container service:

   ```sh
   container system start
   ```

## Running the app

The app automatically starts the Postgres container if needed:

```sh
npm run dev
```

Or manually manage the container:

```sh
npm run test:pg:start   # Start Postgres container
npm run test:pg:stop    # Stop Postgres container
npm run test:pg:status  # Check container status
```

## Environment

Copy `.envrc-dist` to `.envrc` and add your GitHub OAuth credentials:

```sh
cp .envrc-dist .envrc
# Edit .envrc to add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET
# then: source .envrc  (or use direnv/mise to load it)
```

The default `DATABASE_URL` points to the local Postgres container.

## Database

Run migrations after pulling new changes:

```sh
npm run db:migrate
```

## Testing

Tests automatically start the Postgres container if it's not running:

```sh
npm test
```
