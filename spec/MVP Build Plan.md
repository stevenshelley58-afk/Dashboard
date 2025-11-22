## MVP Build Plan

Below is a staged build plan for Phase 0 that you can hand to humans or agents.  
Each stage ends with a concrete, testable outcome.

---

## Stage 1 – Repo, Envs, Infra Wiring

**Goal**  
Single monorepo with Vercel app + Railway worker + Supabase wired correctly.

### 1. Monorepo + App Scaffolding

- **Create repo structure**
  - **Folders**
    - `apps/web` – Next.js (or SvelteKit if you change later, but pick one now).
    - `apps/worker` – Node worker (no frameworks, just a job runner).
    - `db` – SQL migrations for all Phase 0 tables.
  - **Root config**
    - Add a root `package.json` with workspaces (or equivalent for your package manager).
    - Add `turbo.json` (or similar) if you plan to use Turborepo.
    - Add `.gitignore`, `README.md`, and a minimal `LICENSE` if needed.

- **Web app (`apps/web`)**
  - Initialize a Next.js app in `apps/web` (with `app` router).
  - Ensure you have:
    - `apps/web/package.json`
    - `apps/web/next.config.js` (or `next.config.mjs`)
    - `apps/web/app/page.tsx` (or `pages/index.tsx` if using pages router)
  - Add a placeholder API route for health:
    - `apps/web/app/api/health-lite/route.ts` (or `pages/api/health-lite.ts`)

- **Worker (`apps/worker`)**
  - Initialize a plain Node project in `apps/worker` with:
    - `apps/worker/package.json`
    - `apps/worker/src/index.ts` (or `.js`)
  - Plan a simple startup script that:
    - Connects to the database on boot.
    - Logs “DB connection ok” when `select now()` succeeds.

- **DB migrations (`/db`)**
  - Choose a migration tool (e.g. Drizzle, Knex, dbmate, Supabase migrations).
  - Create:
    - `db/migrations` directory.
    - A baseline empty migration or initial schema file (to be filled in Stage 2).
  - Add a `db/README.md` explaining how to run `db:migrate`.

### 2. Supabase Setup

- **Create Supabase project**
  - In the Supabase dashboard, create a new project for this app.
  - Note:
    - Project URL
    - Anon key
    - Service role key
    - Database connection details.

- **Configure Supavisor**
  - Enable connection pooling (Supavisor) for the project.
  - Generate:
    - **Transaction DSN** (port `6543`) – for Vercel web app.
    - **Session/direct DSN** (port `5432`) – for worker with `service_role`.

- **Secure secret storage**
  - Decide where secrets will live locally:
    - `apps/web/.env.local`
    - `apps/worker/.env`
  - Decide production secret management:
    - Vercel environment variables (for web).
    - Railway environment variables (for worker).
  - **Rule**: Do **not** put `service_role` key in the web app’s env; only use:
    - Anon key (or JWT validation strategy) in web.
    - Service role only in worker and migrations.

### 3. Vercel Setup (Web App)

- **Create Vercel project**
  - In Vercel, create a project and point it at the repo, with root set to `apps/web`.
  - Configure build + output:
    - Build command: root-level or `cd apps/web && npm run build` depending on setup.
    - Output directory: `.next` (default).

- **Set environment variables for web**
  - In Vercel Project Settings → Environment Variables:
    - `DATABASE_URL` = **transaction DSN (6543)** from Supavisor (no service role).
    - Non-sensitive app envs, e.g.:
      - `SHOPIFY_APP_URL`
      - `SHOPIFY_API_KEY`
      - Any other public-ish config values needed later (you can stub these now).
  - Locally, mirror these in `apps/web/.env.local`:
    - Use a safe, non-service-role connection string for `DATABASE_URL`.

- **Health API connectivity check**
  - In `apps/web`, wire up the `GET /api/health-lite` handler (no business logic yet):
    - On request, acquire a DB client using `DATABASE_URL`.
    - Run `select now()` and return `{ db: 'ok' }` if successful; otherwise return an error status.
  - Deploy to Vercel and verify:
    - The `/api/health-lite` route responds with `{ db: 'ok' }`.

### 4. Railway Setup (Worker)

- **Create Railway service**
  - In Railway, create a new service that:
    - Builds and runs from `apps/worker`.
    - Uses your monorepo’s root but sets the working directory to `apps/worker` (via Railway config).

- **Set environment variables for worker**
  - In Railway service settings:
    - `DATABASE_URL` = **session/direct DSN (5432)** with `service_role`.
  - Locally, mirror in `apps/worker/.env` with the same `DATABASE_URL`.

