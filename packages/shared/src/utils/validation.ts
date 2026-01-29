/**
 * Validation utilities for common data types
 */

/**
 * Validate a UUID string
 */
export function isValidUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Validate a date string in YYYY-MM-DD format
 */
export function isValidDateString(value: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(value)) {
    return false;
  }
  
  const date = new Date(value);
  return !isNaN(date.getTime());
}

/**
 * Validate an email address
 */
export function isValidEmail(value: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

/**
 * Validate a Shopify domain
 */
export function isValidShopifyDomain(value: string): boolean {
  const domainRegex = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;
  return domainRegex.test(value);
}

/**
 * Normalize a Shopify domain
 */
export function normalizeShopifyDomain(input: string): string {
  const trimmed = input.trim().toLowerCase();
  const withoutProtocol = trimmed.replace(/^https?:\/\//, "");
  const withoutPath = withoutProtocol.split("/")[0];
  
  return withoutPath.endsWith(".myshopify.com")
    ? withoutPath
    : `${withoutPath}.myshopify.com`;
}

/**
 * Validate a currency code (3-letter ISO)
 */
export function isValidCurrencyCode(value: string): boolean {
  return /^[A-Z]{3}$/.test(value);
}

/**
 * Sanitize a string for safe display
 */
export function sanitizeString(value: string): string {
  return value
    .replace(/[<>]/g, "") // Remove potential HTML tags
    .trim();
}

/**
 * Validate that a value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Validate that a value is a positive integer
 */
export function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/**
 * Validate that a value is within a range
 */
export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}
