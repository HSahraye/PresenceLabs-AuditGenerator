# Operations Runbook

## Deploy

1. Ensure environment variables are configured.
2. Run migrations: `npm run db:migrate:deploy`
3. Build verification: `npm run lint && npm run build && npm run test`
4. Deploy via Netlify.

## Rollback

1. Revert to previous successful Netlify deploy.
2. If schema changed, deploy compatible app revision before rolling DB backward.
3. Confirm `/`, `/api/public/leads`, and `/api/stripe/webhook` health checks.

## Incident Response

### Import jobs stuck

- Check `ImportJob` rows in DB.
- Retry failed jobs from dashboard (or `POST /api/import-jobs/:id` with `{ "action":"retry" }`).
- Cancel problematic jobs with `{ "action":"cancel" }`.

### Payment webhook failures

- Verify Stripe signature secret.
- Confirm `WebhookEvent` unique idempotency records are being written.
- Re-deliver event from Stripe dashboard.

### Auth lockout

- Disable auth temporarily with `APP_AUTH_ENABLED=false` only in emergency.
- Restore secure passwords and re-enable auth immediately after fix.

## Backups

- Use managed Postgres automated backups in production.
- Test restore quarterly.
- Export lead data snapshot weekly (CSV + DB backup).
