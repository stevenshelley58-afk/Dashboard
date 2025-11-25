import { Pool } from "pg";

let pool: Pool | null = null;

function ensurePool(): Pool {
  if (pool) {
    return pool;
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Provide the Supabase connection string."
    );
  }

  pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 10_000,
    ssl: { rejectUnauthorized: false }, // Required for Supabase
  });

  return pool;
}

type HealthRow = { now: Date | string };

export async function verifyDatabaseConnection(): Promise<Date> {
  const activePool = ensurePool();
  const client = await activePool.connect();
  try {
    const { rows } = await client.query<HealthRow>("SELECT now() AS now");
    const value = rows[0]?.now ?? new Date().toISOString();
    return value instanceof Date ? value : new Date(value);
  } finally {
    client.release();
  }
}

export function getPool(): Pool {
  return ensurePool();
}

