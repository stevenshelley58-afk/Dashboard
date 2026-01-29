/**
 * Time utilities for date parsing, formatting, and manipulation
 * Centralized to eliminate duplication across web and worker
 */

export const DAY_IN_MS = 24 * 60 * 60 * 1000;

/**
 * Get start of day in UTC
 */
export function startOfDayUtc(value: Date = new Date()): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCFullYear()));
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * Parse YYYY-MM-DD string as UTC midnight
 */
export function parseDateOnlyUtc(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/**
 * Add days to a UTC date
 */
export function addDaysUtc(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/**
 * Calculate difference in days (inclusive)
 */
export function diffDaysInclusive(from: string, to: string): number {
  const start = parseDateOnlyUtc(from);
  const end = parseDateOnlyUtc(to);
  const diff = Math.floor((end.getTime() - start.getTime()) / 86_400_000);
  return diff + 1;
}

/**
 * Format ISO timestamp for Shopify queries
 */
export function formatIsoTimestamp(date: Date): string {
  return date.toISOString();
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get UTC today
 */
export function utcToday(): Date {
  return startOfDayUtc(new Date());
}

/**
 * Get UTC yesterday
 */
export function utcYesterday(): Date {
  const today = utcToday();
  today.setUTCDate(today.getUTCDate() - 1);
  return today;
}

/**
 * Enumerate date strings between from and to (inclusive)
 */
export function enumerateDateStrings(from: Date, to: Date): string[] {
  const dates: string[] = [];
  const cursor = startOfDayUtc(from);
  const end = startOfDayUtc(to);
  while (cursor.getTime() <= end.getTime()) {
    dates.push(formatDateOnly(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}
