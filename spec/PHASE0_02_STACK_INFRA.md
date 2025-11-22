## Phase 0 Stack & Infra

### 1. Platforms

- **Supabase (Postgres)**
  - Primary data warehouse.
  - Supavisor pooling.
  - RLS enabled on tenant tables.

- **Vercel (Next.js)**
  - UI + public API.
  - Shopify OAuth + embedded app.
  - Meta connect flow.
  - Webhook endpoints (HMAC verify + enqueue to DB).
  - Reads aggregates only (no raw tables).

- **Railway (Node worker)**
  - Long-running worker.
  - Runs all jobs:
    - Shopify 7d fill + fresh.
    - Meta 7d fill + fresh.
    - Webhook queue processing.
    - Aggregate updates inside those jobs.

### 2. DB Connections

- **Vercel → Supabase**
  - `DATABASE_URL =` Supavisor transaction mode DSN (`pooler.supabase.com:6543`).
  - Used by API routes and server components.

- **Railway → Supabase**
  - `DATABASE_URL =` Supavisor session/direct DSN (`:5432`) using `service_role` key.
  - Used by the worker, long-lived connections.

- **Rule**
  - Do not use `db.<ref>.supabase.co` from Vercel.
  - One logical Postgres for all tenants; isolation via `account_id` + RLS.

### 3. Environment Variables

- **Shared names** (different values per platform):
  - `DATABASE_URL`
  - `SHOPIFY_API_KEY`
  - `SHOPIFY_API_SECRET`
  - `SHOPIFY_APP_URL`
  - `META_APP_ID`
  - `META_APP_SECRET`
  - `JWT_SECRET` (JWTs must include `account_id` claim)

- **Per-tenant secrets**
  - Live in DB (`integration_secrets`), not env.


