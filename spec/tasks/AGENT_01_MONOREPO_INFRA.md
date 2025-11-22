## Agent 01 – Monorepo + Base Infra Wiring

**Docs this agent must read**

- `AGENT_GUIDELINES.md`
- `spec/PHASE0_01_OVERVIEW.md`
- `spec/PHASE0_02_STACK_INFRA.md`
- `spec/MVP Build Plan.md` (Stage 1 section only)

---

### Goal

Create the monorepo structure and basic DB wiring so both `web` and `worker` can connect to Supabase and report health. No business logic.

---

### Work

- **Create structure**
  - `apps/web` – Next.js (App Router).
  - `apps/worker` – Node service.
  - `db/` – migrations folder (empty for now).
  - Root `package.json` with workspaces; `.gitignore`; basic `README.md`.

- **`apps/web`**
  - Scaffold a minimal Next.js app.
  - Implement a single DB helper (e.g. `apps/web/lib/db.ts`) that uses `process.env.DATABASE_URL`.
    - Use **node-postgres or supabase-js**, not an ORM.
  - Implement `GET /api/health-lite`:
    - Opens a DB connection.
    - Runs `SELECT now()` or `SELECT 1`.
    - Returns `200` + `{ db: "ok" }` on success, `500` on failure.

- **`apps/worker`**
  - Scaffold a Node/TS entrypoint (e.g. `apps/worker/src/index.ts`).
  - Add a shared DB helper (or reuse one in `/db` if you centralise).
  - On startup, connect to DB using `DATABASE_URL` and log `DB connection ok` on success.

- **`db`**
  - Choose a simple migration approach (plain SQL or a lightweight tool).
  - Add `db/README.md` describing how to run migrations (no schema yet).

---

### Out of scope

- No tables, jobs, RLS, or OAuth flows.
- No extra infra libraries (Inngest, queues, etc.).

---

### Acceptance

- `apps/web` builds and runs locally.
- Hitting `/api/health-lite` (with a valid `DATABASE_URL`) returns `{ db: "ok" }`.
- `apps/worker` starts and logs `DB connection ok`.
- No `service_role` key used in web code.