- **Worker startup DB check**
  - In `apps/worker/src/index.ts`:
    - On process start:
      - Connect to the DB using `DATABASE_URL`.
      - Run `select now()`.
      - Log `"DB connection ok"` on success; log error and exit on failure.
  - Connect Railway logs and verify:
    - On each deployment/startup, the worker logs:
      - `"DB connection ok"` if DB is reachable.

### 5. Stage 1 “Done” Checklist

- **Web**
  - `GET /api/health-lite` in the Vercel deployment:
    - Returns `{ db: 'ok' }` as the body.
    - Internally uses `select now()` against `DATABASE_URL` (transaction DSN, no service role).

- **Worker**
  - On Railway startup:
    - Worker uses `DATABASE_URL` (session/direct DSN, `service_role`) to connect.
    - Logs `"DB connection ok"` once `select now()` succeeds.

- **Scope**
  - No business logic, no auth, no jobs:
    - Only connectivity, environment wiring, and basic monorepo structure are in place.

---

## Stage 2 – Schema Migration (Phase 0 Tables Only)

**Goal**  
All Phase 0 tables exist in Postgres with correct FKs and indexes. No jobs, no UI.

### Tasks

- **Migration tooling**
  - In `db`, set up migration scripts (e.g. `npm run db:migrate` at root).
  - Document commands in `db/README.md`.

- **Implement schema migrations (Phase 0 only)**
  - Tenancy tables:
    - `accounts`, `users`, `shops`, `ad_accounts`.
  - Integrations tables:
    - `integrations`, `integration_secrets`, `sync_runs`, `sync_cursors`.
  - Webhook queue:
    - `shopify_webhooks_raw`.
  - Raw data:
    - `shopify_orders_raw`, `shopify_products_raw`, `shopify_customers_raw`,
      `meta_insights_raw`, `meta_creatives_raw`.
  - Facts:
    - `fact_orders`, `fact_meta_daily`.
  - Aggregates:
    - `daily_shopify_metrics`, `daily_meta_metrics`, `daily_summary`, `latest_kpis`.

- **Indexes**
  - Add time-based indexes:
    - On fields like `order_created_at`, `order_updated_at`, and `date` fields on Meta tables.
  - Add unique indexes as specified:
    - e.g. `(integration_id, shopify_order_id)`,
    - `(integration_id, ad_id, date, level)` and any others from your spec.

- **Seed data**
  - Add a seed migration or script that:
    - Inserts one `accounts` row (internal agency account).
    - Inserts one `users` row linked to that account.
    - Leaves `shops` and `ad_accounts` empty for now.

- **Validation**
  - Run `db:migrate` from local and/or CI.
  - Use psql or Supabase UI to confirm:
    - Each table exists.
    - Indexes and constraints are in place.
    - Seed data rows exist.
  - Ensure:
    - RLS is disabled or not yet configured on these tables for now.

- **Done when**
  - `db:migrate` runs clean in a fresh environment.
  - You can query each table via psql/Supabase UI.
  - No RLS yet, or RLS is temporarily disabled.

---

## Stage 3 – Auth, Accounts, RLS Skeleton

**Goal**  
Users log in, every request is scoped to `account_id`, basic RLS is in place.

### Tasks

- **Auth decision**
  - Choose between:
    - Supabase Auth, or
    - Custom JWT auth layer.
  - Ensure your auth/JWT payload includes an `account_id` claim.

- **Backend context wiring**
  - In `apps/web`:
    - Add a shared helper, e.g. `lib/auth/getCurrentAccountId.ts`:
      - Parse the incoming request’s auth (Supabase session or JWT).
      - Extract and validate `account_id`.
    - Update any DB access layers to require `account_id` be passed explicitly.

- **RLS policies**
  - In Supabase:
    - Enable RLS on all tenant tables that contain `account_id`.
    - Add a standard policy using:
      - `USING (account_id = (auth.jwt() ->> 'account_id')::uuid)`
    - Ensure:
      - Web app connections use JWT/anon key with this policy.
      - Worker continues to connect via `service_role` and uses explicit `WHERE account_id = ...` in queries.

- **Basic UI**
  - In `apps/web`, add a simple authenticated page:
    - Shows `account_id` and basic user info (e.g. “You are logged in as X”).
    - Verifies that the auth and RLS context are properly wired.

- **Done when**
  - With a token/JWT for account A:
    - You cannot see rows that belong to some fake account B.
  - Worker:
    - Can still read/write all rows using `service_role`.
    - Uses explicit `account_id` filters in queries where appropriate.

---

## Stage 4 – Shopify Connect + Webhooks Only

**Goal**  
Shopify app installs, saves tokens, and webhooks land in `shopify_webhooks_raw`.

### Tasks

