-- Reporting views
-- Read-optimized views for frontend consumption
-- Start as VIEW, promote to MATERIALIZED VIEW if performance requires

-- Sync status view
CREATE OR REPLACE VIEW reporting.sync_status AS
SELECT 
    r.id as run_id,
    r.shop_id,
    s.shop_name,
    r.status,
    r.job_type,
    r.platform,
    r.records_synced,
    r.created_at,
    r.started_at,
    r.completed_at,
    r.error
FROM core_warehouse.etl_runs r
LEFT JOIN core_warehouse.shops s ON r.shop_id = s.shop_id
ORDER BY r.created_at DESC;

-- Daily revenue view
CREATE OR REPLACE VIEW reporting.daily_revenue AS
SELECT 
    o.shop_id,
    DATE(o.order_date) as date,
    COUNT(DISTINCT o.shopify_gid) as order_count,
    SUM(o.total_price) as revenue,
    AVG(o.total_price) as aov,
    s.currency,
    s.timezone
FROM core_warehouse.orders o
JOIN core_warehouse.shops s ON o.shop_id = s.shop_id
WHERE o.order_date IS NOT NULL
GROUP BY o.shop_id, DATE(o.order_date), s.currency, s.timezone;

-- Orders daily view
CREATE OR REPLACE VIEW reporting.orders_daily AS
SELECT 
    shop_id,
    DATE(order_date) as date,
    COUNT(*) as order_count,
    COUNT(DISTINCT financial_status) as status_count
FROM core_warehouse.orders
WHERE order_date IS NOT NULL
GROUP BY shop_id, DATE(order_date);

-- Cash to bank view (payout status and cash flow)
CREATE OR REPLACE VIEW reporting.cash_to_bank AS
SELECT 
    p.shop_id,
    p.payout_date,
    p.amount as payout_amount,
    p.currency,
    p.status as payout_status,
    COALESCE(SUM(t.amount) FILTER (WHERE t.kind = 'sale'), 0) as total_sales,
    COALESCE(SUM(t.amount) FILTER (WHERE t.kind = 'refund'), 0) as total_refunds
FROM core_warehouse.payouts p
LEFT JOIN core_warehouse.transactions t 
    ON p.shop_id = t.shop_id 
    AND DATE(t.processed_at) <= p.payout_date
GROUP BY p.shop_id, p.payout_date, p.amount, p.currency, p.status;

-- MER and ROAS view (with currency normalization)
CREATE OR REPLACE VIEW reporting.mer_roas AS
SELECT 
    m.shop_id,
    m.date,
    m.platform,
    m.spend,
    m.currency as marketing_currency,
    r.revenue,
    r.currency as revenue_currency,
    CASE 
        WHEN m.spend > 0 THEN (r.revenue / m.spend)
        ELSE NULL
    END as roas,
    CASE 
        WHEN r.revenue > 0 THEN (m.spend / r.revenue)
        ELSE NULL
    END as mer
FROM core_warehouse.fact_marketing_daily m
LEFT JOIN reporting.daily_revenue r 
    ON m.shop_id = r.shop_id 
    AND m.date = r.date
WHERE m.spend > 0 OR r.revenue > 0;

-- Grant permissions on views
GRANT SELECT ON ALL TABLES IN SCHEMA reporting TO postgres, service_role, anon, authenticated;

