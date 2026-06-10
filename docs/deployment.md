# Deployment

How to deploy codebar-auth to Heroku.

## Automatic Deployments

The standard workflow. Every merge to `main` triggers:

1. Heroku pulls the latest code
2. Build phase installs dependencies
3. Release phase runs database migrations
4. New dynos start serving traffic

No manual intervention required.

## Manual Deployment (Emergency Only)

Use only when automatic deploys fail or during incidents requiring immediate hotfixes.

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
