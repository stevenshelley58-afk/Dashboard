# Database Migrations

This directory owns the Supabase/Postgres schema for the Phase 0 MVP. We are
using plain SQL migrations so that humans, agents, or CI can understand the
exact DDL that was applied.

## Prerequisites

- A Supabase project with Supavisor enabled.
- Two connection strings:
  - **Transaction DSN (port 6543)** – used by `apps/web`.
  - **Session DSN with `service_role` (port 5432)** – used by the worker,
    migrations, and any local `psql` runs. Never expose this to the web app.

For local development you can keep the service-role DSN in `apps/worker/.env`
and temporarily export it when you need to run a migration:

```bash
export DATABASE_URL="$(cat apps/worker/.env | grep DATABASE_URL | cut -d= -f2-)"
```

On Windows/PowerShell use:

```powershell
$env:DATABASE_URL = (Get-Content apps/worker/.env | Select-String 'DATABASE_URL').ToString().Split('=')[1]
```

## Running migrations

The quickest option is to run the helper script from the repo root:

```bash
npm run db:migrate
```

This script executes every `.sql` file in `db/migrations` in lexical order using
the `apps/worker` connection logic (service-role DSN required).

If you prefer applying files manually, each migration is plain SQL. Run them
sequentially with `psql` (or Supabase SQL editor) against the **service-role**
connection string:

```bash
psql "$DATABASE_URL" -f db/migrations/001_sync_runs.sql
psql "$DATABASE_URL" -f db/migrations/002_core_schema.sql
```

If you prefer Supabase CLI you can also run `supabase db push --db-url
"$DATABASE_URL"` which will replay every file in `db/migrations`.

### Seed data

`003_seed_data.sql` inserts a deterministic “Internal Agency” account (`account_id
= 079ed5c0-4dfd-4feb-aa91-0c4017a7be2f`) and an owner user. The application’s dev
fall-back account references this UUID, so keep it intact unless you also update
`LOCAL_DEV_ACCOUNT_ID`.

## Authoring new migrations

1. Copy `db/migrations/.gitkeep` as a template, or create a new file named
   `NNN_description.sql`.
2. Keep the numbering zero-padded and monotonic so ordering stays deterministic.
3. Add comments at the top describing what the migration introduces.
4. When adding new tables that require tenant isolation, remember that RLS will
   be enabled in later phases—always include `account_id` columns and indexes.

## Verification

After applying a migration run:

```bash
psql "$DATABASE_URL" -c "select now();"
```

This ensures connectivity still matches the Stage 1 spec (“DB connection ok” via
`select now()`) before promoting the changes.


