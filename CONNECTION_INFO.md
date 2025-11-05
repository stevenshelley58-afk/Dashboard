# Database Connection Information

## Runtime & Platform

- **Node.js Version**: 20.x (based on `@types/node: ^20.11.0`)
- **Hosting Platform**: Railway (for worker service)
- **Package Manager**: pnpm@10.18.1

## Database Driver

- **Driver**: `pg` (node-postgres)
- **Version**: `^8.11.3`
- **Type**: Direct PostgreSQL driver (not Prisma, not an ORM)

## Connection Configuration

### Current Setup ✅
- **Connection String Environment Variable**: `SUPABASE_DB_URL`
- **Mode**: Supabase **Transaction Pooler** (Railway recommended)
- **Pool Configuration**:
  - `max: 1`
  - `connectionTimeoutMillis: 5000`
  - `idleTimeoutMillis: 5000`
  - `ssl.rejectUnauthorized: false`
- **Why**: Avoids IPv4 add-on requirements and resolves `SELF_SIGNED_CERT_IN_CHAIN`

### Current Connection Code Location
- **File**: `apps/worker/src/worker.ts`
- **Function**: `createPool()` - simplified standard pool creation
- **Initialization**: `initializeConnection()` - standard connection setup

### Code Simplification
- ✅ Removed custom IPv4 DNS resolution workarounds
- ✅ Removed `resolveIPv4Host()` function
- ✅ Removed `makeIPv4Pool()` function
- ✅ Now uses standard `pg.Pool` with connection string

## Connection String Format

### Transaction Pooler (Current - Recommended)
```
postgresql://postgres.gywjhlqmqucjkneucjbp:URL_ENCODED_PASSWORD@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?application_name=worker-listener&keepalives=1&connect_timeout=5
```

- Username must include the project ref (`postgres.gywjhlqmqucjkneucjbp`)
- Host must match the exact pooler region hostname from Supabase Dashboard
- Port `6543`
- Password must be URL-encoded (e.g., `!` → `%21`)

### Legacy Note
Direct connection guidance has been retired. Stick with the transaction pooler to avoid TLS and networking issues on Railway.

## Next Steps

1. **Get Transaction Pooler URL**:
   - Supabase Dashboard → Settings → Database → Connection string → Connection pooling → Transaction
   - Copy the PostgreSQL URI provided

2. **Update Railway Environment Variable**:
   - Set `SUPABASE_DB_URL` to the pooler URI
   - Confirm the password remains URL-encoded
   - Include `application_name`, `keepalives=1`, `connect_timeout=5`
   - **Do not include `sslmode=require`** (let code control TLS via `ssl: { rejectUnauthorized: false }`)

3. **Redeploy**: Railway will automatically redeploy with the new connection string

See `FIX_IPv6_ISSUE.md` for archived IPv4 instructions if needed.

