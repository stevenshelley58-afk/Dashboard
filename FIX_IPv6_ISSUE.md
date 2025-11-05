# Supabase Connection Setup

> **Recommended:** Use the Supabase **Transaction Pooler** (Option A) for Railway. The IPv4 add-on instructions remain below for archival purposes.

## ✅ Option A — Transaction Pooler (Recommended)

1. **Get Pooler URL**
   - Supabase Dashboard → **Settings** → **Database**
   - Under **Connection string**, choose **Connection pooling** → **Transaction**
   - Copy the PostgreSQL URI. It should look like:
     ```
     postgresql://postgres.<PROJECT_REF>:URL_ENCODED_PASSWORD@aws-<region>.pooler.supabase.com:6543/postgres?sslmode=require&application_name=worker-listener&keepalives=1&connect_timeout=5
     ```

2. **Update Railway Variable**
   - In Railway → Worker service → **Variables**, set `SUPABASE_DB_URL` to the copied URI
   - Ensure the password stays URL-encoded (e.g., `!` → `%21`)

3. **Redeploy**
   - Railway redeploys automatically; confirm the worker logs no longer show `SELF_SIGNED_CERT_IN_CHAIN`

4. **Pool Configuration**
   - Code now uses `max: 1`, `connectionTimeoutMillis: 5000`, `idleTimeoutMillis: 5000`, and `ssl.rejectUnauthorized = false`

## Legacy IPv4 Flow (Reference Only)

If you need the direct IPv4 connection steps (e.g., for troubleshooting), the previous process is documented below.

### ✅ IPv4 Add-On Enabled

The Supabase IPv4 add-on allows direct database connections from Railway containers.

### Step 1: Get Your IPv4 Connection String

1. Supabase Dashboard → **Settings** → **Database**
2. Under **Connection string**, choose **Direct connection**
3. Copy the IPv4 PostgreSQL URI, e.g.:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@[IPv4-ADDRESS]:5432/postgres
   ```

### Step 2: Update Railway Environment Variable

1. Railway → Worker service → **Variables**
2. Set `SUPABASE_DB_URL` to the IPv4 URI
3. Ensure the password is URL-encoded and add `?sslmode=require`

**Example:**
```
SUPABASE_DB_URL=postgresql://postgres:J7Tg4LkQiTbz%21cS@db.gywjhlqmqucjkneucjbp.supabase.co:5432/postgres?sslmode=require&application_name=worker-listener&keepalives=1
```

### Step 3: Redeploy

Railway redeploys automatically with the updated variable.

### Code Notes

- IPv4-specific DNS workarounds have been removed
- Direct connection pool settings are superseded by the transaction pooler configuration above

