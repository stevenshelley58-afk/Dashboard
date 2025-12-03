-- Enhanced analytics schema for full Shopify Analytics parity
-- This migration adds missing fields and tables for complete dashboard functionality

-- =====================================================
-- 1. ENHANCE fact_orders WITH COMPLETE ORDER DETAILS
-- =====================================================

-- Add missing columns to fact_orders
ALTER TABLE fact_orders
ADD COLUMN IF NOT EXISTS shopify_order_id text,
ADD COLUMN IF NOT EXISTS shopify_customer_id text,
ADD COLUMN IF NOT EXISTS customer_email text,
ADD COLUMN IF NOT EXISTS is_first_order boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS total_discounts numeric(18,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_shipping numeric(18,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_tax numeric(18,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS subtotal numeric(18,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_line_items_price numeric(18,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS fulfillment_status text,
ADD COLUMN IF NOT EXISTS financial_status text,
ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
ADD COLUMN IF NOT EXISTS closed_at timestamptz,
ADD COLUMN IF NOT EXISTS sales_channel text,
ADD COLUMN IF NOT EXISTS source_name text,
ADD COLUMN IF NOT EXISTS landing_site text,
ADD COLUMN IF NOT EXISTS referring_site text,
ADD COLUMN IF NOT EXISTS billing_country text,
ADD COLUMN IF NOT EXISTS billing_region text,
ADD COLUMN IF NOT EXISTS billing_city text,
ADD COLUMN IF NOT EXISTS shipping_country text,
ADD COLUMN IF NOT EXISTS shipping_region text,
ADD COLUMN IF NOT EXISTS shipping_city text,
ADD COLUMN IF NOT EXISTS device_type text,
ADD COLUMN IF NOT EXISTS browser text,
ADD COLUMN IF NOT EXISTS tags text[];

CREATE INDEX IF NOT EXISTS idx_fact_orders_customer
  ON fact_orders (shopify_customer_id) WHERE shopify_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fact_orders_channel
  ON fact_orders (sales_channel, order_date);

CREATE INDEX IF NOT EXISTS idx_fact_orders_location
  ON fact_orders (shipping_country, order_date);

-- =====================================================
-- 2. CUSTOMER DIMENSION TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS dim_customers (
  customer_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  shopify_customer_id text NOT NULL,
  email text,
  first_name text,
  last_name text,
  first_order_date date,
  first_order_id uuid REFERENCES fact_orders(fact_order_id),
  total_orders integer NOT NULL DEFAULT 0,
  total_spent numeric(18,2) NOT NULL DEFAULT 0,
  average_order_value numeric(18,2) NOT NULL DEFAULT 0,
  last_order_date date,
  last_order_id uuid,
  accepts_marketing boolean DEFAULT false,
  tags text[],
  country text,
  region text,
  city text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, shopify_customer_id)
);

CREATE INDEX IF NOT EXISTS idx_dim_customers_account_id
  ON dim_customers (account_id);

CREATE INDEX IF NOT EXISTS idx_dim_customers_first_order
  ON dim_customers (first_order_date);

-- =====================================================
-- 3. ENHANCED DAILY SHOPIFY METRICS
-- =====================================================

ALTER TABLE daily_shopify_metrics
ADD COLUMN IF NOT EXISTS total_discounts numeric(18,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_shipping numeric(18,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_tax numeric(18,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS returns_count integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS new_customers integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS returning_customers integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS returning_customer_rate numeric(8,4) NOT NULL DEFAULT 0;

-- =====================================================
-- 4. SALES BY CHANNEL
-- =====================================================

CREATE TABLE IF NOT EXISTS daily_sales_by_channel (
  shop_id uuid NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  date date NOT NULL,
  sales_channel text NOT NULL,
  orders integer NOT NULL DEFAULT 0,
  revenue_gross numeric(18,2) NOT NULL DEFAULT 0,
  revenue_net numeric(18,2) NOT NULL DEFAULT 0,
  aov numeric(18,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (shop_id, date, sales_channel)
);

CREATE INDEX IF NOT EXISTS idx_daily_sales_by_channel_account_date
  ON daily_sales_by_channel (account_id, date);

-- =====================================================
-- 5. SALES BY LOCATION
-- =====================================================

CREATE TABLE IF NOT EXISTS daily_sales_by_location (
  shop_id uuid NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  date date NOT NULL,
  country text NOT NULL,
  region text,
  city text,
  orders integer NOT NULL DEFAULT 0,
  revenue_net numeric(18,2) NOT NULL DEFAULT 0,
  new_customers integer NOT NULL DEFAULT 0,
  PRIMARY KEY (shop_id, date, country, COALESCE(region, ''), COALESCE(city, ''))
);

CREATE INDEX IF NOT EXISTS idx_daily_sales_by_location_account_date
  ON daily_sales_by_location (account_id, date);

-- =====================================================
-- 6. CUSTOMER COHORTS (MONTHLY)
-- =====================================================

CREATE TABLE IF NOT EXISTS monthly_customer_cohorts (
  shop_id uuid NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  cohort_month date NOT NULL, -- First day of the month when customers made their first order
  order_month date NOT NULL,  -- First day of the month for orders
  customers_count integer NOT NULL DEFAULT 0,
  orders_count integer NOT NULL DEFAULT 0,
  revenue numeric(18,2) NOT NULL DEFAULT 0,
  months_since_first integer NOT NULL DEFAULT 0, -- 0 for cohort month, 1 for next month, etc.
  PRIMARY KEY (shop_id, cohort_month, order_month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_customer_cohorts_account
  ON monthly_customer_cohorts (account_id, cohort_month);

-- =====================================================
-- 7. REFUNDS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS fact_refunds (
  fact_refund_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES integrations(integration_id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  fact_order_id uuid REFERENCES fact_orders(fact_order_id) ON DELETE SET NULL,
  shopify_refund_id text NOT NULL,
  refund_date date NOT NULL,
  refund_created_at timestamptz NOT NULL,
  refund_amount numeric(18,2) NOT NULL DEFAULT 0,
  currency char(3),
  reason text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fact_refunds_integration_refund
  ON fact_refunds (integration_id, shopify_refund_id);

CREATE INDEX IF NOT EXISTS idx_fact_refunds_shop_date
  ON fact_refunds (shop_id, refund_date);

-- =====================================================
-- 8. DISCOUNT CODE USAGE
-- =====================================================

CREATE TABLE IF NOT EXISTS daily_discount_usage (
  shop_id uuid NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  date date NOT NULL,
  discount_code text NOT NULL,
  discount_type text, -- 'percentage', 'fixed_amount', 'shipping', etc.
  times_used integer NOT NULL DEFAULT 0,
  total_discount_amount numeric(18,2) NOT NULL DEFAULT 0,
  orders_count integer NOT NULL DEFAULT 0,
  revenue_with_discount numeric(18,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (shop_id, date, discount_code)
);

CREATE INDEX IF NOT EXISTS idx_daily_discount_usage_account_date
  ON daily_discount_usage (account_id, date);

-- =====================================================
-- 9. CART ABANDONMENT TRACKING (from checkouts)
-- =====================================================

CREATE TABLE IF NOT EXISTS abandoned_checkouts (
  checkout_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES integrations(integration_id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  shopify_checkout_id text NOT NULL,
  checkout_date date NOT NULL,
  checkout_created_at timestamptz NOT NULL,
  abandoned_at timestamptz NOT NULL,
  recovered_at timestamptz,
  recovered_order_id uuid REFERENCES fact_orders(fact_order_id),
  cart_value numeric(18,2) NOT NULL DEFAULT 0,
  currency char(3),
  customer_email text,
  landing_page text,
  referring_site text,
  device_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_abandoned_checkouts_integration_checkout
  ON abandoned_checkouts (integration_id, shopify_checkout_id);

CREATE INDEX IF NOT EXISTS idx_abandoned_checkouts_shop_date
  ON abandoned_checkouts (shop_id, checkout_date);

-- =====================================================
-- 10. DAILY CART/FUNNEL METRICS
-- =====================================================

CREATE TABLE IF NOT EXISTS daily_funnel_metrics (
  shop_id uuid NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  date date NOT NULL,
  sessions integer NOT NULL DEFAULT 0,
  product_views integer NOT NULL DEFAULT 0,
  add_to_carts integer NOT NULL DEFAULT 0,
  reached_checkout integer NOT NULL DEFAULT 0,
  checkouts_started integer NOT NULL DEFAULT 0,
  checkouts_completed integer NOT NULL DEFAULT 0,
  orders_placed integer NOT NULL DEFAULT 0,
  cart_abandonment_rate numeric(8,4) NOT NULL DEFAULT 0,
  checkout_abandonment_rate numeric(8,4) NOT NULL DEFAULT 0,
  overall_conversion_rate numeric(8,4) NOT NULL DEFAULT 0,
  PRIMARY KEY (shop_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_funnel_metrics_account_date
  ON daily_funnel_metrics (account_id, date);

-- =====================================================
-- 11. HOURLY SALES (for "Sales by hour" chart)
-- =====================================================

CREATE TABLE IF NOT EXISTS hourly_sales (
  shop_id uuid NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  date date NOT NULL,
  hour integer NOT NULL CHECK (hour >= 0 AND hour <= 23),
  orders integer NOT NULL DEFAULT 0,
  revenue_net numeric(18,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (shop_id, date, hour)
);

CREATE INDEX IF NOT EXISTS idx_hourly_sales_account_date
  ON hourly_sales (account_id, date);

-- =====================================================
-- 12. AVERAGE ORDER VALUE TREND (for AOV chart)
-- Already tracked in daily_shopify_metrics, but adding a separate
-- table for more granular tracking with moving averages
-- =====================================================

CREATE TABLE IF NOT EXISTS aov_trend (
  shop_id uuid NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  date date NOT NULL,
  aov numeric(18,2) NOT NULL DEFAULT 0,
  aov_7d_avg numeric(18,2),
  aov_30d_avg numeric(18,2),
  orders_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (shop_id, date)
);

CREATE INDEX IF NOT EXISTS idx_aov_trend_account_date
  ON aov_trend (account_id, date);
