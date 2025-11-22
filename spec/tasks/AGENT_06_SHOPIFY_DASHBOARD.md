## Agent 06 – Shopify Dashboard API + UI

**Docs this agent must read**

- `AGENT_GUIDELINES.md`
- `spec/PHASE0_04_SCHEMA_DATA_LAYERS.md`
- `spec/PHASE0_05_JOBS_PIPELINE.md` (for data expectations)
- `spec/PHASE0_06_API_FRONTEND.md` (Shopify section)
- `spec/MVP Build Plan.md` (Stage 5 Shopify parts)

---

### Goal

Expose Shopify data via an API and build a basic Shopify dashboard page.

---

### Work

- **API: `/api/dashboard/shopify`**
  - Inputs: date range (e.g. `from`, `to`).
  - Use `account_id` from auth.
  - Query:
    - `daily_shopify_metrics` for timeseries.
    - `fact_orders` for a recent orders list.
  - Return aggregated payload (no raw payloads).

- **UI page: `/dashboard/shopify`**
  - Date picker: today, yesterday, last 7, last 30.
  - KPI cards: orders, `revenue_net`, refunds, AOV.
  - Timeseries chart: revenue vs orders.
  - Table: recent orders (date, number, `revenue_net`, status).
  - Loading / empty states:
    - Clear message if no data (e.g. still syncing).

---

### Out of scope

- Any Meta data.
- Home blended view.

---

### Acceptance

- For your test store, Shopify dashboard:
  - Shows correct metrics for selected ranges.
  - Roughly matches Shopify admin for recent days.


