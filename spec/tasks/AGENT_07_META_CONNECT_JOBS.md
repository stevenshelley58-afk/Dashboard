## Agent 07 – Meta Connect + Jobs

**Docs this agent must read**

- `AGENT_GUIDELINES.md`
- `spec/PHASE0_03_SCHEMA_TENANCY_INTEGRATIONS.md`
- `spec/PHASE0_04_SCHEMA_DATA_LAYERS.md`
- `spec/PHASE0_05_JOBS_PIPELINE.md` (Meta sections)
- `spec/MVP Build Plan.md` (Stage 4)

---

### Goal

Connect a Meta ad account and implement `meta_7d_fill` + `meta_fresh` jobs, writing Meta data into warehouse + daily aggregates.

---

### Work

- **Meta connect flow (web)**
  - Implement OAuth or secure token input.
  - On success:
    - Create `ad_accounts` and `integrations` (`type='meta'`).
    - Store token + ad account id in `integration_secrets`.
    - Enforce `accounts.currency` rule (block mismatches).

- **`meta_7d_fill` job**
  - For last 7 days:
    - Call Ads Insights:
      - `level='ad'`.
      - Filter `ad.effective_status IN ('ACTIVE', 'PAUSED')`.
    - Upsert into `meta_insights_raw`.
    - Build `fact_meta_daily`.
  - Build `daily_meta_metrics` + update `daily_summary` for those days.
  - Initialise Meta cursor if spec requires.

- **`meta_fresh` job**
  - For each ad account:
    - Window `[today - attribution_window_days + 1 … yesterday]`.
    - Re-fetch insights for each day in window.
    - Upsert raw + `fact_meta_daily`.
    - Rebuild `daily_meta_metrics` + `daily_summary` for those dates.
  - Handle 429 / rate limiting with exponential backoff.
  - Log `sync_runs` with rate_limited flags if applicable.

---

### Out of scope

- Meta UI page.
- Home blended view.

---

### Acceptance

- For a dev Meta account:
  - `meta_insights_raw`, `fact_meta_daily`, `daily_meta_metrics`, `daily_summary` are populated for last 7 days.
  - Spend and purchase_value roughly match Ads Manager.

---

### Implementation notes (Nov 2025)

- Worker job handlers live in `apps/worker/src/jobs/meta.ts`. They share the Shopify aggregate helper and persist to `meta_insights_raw`, `fact_meta_daily`, `daily_meta_metrics`, and `daily_summary`. The `meta_7d_fill` job seeds `meta_last_window_end`, while `meta_fresh` advances it every time the attribution window is re-synced.
- Rate limiting follows the Marketing API guidance: 429/613 responses trigger exponential backoff (up to ~60 s) and toggle the `sync_runs.rate_limited` flag so dashboards can highlight throttling.
- Environment toggles:
  - `META_API_VERSION`, `META_API_BASE_URL` – override Graph version/hostname.
  - `META_STUB_MODE=1` – short-circuits HTTP calls and emits deterministic fixture data for local testing without credentials.
  - `META_JOBS_ENABLED=false` – hides Meta job types from manual sync + scheduler endpoints until the worker is deployed.
  - `META_FRESH_SCHED_MINUTES` – cooldown enforced by `/api/scheduler/meta`.
  - `META_CRON_SECRET`/`CRON_SECRET` – shared secret required when calling `/api/scheduler/meta`.
- The web API exposes `POST /api/scheduler/meta`, which automatically inserts `meta_fresh` runs (respecting a per-integration cooldown and the env secret). Manual sync responds with a `message` field so the UI can present “Meta sync enqueued”.
- Future Meta connect/OAuth flows should call `enqueueMetaInitialFill` (`apps/web/src/lib/sync-runs.ts`) after a successful install so the worker immediately back-fills 7 days.


