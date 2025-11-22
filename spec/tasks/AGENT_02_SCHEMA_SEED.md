## Agent 02 – Schema (Phase 0 Tables) + Seed Data

**Docs this agent must read**

- `AGENT_GUIDELINES.md`
- `spec/PHASE0_03_SCHEMA_TENANCY_INTEGRATIONS.md`
- `spec/PHASE0_04_SCHEMA_DATA_LAYERS.md`
- `spec/MVP Build Plan.md` (Stage 2 section)

---

### Goal

Implement all Phase 0 tables, indexes, and minimal seed data. No RLS yet.

---

### Work

- **Migrations for Phase 0 tables**
  - Tenancy: `accounts`, `users`, `shops`, `ad_accounts`.
  - Integrations: `integrations`, `integration_secrets`, `sync_runs`, `sync_cursors`.
  - Webhooks: `shopify_webhooks_raw`.
  - Raw:
    - `shopify_orders_raw`, `shopify_products_raw`, `shopify_customers_raw`
    - `meta_insights_raw`, `meta_creatives_raw`.
  - Facts: `fact_orders`, `fact_meta_daily`.
  - Aggregates: `daily_shopify_metrics`, `daily_meta_metrics`, `daily_summary`, `latest_kpis`.

- **Constraints and indexes**
  - Add primary keys, foreign keys, unique constraints, and indexes as implied by the spec.

- **Seed migration / script**
  - Insert one `accounts` row (internal agency account).
  - Insert one `users` row tied to that account.

---

### Out of scope

- Auth, JWT, and RLS.
- Any tables not listed in Phase 0 spec.

---

### Acceptance

- `db:migrate` (or equivalent) runs clean on an empty DB.
- All tables and indexes exist as per spec.
- Seed rows appear in `accounts` and `users`.


