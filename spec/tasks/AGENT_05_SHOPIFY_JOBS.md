## Agent 05 – Shopify Jobs: 7d Fill + Fresh + Manual Sync

**Docs this agent must read**

- `AGENT_GUIDELINES.md`
- `spec/PHASE0_03_SCHEMA_TENANCY_INTEGRATIONS.md`
- `spec/PHASE0_04_SCHEMA_DATA_LAYERS.md`
- `spec/PHASE0_05_JOBS_PIPELINE.md` (Shopify sections)
- `spec/MVP Build Plan.md` (Stage 3 job parts)

---

### Goal

Implement `shopify_7d_fill` and `shopify_fresh` worker jobs, plus the manual sync API. Data must flow into raw, facts, and daily aggregates.

---

### Work

- **Worker job runner**
  - Implement a simple job dispatcher that:
    - Can trigger specific job functions.
    - Logs runs in `sync_runs`.

- **`shopify_7d_fill` job**
  - For the integration:
    - Fetch orders from last 7 days via Shopify GraphQL (`created_at >= now-7d`).
    - Upsert into `shopify_orders_raw`.
    - Transform into `fact_orders`.
    - Build `daily_shopify_metrics` + `daily_summary` for affected dates.
    - If `sync_cursors` has no `last_synced_order_updated_at`, set it to max `order_updated_at`.
    - Log `sync_runs` row.

- **`shopify_fresh` job**
  - Read cursor `last_synced_order_updated_at`.
  - Fetch orders where `updated_at >= cursor` sorted by `UPDATED_AT`.
  - Upsert raw + facts.
  - Rebuild aggregates for dates touched.
  - Advance cursor to max(previous, latest `updated_at`).
  - Log `sync_runs`.

- **Manual sync API**
  - `POST /api/settings/manual-sync`:
    - Body: `{ integration_id, job_type }`.
    - Enqueues a `sync_runs` row for the current account.

---

### Out of scope

- UI charts.
- Any Meta work.

---

### Acceptance

- For a dev store:
  - Running `shopify_7d_fill` populates:
    - `shopify_orders_raw`
    - `fact_orders`
    - `daily_shopify_metrics`
    - `daily_summary`
  - Running `shopify_fresh` after new orders adjusts the same tables correctly.
- `sync_runs` records runs with status and basic stats.


