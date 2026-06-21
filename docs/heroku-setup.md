# Heroku Setup

One-time setup for deploying codebar-auth to Heroku.

## Prerequisites

- Heroku CLI installed and authenticated (`heroku login`)
- GitHub OAuth app created at https://github.com/settings/developers
- Admin access to the codebar/auth GitHub repository

## Create the Heroku App

```bash
# Create app in EU region
heroku create codebar-auth-production --region eu

# app.json is NOT read by `heroku create`, so provision everything manually:
heroku stack:set heroku-26 -a codebar-auth-production
heroku addons:create heroku-postgresql:essential-0 --as DATABASE -a codebar-auth-production

# Set required GitHub OAuth credentials
heroku config:set GITHUB_CLIENT_ID=your_client_id -a codebar-auth-production
heroku config:set GITHUB_CLIENT_SECRET=your_client_secret -a codebar-auth-production

# Scale dyno (run after first deploy — requires Procfile to be registered)
heroku ps:scale web=1:basic -a codebar-auth-production
```

## Connect GitHub Repository

1. Open the Heroku Dashboard: `heroku open`
2. Navigate to the **Deploy** tab
3. In **Deployment method**, select **GitHub**
4. Search for and connect to the `codebar/auth` repository
5. In **Automatic deploys**, select the `main` branch
6. Click **Enable Automatic Deploys**

## First Deploy

The `main` branch is protected from direct pushes. Merge the infrastructure PR to trigger the first deployment.

Heroku deploys automatically when code merges to `main`. The release phase runs database migrations before dynos start.

## GitHub OAuth Configuration

After deploying, update your GitHub OAuth app settings:

- **Homepage URL:** `https://auth.codebar.io`
- **Authorization callback URL:** `https://auth.codebar.io/api/auth/callback/github`

## Infrastructure

| Component    | Configuration                     |
| ------------ | --------------------------------- |
| **Dyno**     | Basic (always-on)                 |
| **Database** | Heroku Postgres Essential-0 (1GB) |
| **Stack**    | heroku-26                         |
| **Node.js**  | >= 24.0.0                         |

## Environment Variables

| Variable               | Source           | Description                  |
| ---------------------- | ---------------- | ---------------------------- |
| `DATABASE_URL`         | Auto-provisioned | PostgreSQL connection string |
| `GITHUB_CLIENT_ID`     | Required         | GitHub OAuth client ID       |
| `GITHUB_CLIENT_SECRET` | Required         | GitHub OAuth client secret   |
| `BETTER_AUTH_SECRET`   | Auto-generated   | Session encryption key       |
| `CODEBAR_AUTH_URL`     | Auto-set         | Application base URL         |
| `PORT`                 | Heroku           | Dyno port                    |

## Files

- `app.json` — App manifest
- `Procfile` — Process definitions
- `scripts/heroku-release.sh` — Release tasks
