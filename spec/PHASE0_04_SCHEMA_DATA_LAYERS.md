## Phase 0 Schema: Data Layers

### 1. Webhook Queue

#### `shopify_webhooks_raw`

- **Columns**
  - `webhook_id` (uuid, pk)
  - `integration_id`
  - `topic`
  - `received_at`
  - `processed_at`
  - `payload_json`

- **Webhook behaviour**
  - **Vercel route:**
    - Verify HMAC.
    - Insert row into `shopify_webhooks_raw` with 4s DB timeout.
    - On success: `200`.
    - On timeout/error: log + `500` quickly to trigger Shopify retry.

### 2. Raw Tables (Warehouse Base)

#### `shopify_orders_raw`

- **Columns**
  - `integration_id`
  - `shopify_order_id`
  - `order_created_at`
  - `order_updated_at`
  - `raw_payload` (jsonb)
- **Constraints**
  - Unique: (`integration_id`, `shopify_order_id`)

#### `shopify_products_raw`

- **Columns**
  - `integration_id`
  - `shopify_product_id`
  - `product_updated_at`
  - `raw_payload` (jsonb)

#### `shopify_customers_raw`

- **Columns**
  - `integration_id`
  - `shopify_customer_id`
  - `customer_updated_at`
  - `raw_payload` (jsonb)

#### `meta_insights_raw`

- **Columns**
  - `integration_id`
  - `platform_ad_account_id`
  - `ad_id`
  - `date`
  - `level` (`ad`)
  - `ad_effective_status` (text)
  - `last_synced_at` (timestamptz)
  - `raw_payload` (jsonb)
- **Constraints**
  - Unique: (`integration_id`, `ad_id`, `date`, `level`)

#### `meta_creatives_raw`

- **Columns**
  - `integration_id`
  - `creative_id`
  - `creative_updated_at`
  - `raw_payload` (jsonb)

### 3. Facts & Aggregates

#### `fact_orders`

- **Columns**
  - `fact_order_id` (uuid, pk)
  - `integration_id`
  - `shop_id`
  - `account_id`
  - `order_created_at`
  - `order_date`
  - `order_number`
  - `order_status`
  - `total_gross`
  - `total_net`
  - `refund_total`
  - `currency`

#### `fact_meta_daily`

- **Columns**
  - `fact_meta_daily_id` (uuid, pk)
  - `integration_id`
  - `ad_account_id`
  - `account_id`
  - `date`
  - `campaign_id`
  - `adset_id`
  - `ad_id`
  - `spend`
  - `impressions`
  - `clicks`
  - `purchases`
  - `purchase_value`

#### `daily_shopify_metrics`

- **Columns**
  - `shop_id`
  - `account_id`
  - `date`
  - `orders`
  - `revenue_gross`
  - `revenue_net`
  - `refunds`
  - `aov`

#### `daily_meta_metrics`

- **Columns**
  - `ad_account_id`
  - `account_id`
  - `date`
  - `spend`
  - `purchases`
  - `purchase_value`
  - `roas`

#### `daily_summary`

- **Columns**
  - `account_id`
  - `date`
  - `revenue_net`
  - `meta_spend`
  - `mer`
  - `orders`
  - `aov`

#### `latest_kpis`

- **Columns**
  - `account_id`
  - `as_of`
  - `period` (`today`, `yesterday`, `last_7`, `last_30`)
  - `revenue_net`
  - `meta_spend`
  - `mer`
  - `roas`
  - `aov`


