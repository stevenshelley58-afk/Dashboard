-- Transform functions for marketing platforms
-- These transform staging data into core_warehouse fact tables

-- Meta insights transform
CREATE OR REPLACE FUNCTION core_warehouse.transform_meta_insights()
RETURNS void AS $$
BEGIN
    INSERT INTO core_warehouse.fact_marketing_daily (
        shop_id, date, platform, spend, impressions, clicks, conversions, revenue, currency
    )
    SELECT 
        shop_id,
        (raw_data->>'date')::date as date,
        'META' as platform,
        (raw_data->>'spend')::numeric as spend,
        (raw_data->>'impressions')::integer as impressions,
        (raw_data->>'clicks')::integer as clicks,
        (raw_data->>'conversions')::integer as conversions,
        (raw_data->>'revenue')::numeric as revenue,
        COALESCE((raw_data->>'currency')::text, 'USD') as currency
    FROM staging_ingest.meta_insights_raw
    ON CONFLICT (shop_id, date, platform) 
    DO UPDATE SET
        spend = EXCLUDED.spend,
        impressions = EXCLUDED.impressions,
        clicks = EXCLUDED.clicks,
        conversions = EXCLUDED.conversions,
        revenue = EXCLUDED.revenue,
        currency = EXCLUDED.currency,
        updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- GA4 report transform
CREATE OR REPLACE FUNCTION core_warehouse.transform_ga4_report()
RETURNS void AS $$
BEGIN
    INSERT INTO core_warehouse.fact_ga4_daily (
        shop_id, date, sessions, users, pageviews, conversions, revenue, currency
    )
    SELECT 
        shop_id,
        (raw_data->>'date')::date as date,
        (raw_data->>'sessions')::integer as sessions,
        (raw_data->>'users')::integer as users,
        (raw_data->>'pageviews')::integer as pageviews,
        (raw_data->>'conversions')::numeric as conversions,
        (raw_data->>'revenue')::numeric as revenue,
        COALESCE((raw_data->>'currency')::text, 'USD') as currency
    FROM staging_ingest.ga4_report_raw
    ON CONFLICT (shop_id, date) 
    DO UPDATE SET
        sessions = EXCLUDED.sessions,
        users = EXCLUDED.users,
        pageviews = EXCLUDED.pageviews,
        conversions = EXCLUDED.conversions,
        revenue = EXCLUDED.revenue,
        currency = EXCLUDED.currency,
        updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- Klaviyo metrics transform
CREATE OR REPLACE FUNCTION core_warehouse.transform_klaviyo_metrics()
RETURNS void AS $$
BEGIN
    INSERT INTO core_warehouse.fact_email_daily (
        shop_id, date, emails_sent, emails_delivered, opens, clicks, unsubscribes, revenue, currency
    )
    SELECT 
        shop_id,
        (raw_data->>'date')::date as date,
        (raw_data->>'emails_sent')::integer as emails_sent,
        (raw_data->>'emails_delivered')::integer as emails_delivered,
        (raw_data->>'opens')::integer as opens,
        (raw_data->>'clicks')::integer as clicks,
        (raw_data->>'unsubscribes')::integer as unsubscribes,
        (raw_data->>'revenue')::numeric as revenue,
        COALESCE((raw_data->>'currency')::text, 'USD') as currency
    FROM staging_ingest.klaviyo_metrics_raw
    ON CONFLICT (shop_id, date) 
    DO UPDATE SET
        emails_sent = EXCLUDED.emails_sent,
        emails_delivered = EXCLUDED.emails_delivered,
        opens = EXCLUDED.opens,
        clicks = EXCLUDED.clicks,
        unsubscribes = EXCLUDED.unsubscribes,
        revenue = EXCLUDED.revenue,
        currency = EXCLUDED.currency,
        updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION core_warehouse.transform_meta_insights() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION core_warehouse.transform_ga4_report() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION core_warehouse.transform_klaviyo_metrics() TO postgres, service_role;

