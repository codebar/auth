# Heroku Deployment

Deploy this application to Heroku using `app.json` for infrastructure-as-code.

## Prerequisites

- Heroku CLI installed and authenticated (`heroku login`)
- GitHub OAuth app created at https://github.com/settings/developers
- Admin access to the codebar/auth GitHub repository

## Infrastructure Overview

| Component    | Configuration                     |
| ------------ | --------------------------------- |
| **Dyno**     | Basic (always-on)                 |
| **Database** | Heroku Postgres Essential-0 (1GB) |
| **Stack**    | heroku-24                         |
| **Node.js**  | >= 24.0.0                         |

## Deployment Method

**Automatic deployments** from GitHub merges are the standard workflow. Heroku deploys the application automatically when code merges to the `main` branch.

## Initial Setup

### 1. Create Heroku App

```bash
# Create app from app.json (provisions dyno, database, and env vars)
heroku create codebar-auth-production --manifest

# Set GitHub OAuth credentials
heroku config:set GITHUB_CLIENT_ID=your_client_id
heroku config:set GITHUB_CLIENT_SECRET=your_client_secret
```

### 2. Connect GitHub Repository

1. Open the Heroku Dashboard: `heroku open`
2. Navigate to the **Deploy** tab
3. In **Deployment method**, select **GitHub**
4. Search for and connect to the `codebar/auth` repository
5. In **Automatic deploys**, select the `main` branch
6. Click **Enable Automatic Deploys**

### 3. First Deploy

The `main` branch is protected from direct pushes. Merge this infrastructure PR to trigger the first deployment.

Heroku deploys automatically when the PR merges to `main`. The release phase runs database migrations before dynos start.

## GitHub OAuth Configuration

After deploying, update your GitHub OAuth app settings:

- **Homepage URL:** `https://auth.codebar.io`
- **Authorization callback URL:** `https://auth.codebar.io/api/auth/callback/github`

## Automatic Deployments

Once enabled, every merge to `main` triggers:

1. Heroku pulls the latest code
2. Build phase installs dependencies
3. Release phase runs database migrations
4. New dynos start serving traffic

No manual intervention required.

## Manual Deployment (Emergency Only)

Use manual deployment only when automatic deploys fail or during incidents requiring immediate hotfixes.

```bash
# Break-the-glass: bypass automatic deploys
git push heroku main --force
```

**Warning:** Manual deployment bypasses GitHub branch protection and CI checks. Use sparingly.

## Rollback

```bash
# Rollback to previous release
heroku releases:rollback

# Rollback to specific version
heroku releases:rollback v42
```

## Monitoring

```bash
heroku logs --tail          # View app logs
heroku ps                   # Check dyno status
heroku releases             # View deployment history
```

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

- `app.json` - App manifest
- `Procfile` - Process definitions
- `scripts/heroku-release.sh` - Release tasks
