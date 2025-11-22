## Phase 0 Security & RLS

### 1. Tenant Isolation

- **Account scoping**
  - All tenant data has `account_id`.

- **Modes**
  - Frontend/API: RLS enforced.
  - Worker: `service_role`, no RLS, explicit `WHERE account_id / integration_id`.

### 2. Frontend / Vercel RLS

- **Auth & keys**
  - Use non-service-role Supabase key + JWT auth.
  - JWT must include `account_id`.

- **RLS policy pattern (conceptual)**
  - `USING (account_id = (auth.jwt() ->> 'account_id')::uuid)`

- **Applies to**
  - `shops`, `ad_accounts`, `integrations`, `integration_secrets`
  - `shopify_*_raw`, `meta_*_raw`
  - `fact_orders`, `fact_meta_daily`
  - `daily_*`, `latest_kpis`
  - `sync_runs`, `sync_cursors`, `shopify_webhooks_raw`

### 3. Worker / Railway

- **DB access**
  - Uses `service_role` DSN.
  - Bypasses RLS.

- **Query rules**
  - All queries must include explicit tenant filters:
    - `WHERE integration_id = $1` and/or `WHERE account_id = $2`.
  - No unscoped selects.


