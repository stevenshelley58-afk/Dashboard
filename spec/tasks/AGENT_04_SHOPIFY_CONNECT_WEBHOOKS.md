## Agent 04 – Shopify Connect (OAuth) + Webhooks

**Docs this agent must read**

- `AGENT_GUIDELINES.md`
- `spec/PHASE0_02_STACK_INFRA.md`
- `spec/PHASE0_03_SCHEMA_TENANCY_INTEGRATIONS.md`
- `spec/PHASE0_04_SCHEMA_DATA_LAYERS.md` (webhook queue section)
- `spec/PHASE0_05_JOBS_PIPELINE.md` (just to understand roles, not to implement jobs)
- `spec/MVP Build Plan.md` (Stage 3 “Shopify Connect + Webhooks”)

---

### Goal

Connect a Shopify store, store tokens, and write incoming order webhooks into `shopify_webhooks_raw`.

---

### Work

- **Shopify app install flow (web)**
  - Implement OAuth endpoint(s) for Shopify.
  - On successful install:
    - Upsert `shops` row.
    - Create `integrations` row with `type='shopify'`.
    - Store offline token and related secrets in `integration_secrets`.
    - Enforce currency rule if needed (if spec says currency can be known here).

- **Webhooks**
  - Implement API routes for at least:
    - `orders/create`
    - `orders/updated`
  - For each:
    - Verify Shopify HMAC.
    - Insert a row into `shopify_webhooks_raw`:
      - `integration_id`, `topic`, `received_at`, `payload_json`.
      - Use ~4s DB timeout.
    - Respond `200` on success, `500` on error/timeout.

- **Minimal internal settings/debug page**
  - For the current account, show:
    - Connected Shopify store name.
    - List of last N rows from `shopify_webhooks_raw` (dev-only is fine).

---

### Out of scope

- No jobs (`shopify_7d_fill`, `shopify_fresh`) yet.
- No charts or analytics.

---

### Acceptance

- You can install the app on a dev Shopify store.
- Creating/updating a test order produces rows in `shopify_webhooks_raw`.
- Settings/debug page shows connected shop and recent webhooks.


