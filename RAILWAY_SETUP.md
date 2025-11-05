# Railway Configuration Setup

## Environment Variables to Set

Set these in Railway Dashboard → Service → Variables:

```
NODE_ENV=production
SUPABASE_DB_URL=postgresql://postgres.gywjhlqmqucjkneucjbp:J7Tg4LkQiTbz%21cS@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?sslmode=require&application_name=worker-listener&keepalives=1&connect_timeout=5
PACKAGE_MANAGER=pnpm
```

**Important:** 
- Replace credentials with your actual Supabase values if different
- Password must be URL-encoded (e.g., `!` → `%21`)
- Use the transaction pooler hostname from Supabase Dashboard (Connection string → Connection pooling → Transaction)
- See `SUPABASE_CONNECTION.md` for detailed instructions

## Railway Service Settings

Based on your working configuration:

### Source
- **Source Repo:** `stevenshelley58-afk/Dashboard`
- **Root Directory:** (leave empty for root)
- **Branch:** `main`
- **Wait for CI:** (optional)

### Build
- **Builder:** `Railpack`
- **Build Command:** `pnpm -F @dashboard/worker build`
- **Watch Paths:** `/apps/worker/**`

### Deploy
- **Start Command:** `pnpm -F @dashboard/worker start`
- **Restart Policy:** `On Failure`
- **Max Restart Retries:** `10`

## Quick Setup Commands

### Via Railway Dashboard
1. Go to Railway → Your Service → Variables
2. Add each variable listed above
3. Go to Settings → Build
4. Set Builder to "Railpack"
5. Set Build Command to: `pnpm -F @dashboard/worker build`
6. Set Start Command to: `pnpm -F @dashboard/worker start`

### Via Railway CLI
```powershell
railway link
railway variables --set "NODE_ENV=production"
railway variables --set "SUPABASE_DB_URL=postgresql://postgres.gywjhlqmqucjkneucjbp:J7Tg4LkQiTbz%21cS@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?sslmode=require&application_name=worker-listener&keepalives=1&connect_timeout=5"
railway variables --set "PACKAGE_MANAGER=pnpm"
```