- **Shopify app OAuth wiring**
  - Configure a Shopify app pointing to your Vercel domain.
  - In `apps/web`:
    - Implement install → redirect → code exchange → offline token flow.
    - On success:
      - Create or upsert a `shops` row.
      - Create an `integrations` row with `type='shopify'` tied to `account_id` and `shop_id`.
      - Store offline token and any secrets in `integration_secrets`.

- **Webhook registration**
  - Upon install or via a background task:
    - Register at least:
      - `orders/create`
      - `orders/updated`
    - Ensure webhooks target Vercel routes.

- **Webhook HTTP handlers (Vercel)**
  - In `apps/web`, create API routes for Shopify webhooks, e.g.:
    - `/api/webhooks/shopify/orders/create`
    - `/api/webhooks/shopify/orders/updated`
  - In each route:
    - Verify HMAC with Shopify shared secret.
    - Insert the raw webhook payload into `shopify_webhooks_raw`.
    - Timebox handler to ~4 seconds max.
    - Respond quickly with 200 or 500.

- **Minimal settings/debug UI**
  - In `apps/web`, create an authenticated settings page:
    - Shows connected Shopify store name (from `shops`/`integrations`).
    - Lists recent rows from `shopify_webhooks_raw` (dev only, behind auth or feature flag).

- **Done when**
  - You can install the app on a dev Shopify store.
  - Creating a test order in Shopify:
    - Produces a new row in `shopify_webhooks_raw`.
  - Errors/logging are visible for debugging failures.

---

## Stage 5 – Shopify 7d Fill + Fresh Jobs (No UI)

**Goal**  
Shopify orders ingested into raw + facts + aggregates.

### Tasks

- **Worker job runner**
  - In `apps/worker`:
    - Implement a simple job loop:
      - Poll `sync_runs` for `status='queued'`, or
      - Trigger job functions on a schedule (cron-like).
    - Standardize job logging into `sync_runs`.

- **`shopify_7d_fill` job**
  - Implement a job that:
    - Uses Shopify GraphQL API to fetch orders for last 7 days.
    - Upserts into:
      - `shopify_orders_raw`
      - `fact_orders`
    - Builds aggregates for those 7 days:
      - `daily_shopify_metrics`
      - `daily_summary`
    - Writes `sync_cursors`:
      - Only if `last_synced_order_updated_at` is empty.
    - Logs to `sync_runs` with success/error state and timestamps.

- **`shopify_fresh` job**
  - Implement a job that:
    - Reads `last_synced_order_updated_at` from `sync_cursors`.
    - Queries Shopify orders where `updated_at >= cursor` sorted by `UPDATED_AT`.
    - Upserts raw + facts (same tables as above).
    - Rebuilds aggregates for touched dates.
    - Advances cursor.
    - Logs outcome in `sync_runs`.

- **Manual sync API**
  - In `apps/web`:
    - Implement `POST /api/settings/manual-sync` endpoint.
    - On call:
      - Enqueue `shopify_7d_fill` and `shopify_fresh` in `sync_runs` (or a jobs table/queue structure).
    - Ensure endpoint is scoped to current `account_id`.

- **Done when**
  - For a dev Shopify store:
    - You can connect the store.
    - Hit “Sync last 7 days”.
    - See orders in:
      - `shopify_orders_raw`
      - `fact_orders`
      - `daily_shopify_metrics`
      - `daily_summary`
    - Fresh orders are reflected after `shopify_fresh` runs.

---

## Stage 6 – Shopify UI (One Store, Single Account)

**Goal**  
Basic Shopify dashboard for your internal account.

### Tasks

- **`/api/dashboard/shopify`**
  - In `apps/web`:
    - Implement an API route that:
      - Accepts date range parameters (e.g. `from`, `to`).
      - Reads from:
        - `daily_shopify_metrics`
        - `fact_orders`
      - Enforces `account_id` from auth context.
      - Returns only derived metrics; no raw table reads.

- **Shopify dashboard page**
  - Create a page, e.g. `/dashboard/shopify`:
    - Date picker:
      - Today, yesterday, last 7, last 30.
    - KPI cards:
      - Orders
      - `revenue_net`
      - Refunds
      - AOV
    - Time series chart:
      - Revenue vs orders.
    - Optional table:
      - Recent orders (date, number, revenue, status).

- **Error and empty states**
  - Show:
    - “We are still syncing your Shopify data” if no data for selected range.
    - Clear messaging on backend/API errors.

- **Done when**
  - For your test store:
    - Shopify metrics for selected ranges appear and look correct.
    - Numbers reconcile approximately with Shopify admin over a few test days.

---

## Stage 7 – Meta Connect + 7d Fill + Fresh

