# Supabase → Railway Connection Setup

## Connection String Format

For Railway service connecting to Supabase Postgres, use the **direct connection** (not pooler):

### Format:
```
postgresql://postgres:YOUR_PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres?sslmode=require&application_name=worker-listener&keepalives=1
```

### Components:
- **Protocol:** `postgresql://`
- **User:** `postgres`
- **Password:** Your Supabase database password (URL-encode special characters)
- **Host:** `db.PROJECT_REF.supabase.co` (NOT `postgres.PROJECT_REF.supabase.co`)
- **Port:** `5432`
- **Database:** `postgres`
- **SSL:** `sslmode=require` (required)
- **Additional params:**
  - `application_name=worker-listener` (optional, for monitoring)
  - `keepalives=1` (optional, for connection health)

## How to Get Your Connection String

### Option 1: Supabase Dashboard (Recommended)
1. Go to Supabase Dashboard → Project Settings → Database
2. Under "Connection string", select **"URI"** tab
3. Copy the connection string
4. Make sure it starts with `db.` not `postgres.` (direct connection)
5. Add `?sslmode=require` if not already present

### Option 2: Build Manually
1. Get your project ref from Supabase Dashboard URL: `https://supabase.com/dashboard/project/PROJECT_REF`
2. Get your database password from Supabase Dashboard → Project Settings → Database → Database password
3. URL-encode special characters in password (e.g., `!` becomes `%21`)
4. Build the string:
   ```
   postgresql://postgres:YOUR_ENCODED_PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres?sslmode=require
   ```

## URL Encoding Special Characters

If your password contains special characters, encode them:
- `!` → `%21`
- `@` → `%40`
- `#` → `%23`
- `$` → `%24`
- `%` → `%25`
- `&` → `%26`
- `*` → `%2A`
- `(` → `%28`
- `)` → `%29`

**Example:**
- Password: `MyP@ss!123`
- Encoded: `MyP%40ss%21123`
- Full connection string: `postgresql://postgres:MyP%40ss%21123@db.PROJECT.supabase.co:5432/postgres?sslmode=require`

## Railway Environment Variable

Set this in Railway Dashboard → Service → Variables:

```
SUPABASE_DB_URL=postgresql://postgres:YOUR_ENCODED_PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres?sslmode=require&application_name=worker-listener&keepalives=1
```

## Code Configuration

The worker uses `pg` library with:
```typescript
new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false }, // Required for Supabase
  max: 1,
})
```

This configuration is correct and will work with the connection string format above.

## Common Issues

### "self signed certificate" error
- ✅ Already handled with `ssl: { rejectUnauthorized: false }`
- ✅ Connection string includes `?sslmode=require`

### "connection refused" or "no pg_hba.conf entry"
- Check you're using `db.PROJECT_REF.supabase.co` (direct connection)
- NOT `postgres.PROJECT_REF.supabase.co` (pooler)
- Verify password is correct and URL-encoded
- Check Supabase firewall/allowed IPs (if configured)

### Connection timeout
- Verify `keepalives=1` is in the connection string
- Check Railway service can reach Supabase (no firewall blocking)

### Password encoding issues
- Use a URL encoder tool to encode your password
- Or use Supabase Dashboard to copy the pre-encoded connection string

## Testing the Connection

### Via Railway CLI:
```bash
railway run psql "$SUPABASE_DB_URL"
```

### Via Worker Code:
The worker will log connection status on startup. Check Railway logs:
```bash
railway logs --tail 50
```

Look for:
- ✅ "Worker initialized" - connection successful
- ❌ "Worker failed" - connection failed, check error message

