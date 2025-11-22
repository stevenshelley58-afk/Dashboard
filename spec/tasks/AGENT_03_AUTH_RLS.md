## Agent 03 – Auth Wiring + RLS Skeleton

**Docs this agent must read**

- `AGENT_GUIDELINES.md`
- `spec/PHASE0_02_STACK_INFRA.md`
- `spec/PHASE0_03_SCHEMA_TENANCY_INTEGRATIONS.md`
- `spec/PHASE0_07_SECURITY_RLS.md`
- `spec/MVP Build Plan.md` (Stage 3 parts about auth/RLS)

---

### Goal

Add authentication, ensure each request has an `account_id` in context, and enable basic tenant RLS.

---

### Work

- **Auth approach**
  - Choose auth approach (per spec):
    - Either Supabase Auth or custom JWT.
  - JWT **must** include `account_id`.

- **`apps/web`**
  - Add a helper to extract `account_id` from the request (e.g. `lib/auth/getCurrentAccountId.ts`).
  - Ensure all DB access in web layer goes through a helper that requires `account_id`.

- **Supabase RLS**
  - Enable RLS on all tenant tables (`accounts`, `users`, `shops`, `ad_accounts`, `integrations`, `integration_secrets`, raw/facts/aggregates, `sync_runs`, `sync_cursors`, `shopify_webhooks_raw`).
  - Define a simple policy pattern where relevant:
    - `USING (account_id = (auth.jwt() ->> 'account_id')::uuid)`.

- **Worker**
  - Ensure worker:
    - Uses service_role DSN.
    - Is documented to always filter by `account_id`/`integration_id` explicitly (add TODOs/comments where jobs will go).

---

### Out of scope

- UI for login.
- Any job implementation.

---

### Acceptance

- With a JWT for account A, a query from web code cannot see account B rows (test with dummy data).
- Worker can still read/write all rows using service_role.


