# Dashboard - Data Pipeline System

ELT (Extract, Load, Transform) data pipeline with agent orchestration system.

## Architecture

- **Frontend**: Next.js app on Vercel (`apps/web`)
- **Worker**: TypeScript background service on Railway (`apps/worker`)
- **Database**: Supabase PostgreSQL with schemas: staging_ingest, core_warehouse, reporting, app_dashboard
- **Edge Functions**: Supabase Edge Functions for API endpoints

## Monorepo Structure

```
.
├── apps/
│   ├── web/          # Next.js frontend
│   └── worker/       # Railway worker service
├── supabase/         # Supabase config and migrations
├── agents/           # Agent orchestration system
├── config/           # Configuration
├── memory/           # State management
└── utils/            # Utilities
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Git
- Supabase CLI
- Vercel CLI (optional)
- Railway CLI (optional)

### Setup

1. Install dependencies:
```bash
npm install
```

2. Verify tools:
```bash
npm run verify-tools
```

3. Start local Supabase:
```bash
cd supabase
supabase start
```

4. Run agent system:
```bash
npm run dev
```

## Development

### Branching Strategy

- `main` → production
- `develop` → preview/staging
- `feature/*` → feature branches

### Database Migrations

Migrations are NOT auto-run on deploy. Apply manually:

```bash
supabase link
supabase db push
```

## Environment Variables

See `specs/Spec V1` for complete environment variable contract.

Key variables:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`
- Platform-specific tokens (Shopify, Meta, GA4, Klaviyo)

## Agent System

The agent orchestration system manages:
- Building and implementing features
- Deployment automation
- Task execution
- State management and checkpointing

See `agents/` directory for implementation.
