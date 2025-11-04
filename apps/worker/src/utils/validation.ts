/** Validation utilities for worker */
import { z } from 'zod';

/**
 * Validate shop_id format
 */
export function validateShopId(shopId: string): boolean {
  // Basic validation - adjust pattern as needed
  return typeof shopId === 'string' && shopId.length > 0 && shopId.length <= 255;
}

/**
 * Validate date string format (YYYY-MM-DD)
 */
export function validateDate(date: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return false;
  }

  const d = new Date(date);
  return d instanceof Date && !isNaN(d.getTime());
}

/**
 * Validate date range
 */
export function validateDateRange(startDate: string, endDate: string): boolean {
  if (!validateDate(startDate) || !validateDate(endDate)) {
    return false;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  return start <= end;
}

/**
 * Sanitize shop_id for SQL queries (basic protection)
 */
export function sanitizeShopId(shopId: string): string {
  // Remove any characters that could be dangerous in SQL
  return shopId.replace(/[^a-zA-Z0-9_-]/g, '');
}

