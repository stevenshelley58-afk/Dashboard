-- RLS Policies for tenant isolation
-- This migration adds Row Level Security policies to all tenant tables
-- to enforce that users can only access data belonging to their account.

-- Enable RLS on all tenant tables
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_cursors ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_webhooks_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_orders_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_products_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_customers_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_insights_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_creatives_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_meta_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_shopify_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_meta_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE latest_kpis ENABLE ROW LEVEL SECURITY;

-- Create a function to get the current account_id from JWT claims
CREATE OR REPLACE FUNCTION get_current_account_id()
RETURNS UUID AS $$
BEGIN
  RETURN (current_setting('request.jwt.claims', true)::json->>'account_id')::UUID;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Accounts: Users can only see their own account
CREATE POLICY accounts_isolation_policy ON accounts
  FOR ALL
  USING (account_id = get_current_account_id());

-- Users: Users can only see users in their account
CREATE POLICY users_isolation_policy ON users
  FOR ALL
  USING (account_id = get_current_account_id());

-- Shops: Users can only see shops in their account
CREATE POLICY shops_isolation_policy ON shops
  FOR ALL
  USING (account_id = get_current_account_id());

-- Ad Accounts: Users can only see ad accounts in their account
CREATE POLICY ad_accounts_isolation_policy ON ad_accounts
  FOR ALL
  USING (account_id = get_current_account_id());

-- Integrations: Users can only see integrations in their account
CREATE POLICY integrations_isolation_policy ON integrations
  FOR ALL
  USING (account_id = get_current_account_id());

-- Integration Secrets: Accessible only through integrations in the same account
CREATE POLICY integration_secrets_isolation_policy ON integration_secrets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM integrations i
      WHERE i.integration_id = integration_secrets.integration_id
      AND i.account_id = get_current_account_id()
    )
  );

-- Sync Runs: Accessible only through integrations in the same account
CREATE POLICY sync_runs_isolation_policy ON sync_runs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM integrations i
      WHERE i.integration_id = sync_runs.integration_id
      AND i.account_id = get_current_account_id()
    )
  );

-- Sync Cursors: Accessible only through integrations in the same account
CREATE POLICY sync_cursors_isolation_policy ON sync_cursors
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM integrations i
      WHERE i.integration_id = sync_cursors.integration_id
      AND i.account_id = get_current_account_id()
    )
  );

-- Shopify Webhooks Raw: Accessible only through integrations in the same account
CREATE POLICY shopify_webhooks_raw_isolation_policy ON shopify_webhooks_raw
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM integrations i
      WHERE i.integration_id = shopify_webhooks_raw.integration_id
      AND i.account_id = get_current_account_id()
    )
  );

-- Shopify Orders Raw: Accessible only through integrations in the same account
CREATE POLICY shopify_orders_raw_isolation_policy ON shopify_orders_raw
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM integrations i
      WHERE i.integration_id = shopify_orders_raw.integration_id
      AND i.account_id = get_current_account_id()
    )
  );

-- Shopify Products Raw: Accessible only through integrations in the same account
CREATE POLICY shopify_products_raw_isolation_policy ON shopify_products_raw
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM integrations i
      WHERE i.integration_id = shopify_products_raw.integration_id
      AND i.account_id = get_current_account_id()
    )
  );

-- Shopify Customers Raw: Accessible only through integrations in the same account
CREATE POLICY shopify_customers_raw_isolation_policy ON shopify_customers_raw
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM integrations i
      WHERE i.integration_id = shopify_customers_raw.integration_id
      AND i.account_id = get_current_account_id()
    )
  );

-- Meta Insights Raw: Accessible only through integrations in the same account
CREATE POLICY meta_insights_raw_isolation_policy ON meta_insights_raw
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM integrations i
      WHERE i.integration_id = meta_insights_raw.integration_id
      AND i.account_id = get_current_account_id()
    )
  );

-- Meta Creatives Raw: Accessible only through integrations in the same account
CREATE POLICY meta_creatives_raw_isolation_policy ON meta_creatives_raw
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM integrations i
      WHERE i.integration_id = meta_creatives_raw.integration_id
      AND i.account_id = get_current_account_id()
    )
  );

-- Fact Orders: Accessible only through integrations in the same account
CREATE POLICY fact_orders_isolation_policy ON fact_orders
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM integrations i
      WHERE i.integration_id = fact_orders.integration_id
      AND i.account_id = get_current_account_id()
    )
  );

-- Fact Meta Daily: Accessible only through integrations in the same account
CREATE POLICY fact_meta_daily_isolation_policy ON fact_meta_daily
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM integrations i
      WHERE i.integration_id = fact_meta_daily.integration_id
      AND i.account_id = get_current_account_id()
    )
  );

-- Daily Shopify Metrics: Users can only see metrics for shops in their account
CREATE POLICY daily_shopify_metrics_isolation_policy ON daily_shopify_metrics
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM shops s
      WHERE s.shop_id = daily_shopify_metrics.shop_id
      AND s.account_id = get_current_account_id()
    )
  );

-- Daily Meta Metrics: Users can only see metrics for ad accounts in their account
CREATE POLICY daily_meta_metrics_isolation_policy ON daily_meta_metrics
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM ad_accounts a
      WHERE a.ad_account_id = daily_meta_metrics.ad_account_id
      AND a.account_id = get_current_account_id()
    )
  );

-- Daily Summary: Users can only see summaries for their account
CREATE POLICY daily_summary_isolation_policy ON daily_summary
  FOR ALL
  USING (account_id = get_current_account_id());

-- Latest KPIs: Users can only see KPIs for their account
CREATE POLICY latest_kpis_isolation_policy ON latest_kpis
  FOR ALL
  USING (account_id = get_current_account_id());

-- Create a bypass policy for service_role (used by worker)
-- This allows the worker to bypass RLS using the service_role key
CREATE POLICY service_role_bypass_accounts ON accounts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY service_role_bypass_users ON users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY service_role_bypass_shops ON shops
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY service_role_bypass_ad_accounts ON ad_accounts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY service_role_bypass_integrations ON integrations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY service_role_bypass_integration_secrets ON integration_secrets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY service_role_bypass_sync_runs ON sync_runs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY service_role_bypass_sync_cursors ON sync_cursors
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY service_role_bypass_shopify_webhooks_raw ON shopify_webhooks_raw
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY service_role_bypass_shopify_orders_raw ON shopify_orders_raw
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY service_role_bypass_shopify_products_raw ON shopify_products_raw
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY service_role_bypass_shopify_customers_raw ON shopify_customers_raw
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY service_role_bypass_meta_insights_raw ON meta_insights_raw
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY service_role_bypass_meta_creatives_raw ON meta_creatives_raw
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY service_role_bypass_fact_orders ON fact_orders
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY service_role_bypass_fact_meta_daily ON fact_meta_daily
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY service_role_bypass_daily_shopify_metrics ON daily_shopify_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY service_role_bypass_daily_meta_metrics ON daily_meta_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY service_role_bypass_daily_summary ON daily_summary
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY service_role_bypass_latest_kpis ON latest_kpis
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
