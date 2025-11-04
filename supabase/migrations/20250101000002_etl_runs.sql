-- ETL runs glue table
-- Tracks all ETL job executions

CREATE TABLE IF NOT EXISTS core_warehouse.etl_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id text NOT NULL,
    status text NOT NULL CHECK (status IN ('QUEUED', 'IN_PROGRESS', 'SUCCEEDED', 'FAILED', 'PARTIAL')),
    job_type text NOT NULL CHECK (job_type IN ('HISTORICAL', 'INCREMENTAL')),
    platform text NOT NULL CHECK (platform IN ('SHOPIFY', 'META', 'GA4', 'KLAVIYO')),
    error jsonb,
    records_synced integer,
    created_at timestamptz NOT NULL DEFAULT now(),
    started_at timestamptz,
    completed_at timestamptz
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_etl_runs_shop_id ON core_warehouse.etl_runs(shop_id);
CREATE INDEX IF NOT EXISTS idx_etl_runs_status ON core_warehouse.etl_runs(status);
CREATE INDEX IF NOT EXISTS idx_etl_runs_platform ON core_warehouse.etl_runs(platform);
CREATE INDEX IF NOT EXISTS idx_etl_runs_created_at ON core_warehouse.etl_runs(created_at DESC);

-- Partial unique index to prevent duplicate in-flight jobs
-- Only one QUEUED or IN_PROGRESS job per (shop_id, platform)
CREATE UNIQUE INDEX IF NOT EXISTS idx_etl_runs_unique_inflight 
ON core_warehouse.etl_runs(shop_id, platform) 
WHERE status IN ('QUEUED', 'IN_PROGRESS');

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON core_warehouse.etl_runs TO postgres, service_role;
GRANT SELECT ON core_warehouse.etl_runs TO anon, authenticated;

