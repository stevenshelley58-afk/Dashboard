# Deployment Guide

Complete guide for deploying the data pipeline system to production.

## Prerequisites

1. **Supabase Project**: Create project at https://supabase.com
2. **Vercel Account**: For frontend deployment
3. **Railway Account**: For worker service
4. **GitHub Repository**: For version control

## Step 1: Supabase Setup

### 1.1 Create Project

1. Go to https://supabase.com
2. Create new project
3. Note your project URL and API keys

### 1.2 Link Local CLI

```bash
cd supabase
supabase link --project-ref <your-project-ref>
```

### 1.3 Run Migrations

```bash
supabase db push
```

This will create all schemas, tables, views, and functions.

### 1.4 Deploy Edge Functions

```bash
supabase functions deploy sync
```

### 1.5 Set Environment Variables

In Supabase Dashboard → Project Settings → Edge Functions:

- These are automatically injected:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_DB_URL`
  - `SUPABASE_JWT_SECRET`

- Add custom secrets if needed:
```bash
supabase secrets set CUSTOM_SECRET=value
```

### 1.6 Configure API Settings

1. Go to Settings → API
2. Ensure `reporting` schema is exposed if frontend uses REST API
3. Configure RLS policies as needed

## Step 2: Railway Setup (Worker)

### 2.1 Create Service

1. Go to https://railway.app
2. New Project → Deploy from GitHub repo
3. Select your repository
4. Add service → Select `apps/worker` directory

### 2.2 Configure Build

Railway should auto-detect:
- Build command: `cd apps/worker && npm install && npm run build`
- Start command: `cd apps/worker && npm start`

### 2.3 Set Environment Variables

In Railway → Service → Variables:

**Required:**
```
SUPABASE_DB_URL=postgresql://postgres.<region>:URL_ENCODED_PASSWORD@aws-<region>.pooler.supabase.com:6543/postgres?application_name=worker-listener&keepalives=1&connect_timeout=5
```

**Platform APIs (as needed):**
```
META_ACCESS_TOKEN=<business-system-user-token>
META_AD_ACCOUNT_ID=act_1234567890
GA4_CREDENTIALS_JSON='<service-account-json>'
GA4_PROPERTY_ID=<property-id>
KLAVIYO_API_KEY=<private-api-key>
```

**Optional:**
```
LOG_LEVEL=INFO
```

### 2.4 Configure Cron (Optional)

For scheduled incremental syncs:

1. Railway → Service → Settings → Cron
2. Add cron job:
   - Schedule: `0 */6 * * *` (every 6 hours)
   - Command: `cd apps/worker && npm start`

## Step 3: Vercel Setup (Frontend)

### 3.1 Create Project

1. Go to https://vercel.com
2. Import GitHub repository
3. Select root directory

### 3.2 Configure Build

Vercel should auto-detect Next.js:
- Framework Preset: Next.js
- Root Directory: `apps/web`
- Build Command: `cd apps/web && npm install && npm run build`
- Output Directory: `apps/web/.next`

### 3.3 Set Environment Variables

In Vercel → Project → Settings → Environment Variables:

**Required:**
```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<public-anon-key>
```

### 3.4 Link Supabase Integration

1. Vercel → Project → Settings → Integrations
2. Add Supabase Integration
3. This auto-syncs `NEXT_PUBLIC_SUPABASE_*` variables

## Step 4: GitHub Setup

### 4.1 Branch Strategy

- `main` → Production (auto-deploys to Vercel/Railway)
- `develop` → Preview/staging
- `feature/*` → Feature branches

### 4.2 GitHub Actions (Optional)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Supabase
        run: |
          supabase db push
          supabase functions deploy sync
```

## Step 5: Testing

### 5.1 Test Worker

```bash
cd apps/worker
npm run validate-env
npm run test-connections
npm run dev
```

### 5.2 Test Edge Function

```bash
# Get auth token from Supabase
curl -X POST https://<project-ref>.supabase.co/functions/v1/sync \
  -H "Authorization: Bearer <auth-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "shop_id": "sh_test",
    "job_type": "INCREMENTAL",
    "platform": "META"
  }'
```

### 5.3 Test Frontend

```bash
cd apps/web
npm run dev
# Visit http://localhost:3000
```

## Step 6: Monitoring

### 6.1 Check Worker Logs

- Railway → Service → Logs
- Or: `railway logs`

### 6.2 Check Edge Function Logs

- Supabase Dashboard → Edge Functions → sync → Logs

### 6.3 Monitor Jobs

Query `core_warehouse.etl_runs`:
```sql
SELECT * FROM core_warehouse.etl_runs 
ORDER BY created_at DESC 
LIMIT 10;
```

### 6.4 View Sync Status

```sql
SELECT * FROM reporting.sync_status 
ORDER BY created_at DESC 
LIMIT 10;
```

## Troubleshooting

### Worker won't start

- Check `SUPABASE_DB_URL` is set correctly
- TLS is controlled by code (do not use `sslmode=require` in URL)
- Check Railway logs for errors

### Edge Function 401/403

- Verify JWT token is valid
- Check user has access to shop in `user_shops` table
- Ensure shop exists in `core_warehouse.shops`

### API Connection Errors

- Run `npm run test-connections` in worker
- Verify API keys are correct
- Check rate limits haven't been exceeded

### Database Connection Issues

- Verify `SUPABASE_DB_URL` uses correct format
- Check firewall rules in Supabase
- Ensure connection pooler is configured correctly

## Production Checklist

- [ ] All migrations applied
- [ ] Edge Functions deployed
- [ ] Environment variables set in all services
- [ ] Worker running on Railway
- [ ] Frontend deployed on Vercel
- [ ] Test sync job succeeds
- [ ] Monitoring/logging working
- [ ] RLS policies configured
- [ ] API rate limits configured
- [ ] Backup strategy in place

## Next Steps

1. Add Shopify ETL when API keys are ready
2. Set up scheduled cron jobs for incremental syncs
3. Configure alerts for failed jobs
4. Add monitoring dashboard
5. Set up data retention policies

