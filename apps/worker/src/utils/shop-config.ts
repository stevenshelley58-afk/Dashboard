/** Utilities for shop configuration and timezone/currency handling */
import type { PoolClient } from 'pg';
import { logger } from './logger.js';

const log = logger('shop-config');

export interface ShopConfig {
  shopId: string;
  timezone: string;
  currency: string;
  domain?: string;
  name?: string;
}

/**
 * Get shop configuration from database
 */
export async function getShopConfig(
  shopId: string,
  client: PoolClient
): Promise<ShopConfig> {
  const result = await client.query(
    `SELECT shop_id, shop_domain as domain, shop_name as name, timezone, currency
     FROM core_warehouse.shops
     WHERE shop_id = $1`,
    [shopId]
  );

  if (result.rows.length === 0) {
    throw new Error(`Shop ${shopId} not found in core_warehouse.shops`);
  }

  const row = result.rows[0];
  return {
    shopId: row.shop_id,
    timezone: row.timezone || 'UTC',
    currency: row.currency || 'USD',
    domain: row.domain,
    name: row.name,
  };
}

/**
 * Normalize date to shop's timezone
 */
export function normalizeDate(date: Date | string, timezone: string): string {
  const inputDate = typeof date === 'string' ? new Date(date) : date;

  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(inputDate);
  } catch (error) {
    log.warn(`Failed to normalize date for timezone ${timezone}:`, error);
    return inputDate.toISOString().split('T')[0];
  }
}

/**
 * Convert currency amount (placeholder - in production use a currency conversion service)
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): number {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  // Placeholder: In production, use a currency conversion API
  log.warn(`Currency conversion not implemented: ${fromCurrency} to ${toCurrency}`);
  return amount;
}

