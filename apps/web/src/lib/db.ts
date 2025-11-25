import { Pool } from 'pg';

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

  // Remove any sslmode from connection string - we'll handle SSL via Pool config
  try {
    const url = new URL(connectionString);
    url.searchParams.delete('sslmode');
    connectionString = url.toString();
  } catch {
    // If URL parsing fails, continue with original string
  }

  const pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 10_000,
    // CRITICAL: Supabase uses SSL but their cert chain needs this setting
    ssl: {
      rejectUnauthorized: false,
    },
  });

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

