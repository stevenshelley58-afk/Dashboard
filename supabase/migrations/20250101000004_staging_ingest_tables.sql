-- Staging ingest tables (raw data from external APIs)
-- These tables are temporary and can be dropped/truncated

-- Shopify staging tables
CREATE TABLE IF NOT EXISTS staging_ingest.shopify_shops_raw (
    id bigserial PRIMARY KEY,
    shop_id text NOT NULL,
    raw_data jsonb NOT NULL,
    ingested_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staging_ingest.shopify_orders_raw (
    id bigserial PRIMARY KEY,
    shop_id text NOT NULL,
    raw_data jsonb NOT NULL,
    ingested_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staging_ingest.shopify_line_items_raw (
    id bigserial PRIMARY KEY,
    shop_id text NOT NULL,
    raw_data jsonb NOT NULL,
    ingested_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staging_ingest.shopify_transactions_raw (
    id bigserial PRIMARY KEY,
    shop_id text NOT NULL,
    raw_data jsonb NOT NULL,
    ingested_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staging_ingest.shopify_payouts_raw (
    id bigserial PRIMARY KEY,
    shop_id text NOT NULL,
    raw_data jsonb NOT NULL,
    ingested_at timestamptz NOT NULL DEFAULT now()
);

-- Marketing staging tables
CREATE TABLE IF NOT EXISTS staging_ingest.meta_insights_raw (
    id bigserial PRIMARY KEY,
    shop_id text NOT NULL,
    raw_data jsonb NOT NULL,
    ingested_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staging_ingest.ga4_report_raw (
    id bigserial PRIMARY KEY,
    shop_id text NOT NULL,
    raw_data jsonb NOT NULL,
    ingested_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staging_ingest.klaviyo_metrics_raw (
    id bigserial PRIMARY KEY,
    shop_id text NOT NULL,
    raw_data jsonb NOT NULL,
    ingested_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for staging tables
CREATE INDEX IF NOT EXISTS idx_shopify_shops_raw_shop_id ON staging_ingest.shopify_shops_raw(shop_id);
CREATE INDEX IF NOT EXISTS idx_shopify_orders_raw_shop_id ON staging_ingest.shopify_orders_raw(shop_id);
CREATE INDEX IF NOT EXISTS idx_shopify_line_items_raw_shop_id ON staging_ingest.shopify_line_items_raw(shop_id);
CREATE INDEX IF NOT EXISTS idx_shopify_transactions_raw_shop_id ON staging_ingest.shopify_transactions_raw(shop_id);
CREATE INDEX IF NOT EXISTS idx_shopify_payouts_raw_shop_id ON staging_ingest.shopify_payouts_raw(shop_id);
CREATE INDEX IF NOT EXISTS idx_meta_insights_raw_shop_id ON staging_ingest.meta_insights_raw(shop_id);
CREATE INDEX IF NOT EXISTS idx_ga4_report_raw_shop_id ON staging_ingest.ga4_report_raw(shop_id);
CREATE INDEX IF NOT EXISTS idx_klaviyo_metrics_raw_shop_id ON staging_ingest.klaviyo_metrics_raw(shop_id);

-- Grant permissions (worker needs R/W, frontend has no access)
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA staging_ingest TO postgres, service_role;

