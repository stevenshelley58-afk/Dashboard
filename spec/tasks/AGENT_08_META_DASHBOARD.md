## Agent 08 – Meta Dashboard API + UI

**Docs this agent must read**

- `AGENT_GUIDELINES.md`
- `spec/PHASE0_04_SCHEMA_DATA_LAYERS.md`
- `spec/PHASE0_06_API_FRONTEND.md` (Meta section)
- `spec/MVP Build Plan.md` (Stage 5 Meta parts)

---

### Goal

Expose Meta performance via API and build a Meta dashboard page.

---

### Work

- **API: `/api/dashboard/meta`**
  - Inputs: date range (auth gives `account_id`).
  - Query `daily_meta_metrics`.
  - Return daily spend, purchases, purchase_value, ROAS.

- **UI page: `/dashboard/meta`**
  - Date picker.
  - KPI cards: spend, purchases, purchase_value, ROAS.
  - Timeseries chart: spend vs purchase_value with ROAS line.
  - Empty/syncing states.

---

### Out of scope

- Blended Home.
- Sync status.

---

### Acceptance

- For your test ad account, metrics for last 7 days display and roughly match Ads Manager.


