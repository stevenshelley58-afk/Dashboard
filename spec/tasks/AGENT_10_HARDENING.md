## Agent 10 – Hardening (Isolation, Errors, Basic Docs)

**Docs this agent must read**

- `AGENT_GUIDELINES.md`
- All Phase 0 spec files (`PHASE0_0*_*.md`)
- `spec/MVP Build Plan.md` (Stage 6)

---

### Goal

Make the MVP safe to put in front of 1–2 clients: isolation, error paths, and minimal docs.

---

### Work

- **RLS / isolation tests**
  - Add a small test or script to prove:
    - Web/API with account A cannot read account B data.
  - Check all API handlers:
    - Use the auth helper to get `account_id`.
    - Pass it into queries.

- **Error handling**
  - Ensure worker sets `sync_runs.error_message` clearly on failure.
  - UI shows “Sync failing – see details” instead of blank charts.
  - Provide a simple UI view or log link to inspect last `sync_runs` for an integration.

- **Rate limit sanity**
  - Review Meta + Shopify job code:
    - Confirm backoff logic exists for 429 / throttleStatus.
    - Confirm they mark `rate_limited` and `rate_limit_reset_at` when appropriate.

- **Minimal docs**
  - Create a short markdown file, e.g. `spec/CLIENT_FAQ.md`:
    - What data we pull.
    - How often it syncs.
    - Where to see sync status in the app.
    - Known lags/limitations.

---

### Out of scope

- Any new features or new data sources.

---

### Acceptance

- You can:
  - Prove tenant isolation.
  - See clear sync failures with reasons in UI/logs.
  - Hand `CLIENT_FAQ.md` to a client and it matches behaviour.


