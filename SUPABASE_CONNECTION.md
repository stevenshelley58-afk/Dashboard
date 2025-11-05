# Supabase → Railway Connection Setup

## Connection String Format (Recommended)

Use the Supabase **transaction pooler** connection string:

```
postgresql://postgres.<PROJECT_REF>:URL_ENCODED_PASSWORD@aws-<region>.pooler.supabase.com:6543/postgres?application_name=worker-listener&keepalives=1&connect_timeout=5
```

### Components
- **Protocol:** `postgresql://`
- **User:** `postgres.<PROJECT_REF>` (includes project ref)
- **Password:** Supabase database password (URL-encoded)
- **Host:** `<region>.pooler.supabase.com` value shown in Supabase dashboard
- **Port:** `6543`
- **Database:** `postgres`
- **Additional params:**
  - `application_name=worker-listener`
  - `keepalives=1`
  - `connect_timeout=5`
- **TLS:** Controlled by code-level `ssl: { rejectUnauthorized: false }` (do not include `sslmode` in URL)

## How to Get Your Pooler URI

1. Supabase Dashboard → **Settings** → **Database**
2. In **Connection string**, choose **Connection pooling** → **Transaction**
3. Copy the PostgreSQL URI (already includes the correct username/host)
4. Confirm the password is URL-encoded

## URL Encoding Reference

Encode special characters in your password:
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
- Result: `postgresql://postgres.<PROJECT_REF>:MyP%40ss%21123@aws-<region>.pooler.supabase.com:6543/postgres?sslmode=require...`

## Railway Environment Variable

Set in Railway Dashboard → Service → Variables:

```
SUPABASE_DB_URL=postgresql://postgres.gywjhlqmqucjkneucjbp:J7Tg4LkQiTbz%21cS@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?application_name=worker-listener&keepalives=1&connect_timeout=5
```

## Code Configuration

The worker uses `pg` with safe pooler defaults:
```typescript
new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 5000,
})
```

## Common Checks

- Ensure the username matches `postgres.<PROJECT_REF>`
- Include `connect_timeout=5` in the URI
- Password must stay URL-encoded when pasted into Railway
- **Do not** include `sslmode=require` (it overrides code-level TLS configuration)

## Legacy Direct Connection (Reference)

The IPv4 direct connection guidance has been deprecated. Stick with the transaction pooler to ensure Railway compatibility.

