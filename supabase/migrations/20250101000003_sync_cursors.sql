-- Sync cursors table
-- Tracks last successful sync for incremental jobs

CREATE TABLE IF NOT EXISTS core_warehouse.sync_cursors (
    shop_id text NOT NULL,
    platform text NOT NULL CHECK (platform IN ('SHOPIFY', 'META', 'GA4', 'KLAVIYO')),
    cursor_value text NOT NULL,
    last_success_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (shop_id, platform)
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_sync_cursors_shop_platform 
ON core_warehouse.sync_cursors(shop_id, platform);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON core_warehouse.sync_cursors TO postgres, service_role;
GRANT SELECT ON core_warehouse.sync_cursors TO anon, authenticated;

