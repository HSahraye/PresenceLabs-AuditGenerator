# Presence Labs Audit Generator

Lead intake + audit generation platform for Presence Labs. This app supports internal sales workflows,
public audit sharing via signed links, async import jobs, and public lead ingestion for
`presencelabs.net` integration.

## Setup

```bash
cp .env.example .env
npm install
npm run db:push
npm run dev
```

## Environment

Review `.env.example` and configure:

- `DATABASE_URL` for local or hosted DB.
- `APP_AUTH_ENABLED`, role passwords, and `SESSION_SECRET`.
- `AUDIT_LINK_SECRET` for signed public audit URLs.
- `PUBLIC_INGEST_API_KEY` + `PUBLIC_INGEST_API_SECRET` for presencelabs.net lead ingestion.
- Stripe values for webhook processing (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`).

If model API keys are empty, the app uses deterministic local fallback generation.

## Commands

- `npm run dev` — local app
- `npm run build` — production build validation
- `npm run lint` — lint validation
- `npm run test` — run automated tests
- `npm run db:push` — create/update local SQLite DB
- `npm run db:migrate:deploy` — run production migrations
- `npm run db:generate` — regenerate Prisma client
- `npm run db:studio` — inspect leads

## Deploy (Netlify)

1. Connect this repo to Netlify.
2. Ensure `netlify.toml` is detected.
3. Set required environment variables in Netlify dashboard.
4. Run database migration in CI/CD using `npm run db:migrate:deploy`.
5. Deploy to `app.presencelabs.net`.

## Public Integration (presencelabs.net)

- Public lead ingest endpoint: `POST /api/public/leads`
- Public status endpoint: `GET /api/public/audits/:jobId/status`
- Requests must include:
  - `x-presencelabs-key`
  - `x-presencelabs-ts`
  - `x-presencelabs-signature` (HMAC SHA-256 over `${timestamp}.${rawBody}`)

## Security Notes

- Internal routes are session-protected when `APP_AUTH_ENABLED=true`.
- Public audit pages require signed tokens when auth is enabled.
- Website fetch logic blocks internal/private network targets.
- Public endpoints are rate-limited.

## Operations

- Monitor import jobs in the dashboard (retry/cancel supported).
- Stripe webhook endpoint: `POST /api/stripe/webhook` with idempotency protections.
- Critical actions and domain events are stored in DB (`AuditLog`, `EventLog`, `WebhookEvent`).
