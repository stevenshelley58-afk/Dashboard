# Dashboard Monorepo

Phase 0 monorepo containing the Vercel-hosted web app, Railway worker, and Supabase schema for the agency dashboard MVP.

## Repository layout

- `apps/web` – Next.js App Router UI + public API deployed to Vercel.
- `apps/worker` – Long-lived Node worker deployed to Railway.
- `db` – Plain SQL migrations & docs.
- `spec` – Product + technical specification used to scope this build.

## Prerequisites

- Node.js >= 18.18 (matches Next.js 16 and `tsx` requirements).
- Access to Supabase project with Supavisor enabled.
- Vercel project targeting `apps/web`.
- Railway service targeting `apps/worker`.

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables**

   | Location | Purpose |
   | --- | --- |
| `apps/web/.env.local` | Supabase **transaction** DSN (port `6543`, no `service_role`), `SHOPIFY_APP_URL`, `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `JWT_SECRET`, optional `LOCAL_DEV_ACCOUNT_ID`. |
| `apps/worker/.env` | Supabase **session** DSN (port `5432` with `service_role`), Shopify + Meta API credentials, `JOB_POLL_INTERVAL_MS`, etc. |

Additional knobs for Meta jobs:

- `META_JOBS_ENABLED` (default `true`) – gate manual sync + scheduler endpoints until the worker version that supports Meta is deployed.
- `META_API_VERSION`, `META_API_BASE_URL` – override the Marketing API host/version if Meta rolls forward.
- `META_STUB_MODE=1` – bypass live Marketing API calls and emit deterministic fixture data (useful for local dev without credentials).
- `META_FRESH_SCHED_MINUTES` – minimum spacing between auto-enqueued `meta_fresh` runs (defaults to 60 minutes).
- `META_CRON_SECRET`/`CRON_SECRET` – shared secret that the `/api/scheduler/meta` endpoint expects via `X-Cron-Secret` or `Authorization: Bearer …`.

   Use Vercel’s `vercel env pull` for local `.env.local`, and Railway shared/service variables for worker secrets so nothing sensitive lives in git.

3. **Apply database migrations**

   ```bash
   npm run db:migrate
   ```

   This executes every SQL file in `db/migrations` (connectivity check + core schema + seed account). See `db/README.md` for manual `psql` equivalents.

4. **Run apps**

   ```bash
   npm run dev:web      # Next.js + API
   npm run dev:worker   # Railway worker loop
   ```

## Platform guidance

- **Supabase** – Use the Supavisor transaction DSN (port `6543`) from Supabase for any serverless/Vercel workloads, and the session DSN (port `5432`) with `service_role` exclusively inside the worker, migrations, or local scripts.
- **Vercel** – Keep secrets in project-level Environment Variables. Pull them locally with `vercel env pull` so the `apps/web/.env.local` file always mirrors Production/Preview. Remember that Edge runtimes have stricter 5 KB env limits—stick to the default Node runtime for API routes that need DB pools.
- **Railway** – Store `DATABASE_URL` and API credentials as service variables. Use shared variables when the same secret (e.g., Shopify API key) is needed by multiple services. Railway automatically exposes metadata such as `RAILWAY_REPLICA_ID` if you need per-replica logging.
- **Shopify** – OAuth requests return offline access tokens; we persist them in `integration_secrets` and reuse them for background jobs. Webhooks hit `/api/webhooks/shopify/[topic]`, which verifies HMAC, stores the raw payload, and keeps the handler under the 4 s SLA. Reconciliation/manual sync jobs are exposed via `/api/settings/manual-sync`.
- **Meta** – When Meta jobs are enabled, follow the Marketing API rate-limit headers (`X-Ad-Account-Usage`, `X-FB-Ads-Insights-Throttle`) and apply exponential backoff on 429/613 errors. The worker already centralizes throttling helpers for Shopify and can be extended for Meta.

## Data model snapshot

- **Tenancy** – `accounts`, `users`, `shops`, `ad_accounts`, `integrations`, `integration_secrets`.
- **Ops** – `sync_runs`, `sync_cursors`, `shopify_webhooks_raw`.
- **Raw layers** – `shopify_orders_raw`, `shopify_products_raw`, `shopify_customers_raw`, `meta_insights_raw`, `meta_creatives_raw`.
- **Facts** – `fact_orders`, `fact_meta_daily`.
- **Aggregates** – `daily_shopify_metrics`, `daily_meta_metrics`, `daily_summary`, `latest_kpis`.

See `spec/PHASE0_04_SCHEMA_DATA_LAYERS.md` for the rationale behind every table.

## Commands

| Command | Description |
| --- | --- |
| `npm run dev:web` | Run the Next.js app locally. |
| `npm run dev:worker` | Start the worker with polling + job dispatcher. |
| `npm run db:migrate` | Apply all SQL migrations via the worker migration helper. |
| `npm run build:web` / `npm run build:worker` | Type-check + compile per workspace. |
| `npm run check:meta --workspace worker -- <integration_id>` | Inspect `fact_meta_daily` + `daily_meta_metrics` for a Meta integration. |

## Meta job scheduler & manual triggers

- `POST /api/settings/manual-sync` still enqueues Shopify jobs, and now responds with a `message` field (`"Meta sync enqueued"` or `"Sync enqueued"`) so the UI can show immediate feedback. When `META_JOBS_ENABLED` is `false`, Meta job requests will return `400` with a descriptive error.
- `POST /api/scheduler/meta` is a lightweight cron target (compatible with Vercel Cron, GitHub Actions, etc.). Provide the optional `X-Cron-Secret` or `Authorization: Bearer <secret>` header, and it will insert `meta_fresh` runs for every connected Meta integration that hasn’t been updated within the configured interval.
- The helper `enqueueMetaInitialFill` (`apps/web/src/lib/sync-runs.ts`) exists so the upcoming Meta connect flow can immediately drop a `meta_7d_fill` run once OAuth completes.

## Auth & account context

The API expects a JWT (or dev override) that includes `account_id`. During local development you can set `LOCAL_DEV_ACCOUNT_ID=079ed5c0-4dfd-4feb-aa91-0c4017a7be2f` to target the seeded “Internal Agency” account without a login flow.

## Troubleshooting

- **DB connection errors** – Verify the correct DSN is in each `.env` and that Supavisor is enabled. The `/api/health-lite` route and worker startup log run `SELECT now()` so any failure will show up immediately.
- **Shopify install issues** – Check `install-error.json` (ignored by git) for details. The callback route logs any exception and writes the payload for inspection.
- **Manual sync stuck** – Inspect `sync_runs` for the latest row per integration and review worker logs. The worker logs cursor movements and API call counts per job run.

For deeper product scope, open the staged tasks under `spec/tasks/`.

