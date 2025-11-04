-- Marketing fact tables
-- Normalized to (shop_id, date) with canonical currency and timezone

-- Marketing daily fact table (Meta, etc.)
CREATE TABLE IF NOT EXISTS core_warehouse.fact_marketing_daily (
    shop_id text NOT NULL,
    date date NOT NULL,
    platform text NOT NULL CHECK (platform IN ('META', 'GA4', 'KLAVIYO')),
    spend numeric(10, 2) DEFAULT 0,
    impressions integer DEFAULT 0,
    clicks integer DEFAULT 0,
    conversions integer DEFAULT 0,
    revenue numeric(10, 2) DEFAULT 0,
    currency text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (shop_id, date, platform)
);

-- GA4 daily fact table
CREATE TABLE IF NOT EXISTS core_warehouse.fact_ga4_daily (
    shop_id text NOT NULL,
    date date NOT NULL,
    sessions integer DEFAULT 0,
    users integer DEFAULT 0,
    pageviews integer DEFAULT 0,
    conversions integer DEFAULT 0,
    revenue numeric(10, 2) DEFAULT 0,
    currency text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (shop_id, date)
);

-- Email marketing daily fact table (Klaviyo)
CREATE TABLE IF NOT EXISTS core_warehouse.fact_email_daily (
    shop_id text NOT NULL,
    date date NOT NULL,
    emails_sent integer DEFAULT 0,
    emails_delivered integer DEFAULT 0,
    opens integer DEFAULT 0,
    clicks integer DEFAULT 0,
    unsubscribes integer DEFAULT 0,
    revenue numeric(10, 2) DEFAULT 0,
    currency text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (shop_id, date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fact_marketing_daily_shop_date ON core_warehouse.fact_marketing_daily(shop_id, date);
CREATE INDEX IF NOT EXISTS idx_fact_ga4_daily_shop_date ON core_warehouse.fact_ga4_daily(shop_id, date);
CREATE INDEX IF NOT EXISTS idx_fact_email_daily_shop_date ON core_warehouse.fact_email_daily(shop_id, date);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA core_warehouse TO postgres, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA core_warehouse TO anon, authenticated;

