# Supabase Connection Setup

> **Recommended:** Use the Supabase **Transaction Pooler** (Option A) for Railway. The IPv4 add-on instructions remain below for archival purposes.

## ✅ Option A — Transaction Pooler (Recommended)

1. **Get Pooler URL**
   - Supabase Dashboard → **Settings** → **Database**
   - Under **Connection string**, choose **Connection pooling** → **Transaction**
   - Copy the PostgreSQL URI. It should look like:
     ```
     postgresql://postgres.<PROJECT_REF>:URL_ENCODED_PASSWORD@aws-<region>.pooler.supabase.com:6543/postgres?application_name=worker-listener&keepalives=1&connect_timeout=5
     ```
   - **Note:** Do not include `sslmode=require`; TLS verification is controlled by code (`ssl: { rejectUnauthorized: false }`)

2. **Update Railway Variable**
   - In Railway → Worker service → **Variables**, set `SUPABASE_DB_URL` to the copied URI
   - Ensure the password stays URL-encoded (e.g., `!` → `%21`)

3. **Redeploy**
   - Railway redeploys automatically; confirm the worker logs no longer show `SELF_SIGNED_CERT_IN_CHAIN`

4. **Pool Configuration**
   - Code now uses `max: 1`, `connectionTimeoutMillis: 5000`, `idleTimeoutMillis: 5000`, and `ssl.rejectUnauthorized = false`

## Legacy IPv4 Flow (Reference Only)

The IPv4 direct connection steps are deprecated. Use the transaction pooler instructions above for all Railway deployments. Legacy notes are retained only for historical context and no longer include connection strings.