**Goal**  
Meta ad data ingested and surfaced similarly to Shopify.

### Tasks

- **Meta connect flow**
  - Implement OAuth (or a secure token input flow) for Meta Marketing API.
  - On success:
    - Store access token + ad account ID in `integration_secrets`.
    - Create `ad_accounts` record linked to `account_id`.
    - Create an `integrations` row with `type='meta'`.
    - Check Meta account currency against `accounts.currency` and enforce match.

- **`meta_7d_fill` job**
  - In `apps/worker`:
    - For each of last 7 days:
      - Query Meta insights with `level=ad`.
      - Apply `filtering` on `ad.effective_status IN ('ACTIVE','PAUSED')`.
      - Request minimal required fields (e.g. spend, purchases, purchase_value).
    - Upsert into:
      - `meta_insights_raw`.
    - Build:
      - `fact_meta_daily`
      - `daily_meta_metrics`
      - Update `daily_summary`.
    - Optionally set attribution window cursor.

- **`meta_fresh` job**
  - Implement job that:
    - Defines window:
      - `[today - attribution_window_days + 1 … yesterday]`.
    - Re-fetches insights for this window.
    - Upserts raw data and rebuilds:
      - `fact_meta_daily`
      - `daily_meta_metrics`
      - `daily_summary` for those dates.
    - Adds basic rate limiting handling:
      - Handle 429s with exponential backoff and retry.

- **`/api/dashboard/meta`**
  - Create API route to:
    - Accept date range.
    - Read from `daily_meta_metrics`.
    - Enforce `account_id`.

- **Meta UI page**
  - Add `/dashboard/meta` page:
    - Date picker.
    - KPI cards:
      - Spend
      - Purchases
      - Purchase value
      - ROAS
    - Time series:
      - Spend vs purchase_value with ROAS line.

- **Done when**
  - For a connected Meta ad account:
    - You see Meta metrics for last 7 days.
    - Spend and purchase value roughly match Ads Manager (attribution differences aside).

---

## Stage 8 – Home Dashboard + Sync Status

**Goal**  
Top-level view combining Shopify + Meta + sync health.

### Tasks

- **`/api/dashboard/home`**
  - Implement an API route that:
    - Accepts a date range.
    - Returns:
      - `latest_kpis` for that period.
      - Time-series from `daily_summary`.
    - Enforces `account_id`.

- **Home UI**
  - Create `/dashboard/home` page:
    - KPIs:
      - `revenue_net`
      - `meta_spend`
      - MER
      - ROAS
      - AOV
    - Time series:
      - Revenue vs spend with MER line.

- **`/api/settings/sync-status`**
  - Implement an API route that:
    - Uses `integrations`, `sync_runs`, and fact tables to derive per-integration:
      - `type`
      - `status`
      - `last_successful_sync`
      - `last_attempted_sync`
      - `data_fresh_to` (max date in Shopify and Meta facts).
    - Enforces `account_id`.

- **Settings UI (sync status)**
  - On settings page:
    - For each integration:
      - Show connection status.
      - “Data up to date as of [date]”.
      - Last sync attempt info.
      - Buttons:
        - “Sync last 7 days”
        - “Run fresh sync” (calling the manual sync API).

- **Done when**
  - You can see:
    - What data exists and to what date.
    - Whether syncing is stuck or healthy.
  - Home metrics:
    - Match sums of Shopify + Meta underlying data.

---

## Stage 9 – Hardening and Ready-for-client

**Goal**  
Clean enough to put in front of an early agency client.

### Tasks

- **RLS audit**
  - Confirm:
    - All API routes use user JWT / auth context, not `service_role`.
    - Queries as one test account cannot see another account’s data.
  - Add tests (if possible) for cross-account isolation.

- **Error handling and logging**
  - Jobs:
    - Ensure `sync_runs.error_message` is set on failure with human-readable context.
  - UI:
    - Show “Sync failing, click for details” or similar instead of blank charts.
    - Add a simple log view or error modal.

- **Rate-limiting sanity checks**
  - Simulate heavier data pulls (e.g. dev shop with many orders/ads).
  - Verify:
    - Jobs handle rate limits gracefully.
    - No hammering of Shopify/Meta APIs.
    - Backoff and retry logic works and logs properly.

- **Minimal client-facing docs**
  - Create a short “How your data syncs” page or doc:
    - What data is pulled (Shopify + Meta).
    - How often sync runs.
    - Where to check sync status in the app.
    - Known lags (e.g. Meta attribution window behavior).

- **Done when**
  - You’re comfortable giving this to 1–2 real clients.
  - You can diagnose sync issues using logs + sync status without digging deeply into code.


