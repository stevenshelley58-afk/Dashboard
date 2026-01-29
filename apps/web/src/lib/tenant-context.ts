/**
 * Tenant context utilities for account isolation
 * Ensures all database queries are properly scoped to the current tenant
 */

import { getDbPool } from "./db.js";

export interface TenantContext {
  accountId: string;
  userId?: string;
}

// AsyncLocalStorage for propagating tenant context through async operations
// This allows us to automatically scope queries without passing account_id everywhere
let currentTenantContext: TenantContext | null = null;

/**
 * Set the tenant context for the current async operation
 * This should be called at the start of each request
 */
export function setTenantContext(context: TenantContext): void {
  currentTenantContext = context;
}

/**
 * Get the current tenant context
 * Returns null if not set
 */
export function getTenantContext(): TenantContext | null {
  return currentTenantContext;
}

/**
 * Clear the tenant context
 * Should be called at the end of each request
 */
export function clearTenantContext(): void {
  currentTenantContext = null;
}

/**
 * Require a tenant context - throws if not set
 */
export function requireTenantContext(): TenantContext {
  const context = currentTenantContext;
  if (!context) {
    throw new Error("Tenant context is not set. Ensure setTenantContext() was called.");
  }
  return context;
}

/**
 * Verify that the current user has access to the specified account
 * This should be called before any cross-account operations
 */
export async function verifyAccountAccess(
  userId: string,
  accountId: string
): Promise<boolean> {
  const pool = getDbPool();
  
  const result = await pool.query(
    `
      SELECT 1
      FROM users
      WHERE user_id = $1
        AND account_id = $2
      LIMIT 1
    `,
    [userId, accountId]
  );
  
  return result.rowCount !== null && result.rowCount > 0;
}

/**
 * Middleware to set tenant context from auth
 * Use this in API routes to automatically set the tenant context
 */
export async function withTenantContext<T>(
  context: TenantContext,
  fn: () => Promise<T>
): Promise<T> {
  setTenantContext(context);
  try {
    return await fn();
  } finally {
    clearTenantContext();
  }
}
