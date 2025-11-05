# Troubleshooting Guide: Railway + Supabase Connection Issues

**Complete breakdown of the "ENOTFOUND base" error and how we fixed it.**

## Summary

Your worker service on Railway was failing to connect to Supabase with error: `getaddrinfo ENOTFOUND base`. The root cause was **Railway automatically injecting PostgreSQL environment variables** from a Railway PostgreSQL service that was overriding your Supabase connection string.

---

## Part 1: The Initial Problem

### Error Message
```
[ERROR] getaddrinfo ENOTFOUND base
hostname: 'base'
```

### What We Observed
- ✅ Your code correctly parsed: `host: 'aws-1-ap-southeast-2.pooler.supabase.com'`
- ❌ But node-postgres actually connected to: `hostname: 'base'`
- ❌ Railway Variables tab showed clean: only `SUPABASE_DB_URL`, `NODE_ENV`, `PACKAGE_MANAGER`
- ❌ No "base" found anywhere in code or node_modules

### The Mystery
"base" hostname didn't exist in:
- Your source code
- Compiled dist files
- node_modules
- Railway Variables UI
- Supabase documentation

---

## Part 2: Root Cause Analysis

### Issue #1: Railway Auto-Injected PostgreSQL Environment Variables

**What Happened:**
Railway automatically injects PostgreSQL environment variables when you have a PostgreSQL database service in your project. According to [Railway's PostgreSQL documentation](https://github.com/railwayapp/docs/blob/main/src/docs/guides/postgresql.md#connect):

> Connect to the PostgreSQL server from another service in your project by referencing the environment variables made available in the PostgreSQL service:
> - `PGHOST`
> - `PGPORT`
> - `PGUSER`
> - `PGPASSWORD`
> - `PGDATABASE`
> - `DATABASE_URL`

**Why This Was Invisible:**
- These variables are **service-to-service injection** - they don't appear in your service's Variables tab
- They're injected at **runtime**, not build time
- Your Railway project had a PostgreSQL service (hostname "base") that you didn't realize existed

### Issue #2: node-postgres Environment Variable Precedence

**The Problem:**
According to [node-postgres documentation](https://github.com/brianc/node-postgres/blob/master/docs/pages/features/connecting.mdx#environment-variables), the `pg` library reads PostgreSQL environment variables and they have **higher precedence** than the `connectionString` parameter.

**Precedence Order:**
1. **Explicit config properties** (host, port, user) - highest priority
2. **Environment variables** (PGHOST, PGPORT, etc.) - **overrides connectionString** ⚠️
3. **connectionString parameter** - lowest priority

**What Happened:**
```javascript
// Your code (correct):
const pool = new Pool({
  connectionString: 'postgresql://...aws-1-ap-southeast-2.pooler.supabase.com...',
  ssl: { rejectUnauthorized: false }
});

// But node-postgres internally saw:
// PGHOST=base (from Railway) ← This overrode your connectionString!
// So it connected to "base" instead of Supabase
```

### Issue #3: Malformed Environment Variable Value

**The Problem:**
Your `SUPABASE_DB_URL` variable in Railway contained:
```
SUPABASE_DB_URL=postgresql://...
```
Instead of just:
```
postgresql://...
```

**Why This Happened:**
When setting variables via Railway CLI, the value included the variable name prefix. This caused:
```javascript
process.env.SUPABASE_DB_URL 
// Returns: "SUPABASE_DB_URL=postgresql://..." ❌
// Instead of: "postgresql://..." ✅
```

**Error:**
```
TypeError: Invalid URL
input: 'SUPABASE_DB_URL=postgresql://...'
```

### Issue #4: Incorrect Connection String Parameters

**Problems Found:**
1. **Wrong region**: `aws-0-us-west-1` instead of `aws-1-ap-southeast-2`
2. **Added `sslmode=require`**: This conflicts with Supabase pooler configuration
3. **Region mismatch**: Railway was deploying in `us-west-1` but your Supabase is in `ap-southeast-2`

---

## Part 3: The Fixes

### Fix #1: Delete Railway-Injected PG* Environment Variables

**File:** `apps/worker/src/worker.ts`

**Solution:** Before creating the Pool, delete all PG* environment variables so node-postgres uses only the connectionString.

```typescript
function createPool(connStr: string, host: string): Pool {
  // DIAGNOSTIC: Log PG* env vars injected by Railway (before cleanup)
  console.info('[pg-env-before-cleanup]', {
    PGHOST: process.env.PGHOST,
    PGPORT: process.env.PGPORT,
    PGUSER: process.env.PGUSER,
    PGPASSWORD: process.env.PGPASSWORD ? '***REDACTED***' : undefined,
    PGDATABASE: process.env.PGDATABASE,
    DATABASE_URL: process.env.DATABASE_URL ? '***EXISTS***' : undefined,
  });

  // Parse and log the Supabase URL we want to use
  const url = new URL(connStr);
  console.info('[supabase-url]', {
    host: url.hostname,
    port: url.port,
    user: url.username,
  });

  // CRITICAL FIX: Delete Railway-injected PG* vars
  // node-postgres reads these and they override connectionString
  delete process.env.PGHOST;
  delete process.env.PGPORT;
  delete process.env.PGUSER;
  delete process.env.PGPASSWORD;
  delete process.env.PGDATABASE;
  delete process.env.DATABASE_URL;

  console.info('[pg-env-after-cleanup]', 'All PG* environment variables deleted');

  const poolConfig: PoolConfig = {
    connectionString: connStr,
    ssl: {
      rejectUnauthorized: poolDefaults.sslRejectUnauthorized,
      servername: host,
    },
    max: poolDefaults.max,
    connectionTimeoutMillis: poolDefaults.connectionTimeoutMillis,
    idleTimeoutMillis: poolDefaults.idleTimeoutMillis,
  };

  // Log the clean Pool config (without password)
  console.info('[pool-config]', {
    hasConnectionString: !!poolConfig.connectionString,
    ssl: poolConfig.ssl,
    max: poolConfig.max,
    timeouts: {
      connection: poolConfig.connectionTimeoutMillis,
      idle: poolConfig.idleTimeoutMillis,
    },
  });

  return new Pool(poolConfig);
}
```

**Why This Works:**
By deleting the environment variables, we force node-postgres to use only the `connectionString` parameter, which contains the correct Supabase URL.

### Fix #2: Correct Railway Environment Variable

**Command:**
```bash
railway variables --set SUPABASE_DB_URL="postgresql://postgres.gywjhlqmqucjkneucjbp:J7Tg4LkQiTbz%21cS@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?application_name=worker-listener&keepalives=1&connect_timeout=5"
```

**Changes:**
- ✅ Removed `SUPABASE_DB_URL=` prefix (value should be just the URL)
- ✅ Correct region: `aws-1-ap-southeast-2` (not `aws-0-us-west-1`)
- ✅ Removed `sslmode=require` (conflicts with Supabase pooler)
- ✅ Kept correct parameters: `application_name`, `keepalives`, `connect_timeout`

**Verification:**
```bash
railway variables  # Should show clean URL without prefix
```

---

## Part 4: Best Practices for Future Builds

### 1. Always Delete PG* Environment Variables When Using External Databases

**Rule:** If you're connecting to an external database (Supabase, AWS RDS, etc.) and Railway has a PostgreSQL service in the same project, **always delete PG* env vars** before Pool creation.

**Why:** Railway auto-injects them, and they override your connectionString.

**Pattern:**
```typescript
// Before creating Pool
delete process.env.PGHOST;
delete process.env.PGPORT;
delete process.env.PGUSER;
delete process.env.PGPASSWORD;
delete process.env.PGDATABASE;
delete process.env.DATABASE_URL;
```

### 2. Add Diagnostic Logging Before Pool Creation

**Why:** This exposes what environment variables exist at runtime, which helps debug connection issues.

**Pattern:**
```typescript
console.info('[pg-env-before-cleanup]', {
  PGHOST: process.env.PGHOST,
  PGPORT: process.env.PGPORT,
  PGUSER: process.env.PGUSER,
  PGPASSWORD: process.env.PGPASSWORD ? '***' : undefined,
  PGDATABASE: process.env.PGDATABASE,
  DATABASE_URL: process.env.DATABASE_URL ? 'exists' : undefined,
});

// ... cleanup code ...

console.info('[pg-env-after-cleanup]', 'All PG* environment variables deleted');
console.info('[pool-config]', {
  hasConnectionString: !!poolConfig.connectionString,
  ssl: poolConfig.ssl,
  // ... other config
});
```

### 3. Verify Environment Variable Values

**Railway Dashboard:**
- Go to Service → Variables
- Verify the value is **just the URL**, not `VARIABLE_NAME=URL`
- Check for correct region, port, and parameters

**CLI:**
```bash
railway variables  # Lists all variables
railway variables --get SUPABASE_DB_URL  # Get specific variable
```

### 4. Remove Unused Railway Database Services

**Rule:** If you're using an external database, **remove any Railway PostgreSQL services** from your project to prevent PG* variable injection.

**How:**
1. Railway Dashboard → Your Project
2. Find PostgreSQL database service
3. Settings → Delete Service

**Benefit:** Cleaner environment, no PG* vars injected at all.

### 5. Use Correct Supabase Connection String Format

**Transaction Pooler (Recommended for Workers):**
```
postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-<NUM>-<REGION>.pooler.supabase.com:6543/postgres?application_name=<APP_NAME>&keepalives=1&connect_timeout=5
```

**Do NOT include:**
- ❌ `sslmode=require` (conflicts with pooler)
- ❌ Wrong region
- ❌ Variable name prefix in value

**Do include:**
- ✅ `application_name` (for monitoring)
- ✅ `keepalives=1` (connection health)
- ✅ `connect_timeout=5` (fail fast)

### 6. Check Region Alignment

**Rule:** Deploy your worker in the **same region** as your Supabase database for lowest latency.

**Your Setup:**
- Supabase: `ap-southeast-2` (Asia Pacific - Sydney)
- Railway: Should deploy to `ap-southeast-2` or closest region

**Check:**
- Railway Dashboard → Service → Settings → Region
- Supabase Dashboard → Project Settings → Region

### 7. Test Connection Before Deploying

**Local Test:**
```bash
cd apps/worker
npm run test-connections
```

**Verify:**
- Connection succeeds
- Correct hostname/region in logs
- No PG* environment variable warnings

---

## Part 5: Debugging Checklist

When connection issues occur, check in this order:

### 1. Environment Variables
- [ ] Is `SUPABASE_DB_URL` set correctly? (no prefix, correct region)
- [ ] Are PG* variables being injected? (check `[pg-env-before-cleanup]` logs)
- [ ] Are we deleting PG* variables before Pool creation?

### 2. Connection String
- [ ] Correct region? (`aws-1-ap-southeast-2`)
- [ ] Correct port? (`6543` for transaction pooler)
- [ ] No `sslmode=require`?
- [ ] Correct username format? (`postgres.<PROJECT_REF>`)

### 3. Code Configuration
- [ ] Pool config uses `connectionString` (not individual host/port/user)
- [ ] SSL config: `{ rejectUnauthorized: false, servername: host }`
- [ ] No hardcoded host values

### 4. Railway Configuration
- [ ] Unused PostgreSQL services removed?
- [ ] Correct deployment region?
- [ ] Build/start commands correct?

### 5. Network
- [ ] Railway can reach Supabase? (check Supabase allowed IPs)
- [ ] Supabase pooler enabled? (Dashboard → Settings → Database)
- [ ] Transaction mode enabled? (port 6543)

---

## Part 6: Key Takeaways

### The Core Issue
**Railway's service-to-service variable injection + node-postgres environment variable precedence = Your connectionString gets overridden**

### The Solution
**Delete PG* environment variables before Pool creation to force use of connectionString**

### Prevention
1. Remove unused Railway PostgreSQL services
2. Always delete PG* vars when using external databases
3. Add diagnostic logging to expose hidden env vars
4. Verify Railway variables don't have name prefixes in values

---

## Part 7: Reference Links

- [Railway PostgreSQL Variables Documentation](https://github.com/railwayapp/docs/blob/main/src/docs/guides/postgresql.md#connect)
- [node-postgres Environment Variables](https://github.com/brianc/node-postgres/blob/master/docs/pages/features/connecting.mdx#environment-variables)
- [Supabase Transaction Pooler](https://supabase.com/docs/guides/database/connecting-to-postgres#supavisor-transaction-mode)
- [Railway Variables Reference](https://docs.railway.com/reference/variables)

---

## Success Indicators

After applying fixes, you should see:

```
[pg-env-before-cleanup] { PGHOST: undefined, ... }  ← Or shows Railway's injection
[supabase-url] { host: 'aws-1-ap-southeast-2.pooler.supabase.com', port: '6543', ... }
[pg-env-after-cleanup] All PG* environment variables deleted
[pool-config] { hasConnectionString: true, ssl: {...}, ... }
[INFO] [worker] Database connection established successfully ✅
[INFO] [worker] Worker started, polling for jobs... ✅
```

---

**Document Version:** 1.0  
**Date:** January 2025  
**Issue:** ENOTFOUND base / Railway PG* env var override  
**Status:** ✅ Resolved

