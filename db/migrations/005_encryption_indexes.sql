-- Encryption verification and index improvements
-- This migration adds indexes for better query performance
-- and documents the encryption strategy for secrets

-- Add index on fact_orders.integration_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_fact_orders_integration_id 
  ON fact_orders (integration_id);

-- Add index on fact_meta_daily.integration_id for faster lookups  
CREATE INDEX IF NOT EXISTS idx_fact_meta_daily_integration_id
  ON fact_meta_daily (integration_id);

-- Add index on fact_meta_daily.ad_account_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_fact_meta_daily_ad_account_id
  ON fact_meta_daily (ad_account_id);

-- Add index on fact_orders.shop_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_fact_orders_shop_id
  ON fact_orders (shop_id);

-- Add index on daily_shopify_metrics.account_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_daily_shopify_metrics_account_id
  ON daily_shopify_metrics (account_id);

-- Add index on daily_meta_metrics.account_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_daily_meta_metrics_account_id
  ON daily_meta_metrics (account_id);

-- Add composite index for sync_runs status queries
CREATE INDEX IF NOT EXISTS idx_sync_runs_status_integration
  ON sync_runs (status, integration_id, created_at DESC);

-- Add index on shopify_orders_raw for cursor-based queries
CREATE INDEX IF NOT EXISTS idx_shopify_orders_raw_integration_updated
  ON shopify_orders_raw (integration_id, order_updated_at DESC);

-- Add index on meta_insights_raw for date-based queries
CREATE INDEX IF NOT EXISTS idx_meta_insights_raw_integration_date
  ON meta_insights_raw (integration_id, date DESC);

-- Note on encryption:
-- The integration_secrets table stores sensitive tokens.
-- Currently, encryption is handled at the application layer.
-- To verify encryption is working:
-- 1. Check that values written to value_encrypted are not plaintext
-- 2. Verify decryption happens before tokens are used
-- 3. Ensure encryption keys are stored separately from the database
--
-- If encryption is not implemented, run this to add a column for encrypted data:
-- ALTER TABLE integration_secrets ADD COLUMN IF NOT EXISTS value_encrypted_blob BYTEA;
-- Then migrate existing data and update application code to use encryption.
