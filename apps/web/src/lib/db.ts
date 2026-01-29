import { Pool } from 'pg';
import { attachDatabasePool } from '@vercel/functions';

declare global {
  var _webDbPool: Pool | undefined;
}

const globalForDb = globalThis as typeof globalThis & {
  _webDbPool?: Pool;
};

function getPool(): Pool {
  if (globalForDb._webDbPool) {
    return globalForDb._webDbPool;
  }

  // Support both Supabase-Vercel integration (POSTGRES_URL) and manual config (DATABASE_URL)
  let connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'Database connection not configured. Set POSTGRES_URL (via Supabase integration) or DATABASE_URL.'
    );
  }

  function parseKeywordParam(input: string, key: string): string | null {
    // Parse libpq-style DSN: "host=... user=... sslmode=disable"
    const re = new RegExp(String.raw`(?:^|\s)${key}=([^\s]+)`, 'i');
    const match = input.match(re);
    return match?.[1] ?? null;
  }

  function inferHostAndSslMode(input: string): { host: string | null; sslmode: string | null } {
    // First try URL format.
    try {
      const url = new URL(input);
      return {
        host: url.hostname ?? null,
        sslmode: url.searchParams.get('sslmode'),
      };
    } catch {
      // Fallback to keyword format or plain text checks.
      const host = parseKeywordParam(input, 'host');
      const sslmode = parseKeywordParam(input, 'sslmode');
      return { host, sslmode };
    }
  }

  function stripSslMode(input: string): string {
    // Ensure node-postgres doesn't infer SSL from sslmode in the connection string.
    // We control SSL via the explicit `ssl` Pool option below.
    try {
      const url = new URL(input);
      url.searchParams.delete('sslmode');
      return url.toString();
    } catch {
      // libpq-style: remove "sslmode=..." token
      return input.replace(/(?:^|\s)sslmode=[^\s]+/gi, '').trim();
    }
  }

  function safeConnInfo(input: string): { host: string | null; port: string | null; db: string | null } {
    try {
      const url = new URL(input);
      return { host: url.hostname ?? null, port: url.port || null, db: url.pathname?.replace(/^\//, '') || null };
    } catch {
      return {
        host: parseKeywordParam(input, 'host'),
        port: parseKeywordParam(input, 'port'),
        db: parseKeywordParam(input, 'dbname') ?? parseKeywordParam(input, 'database'),
      };
    }
  }

  // Enforce Supavisor transaction mode (port 6543) for serverless/Vercel
  // Transaction mode is required to avoid connection exhaustion in serverless environments
  //
  // IMPORTANT: Do NOT force SSL for local Postgres. Some local servers don't support SSL and will error:
  // "The server does not support SSL connections"
  const inferred = inferHostAndSslMode(connectionString);
  let sslMode: string | null = inferred.sslmode;
  let hostName: string | null = inferred.host;
  try {
    const url = new URL(connectionString);
    sslMode = url.searchParams.get("sslmode");
    hostName = url.hostname;
    // If port is 5432 (direct/session), warn but allow (for local dev flexibility)
    // In production, POSTGRES_URL from Supabase integration should already be port 6543
    if (url.port === '5432' && process.env.NODE_ENV === 'production') {
      console.warn(
        'Warning: Using port 5432 (session mode) in production. For serverless, use Supavisor transaction mode (port 6543).'
      );
    }
    connectionString = url.toString();
  } catch {
    // If URL parsing fails, continue with original string
  }

  // Remove any sslmode from connection string so pg doesn't override our explicit ssl option.
  connectionString = stripSslMode(connectionString);

  const isLocalHost =
    hostName === "localhost" ||
    hostName === "127.0.0.1" ||
    hostName === "::1";

  const sslDisabledByEnv = process.env.PGSSLMODE === "disable" || process.env.PGSSLMODE === "prefer";
  const sslDisabledByUrl = sslMode === "disable" || sslMode === "prefer";
  const looksLikeSupabase =
    (process.env.POSTGRES_URL && process.env.POSTGRES_URL.length > 0) ||
    /supabase\.(co|com)\b/i.test(connectionString) ||
    /pooler\./i.test(connectionString) ||
    (hostName ? /supabase\.(co|com)\b/i.test(hostName) : false);

  // In dev, default to NO SSL unless it clearly looks like Supabase or is explicitly required.
  const explicitlyRequiresSsl =
    sslMode === "require" || sslMode === "verify-ca" || sslMode === "verify-full";

  const shouldUseSsl =
    !isLocalHost &&
    !sslDisabledByEnv &&
    !sslDisabledByUrl &&
    (process.env.NODE_ENV === "production" || looksLikeSupabase || explicitlyRequiresSsl);

  // Helpful debug without leaking secrets (host/port/db only).
  if (process.env.NODE_ENV !== "production") {
    const info = safeConnInfo(connectionString);
    console.log(
      `[db] host=${info.host ?? "?"} port=${info.port ?? "?"} db=${info.db ?? "?"} ssl=${shouldUseSsl ? "on" : "off"}`
    );
  }

  const pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 10_000,
    // Supabase requires SSL; local Postgres often does not support it.
    ssl: shouldUseSsl ? { rejectUnauthorized: false } : false,
    // Transaction mode (Supavisor port 6543) does NOT support prepared statements
    // Disable them to avoid errors
    statement_timeout: 30000,
  });

  // Attach pool to Vercel's Fluid Compute lifecycle management
  // This ensures idle clients are released correctly when functions suspend
  attachDatabasePool(pool);

  // Always cache pool to prevent connection exhaustion in serverless environments
  globalForDb._webDbPool = pool;

  return pool;
}

export const getDbPool = getPool;

type HealthRow = { now: Date | string };

export async function healthCheck(): Promise<Date> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query<HealthRow>('SELECT now() AS now');
    const value = rows[0]?.now ?? new Date().toISOString();
    return value instanceof Date ? value : new Date(value);
  } finally {
    client.release();
  }
}

