/**
 * Number utilities for parsing and clamping
 * Centralized to eliminate duplication across web and worker
 */

/**
 * Clamp a number to a valid finite value
 */
export function clampNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }
  return fallback;
}

/**
 * Parse a number from string or number input
 */
export function toNumber(value: string | number | null | undefined, fallback = 0): number {
  if (value === null || value === undefined) {
    return fallback;
  }
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

/**
 * Parse a float from string or number input
 */
export function parseNumber(value: string | number | null | undefined, fallback = 0): number {
  if (value === null || value === undefined) {
    return fallback;
  }
  const numeric = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

/**
 * Format currency for display
 */
export function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a ratio (like ROAS, MER) with appropriate precision
 */
export function formatRatio(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0.00×";
  if (value >= 100) return `${value.toFixed(0)}×`;
  if (value >= 10) return `${value.toFixed(1)}×`;
  return `${value.toFixed(2)}×`;
}

/**
 * Format a number with K/M suffix for large values
 */
export function formatCompactNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

/**
 * Format percentage change
 */
export function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value * 100).toFixed(1)}%`;
}

/**
 * Format delta value with sign
 */
export function formatDelta(value: number, currency?: string): string {
  if (!Number.isFinite(value)) return "—";
  if (currency) return formatCurrency(value, currency);
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toLocaleString()}`;
}
