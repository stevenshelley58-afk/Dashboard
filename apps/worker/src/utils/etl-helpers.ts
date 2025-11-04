/** Helper functions for ETL operations */
import type { PoolClient } from 'pg';
import { logger } from './logger.js';

const log = logger('etl-helpers');

/**
 * Load JSON data into staging table
 */
export async function loadToStaging(
  client: PoolClient,
  tableName: string,
  shopId: string,
  records: Array<Record<string, unknown>>
): Promise<number> {
  if (records.length === 0) {
    return 0;
  }

  log.info(`Loading ${records.length} records into ${tableName}`);

  for (const record of records) {
    await client.query(
      `INSERT INTO staging_ingest.${tableName} (shop_id, raw_data, ingested_at)
       VALUES ($1, $2, now())`,
      [shopId, JSON.stringify(record)]
    );
  }

  return records.length;
}

/**
 * Clear staging table for a shop (optional, for cleanup)
 */
export async function clearStaging(
  client: PoolClient,
  tableName: string,
  shopId: string
): Promise<void> {
  await client.query(
    `DELETE FROM staging_ingest.${tableName} WHERE shop_id = $1`,
    [shopId]
  );
  log.info(`Cleared staging table ${tableName} for shop ${shopId}`);
}

/**
 * Get date range for incremental sync
 */
export async function getIncrementalDateRange(
  client: PoolClient,
  shopId: string,
  platform: string,
  defaultDays: number = 30
): Promise<{ startDate: string; endDate: string }> {
  const cursorResult = await client.query(
    `SELECT cursor_value, last_success_at 
     FROM core_warehouse.sync_cursors 
     WHERE shop_id = $1 AND platform = $2`,
    [shopId, platform]
  );

  let startDate: string;
  if (cursorResult.rows.length > 0 && cursorResult.rows[0].cursor_value) {
    // Use last success date + 1 day to avoid duplicates
    const lastDate = new Date(cursorResult.rows[0].cursor_value);
    lastDate.setDate(lastDate.getDate() + 1);
    startDate = lastDate.toISOString().split('T')[0];
  } else {
    // If no cursor, default to N days ago
    const defaultStart = new Date(Date.now() - defaultDays * 24 * 60 * 60 * 1000);
    startDate = defaultStart.toISOString().split('T')[0];
  }

  const endDate = new Date().toISOString().split('T')[0];

  return { startDate, endDate };
}

/**
 * Get date range for historical sync
 */
export function getHistoricalDateRange(years: number = 2): { startDate: string; endDate: string } {
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(
    Date.now() - years * 365 * 24 * 60 * 60 * 1000
  ).toISOString().split('T')[0];

  return { startDate, endDate };
}

