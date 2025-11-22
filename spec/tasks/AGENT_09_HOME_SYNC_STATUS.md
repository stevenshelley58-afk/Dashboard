## Agent 09 – Home Dashboard (Blended) + Sync Status

**Docs this agent must read**

- `AGENT_GUIDELINES.md`
- `spec/PHASE0_04_SCHEMA_DATA_LAYERS.md`
- `spec/PHASE0_06_API_FRONTEND.md` (Home + Sync Status)
- `spec/MVP Build Plan.md` (Stage 5 Home + Stage 6)

---

### Goal

Build the main Home page (blended Shopify + Meta) and the Sync Status view.

---

### Work

- **API: `/api/dashboard/home`**
  - Input: period preset (`today`, `yesterday`, `last_7`, `last_30`).
  - Use `latest_kpis` and `daily_summary` for the current account.
  - Return:
    - KPIs: `revenue_net`, `meta_spend`, MER, ROAS, AOV.
    - Timeseries: revenue vs spend + MER.

- **Home page: `/dashboard/home`**
  - Period selector.
  - KPI cards.
  - Chart (revenue vs spend + MER line).

- **API: `/api/settings/sync-status`**
  - For the current `account_id`, per integration:
    - `type`, `status`.
    - `last_successful_sync`, `last_attempted_sync` from `sync_runs`.
    - `data_fresh_to`:
      - Shopify: max `order_date` from `fact_orders` per integration.
      - Meta: max `date` from `fact_meta_daily`.

- **Settings UI**
  - Show each integration with:
    - Connected/error status.
    - Data up to date as of [date].
    - Last sync attempt.
    - Buttons that call `/api/settings/manual-sync` with appropriate `job_type`.

---

### Out of scope

- Any Phase 1 backlog items (GA4, Klaviyo, LTV, etc.).

---

### Acceptance

- Home page shows blended metrics for chosen period and lines up with Shopify + Meta pages.
- Sync Status page correctly indicates:
  - Whether each integration is connected.
  - How fresh the data is.
  - Allows manual sync triggering.


