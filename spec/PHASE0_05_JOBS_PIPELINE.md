## Phase 0 Jobs & Pipeline

### 1. Common Job Rules

- **Job design**
  - Independent jobs.
  - Bounded runtime (~30–60s).
  - Upserts everywhere (`ON CONFLICT DO UPDATE`).
  - Cursors move forward only.

- **Rate limiting**
  - Shopify: use `throttleStatus` to back off.
  - Meta: handle `429` + usage headers with exponential backoff and mark `rate_limited`.

### 2. Job: `shopify_7d_fill`

- **Purpose**
  - Initial 7-day data for a new Shopify integration.

- **Trigger**
  - After Shopify OAuth.
  - Manual “Sync last 7 days”.

- **Logic**
  - Filter orders by `created_at >= now-7d`.
  - GraphQL orders (sort by `CREATED_AT`).
  - Upsert → `shopify_orders_raw`, then `fact_orders`.
  - Rebuild `daily_shopify_metrics` + `daily_summary` for affected dates.
  - If `last_synced_order_updated_at` is empty, set to max `order_updated_at` from this run.
  - Log `sync_runs`.

### 3. Job: `shopify_fresh`

- **Purpose**
  - Fresh data + continuous reconciliation via `updated_at`.

- **Trigger**
  - Cron every 15–30 minutes.

- **Cursor**
  - `cursor_key = 'last_synced_order_updated_at'`.

- **Logic**
  - Query GraphQL orders with `updated_at >= cursor` sorted by `UPDATED_AT`.
  - Upsert raw + facts.
  - Rebuild aggregates only for touched dates.
  - Advance cursor = max(previous, latest `order.updated_at`).
  - Log `sync_runs`.

### 4. Job: `meta_7d_fill`

- **Purpose**
  - Initial Meta data for last 7 days.

- **Trigger**
  - After Meta connect.
  - Manual “Sync last 7 days”.

- **Logic**
  - For each day in \[today-7 … yesterday]:
    - Call insights with:
      - `level = ad`
      - Filtering on `ad.effective_status IN ('ACTIVE','PAUSED')`
      - Minimal fields.
    - Upsert → `meta_insights_raw`.
    - Rebuild `fact_meta_daily` for that day.
    - Rebuild `daily_meta_metrics` + `daily_summary` for those dates.
  - If `meta_last_window_end` empty, set to yesterday (or chosen).
  - Log `sync_runs`.

### 5. Job: `meta_fresh`

- **Purpose**
  - Attribution-aware refresh for late conversions.

- **Trigger**
  - Cron hourly (or every 2h).

- **Window**
  - Per `ad_account_id`:
    - `N = attribution_window_days` (default 7).
    - Days \[today - N + 1 … yesterday] (or including today if desired).

- **Logic**
  - For each day in window:
    - Same insights call as 7d fill.
    - Upsert raw + rebuild `fact_meta_daily`.
    - Rebuild `daily_meta_metrics` + `daily_summary` for window.
  - Optionally update `meta_last_window_end`.
  - Log `sync_runs`.

### 6. Aggregates

- **Aggregate strategy (Phase 0)**
  - No separate aggregate job in Phase 0.
  - Aggregation work is done inside the four core jobs, scoped to the dates those jobs touched.


