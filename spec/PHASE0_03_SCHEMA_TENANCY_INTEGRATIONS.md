## Phase 0 Schema: Tenancy & Integrations

### 1. Tenancy / Identity

#### `accounts`

- **Columns**
  - `account_id` (uuid, pk)
  - `name`
  - `plan_tier` (`agency_internal`, `client_paid`, `trial`)
  - `currency` (3-letter ISO, nullable until first integration)
  - `currency_locked_at` (timestamptz)
  - `currency_locked_by` (`shopify | meta`)
  - `created_at`

- **Currency rule**
  - First integration sets `currency`, `currency_locked_at`, `currency_locked_by`.
  - Later integrations must match currency or are rejected.

#### `users`

- **Columns**
  - `user_id` (uuid, pk)
  - `account_id` (fk → `accounts`)
  - `email`
  - `role` (`owner`, `client`, `viewer`)
  - `created_at`

#### `shops`

- **Columns**
  - `shop_id` (uuid, pk)
  - `account_id` (fk → `accounts`)
  - `myshopify_domain` (unique, lowercased)
  - `shopify_gid` (`gid://shopify/Shop/...`)
  - `shop_name`
  - `currency`
  - `timezone`
  - `status` (`active`, `disconnected`)
  - `created_at`

- **Internal rule**
  - All Shopify refs use `shop_id`, not domains.

#### `ad_accounts`

- **Columns**
  - `ad_account_id` (uuid, pk)
  - `account_id` (fk → `accounts`)
  - `platform` (`meta`)
  - `platform_ad_account_id` (e.g. `act_123456789`)
  - `display_name`
  - `currency`
  - `timezone`
  - `status` (`active`, `disconnected`)
  - `attribution_window_days` (int, default 7, allowed 1–28)
  - `created_at`

- **Attribution rule**
  - `attribution_window_days` controls Meta fresh window length.

### 2. Integrations / Secrets / Sync State

#### `integrations`

- **Columns**
  - `integration_id` (uuid, pk)
  - `account_id`
  - `type` (`shopify`, `meta`)
  - `shop_id` (fk → `shops`, nullable)
  - `ad_account_id` (fk → `ad_accounts`, nullable)
  - `status` (`connected`, `error`, `disconnected`, `pending`)
  - `created_at`
  - `updated_at`

#### `integration_secrets`

- **Columns**
  - `integration_id`
  - `key` (`shopify_offline_token`, `meta_access_token`, `meta_pixel_id`, …)
  - `value_encrypted`
  - `created_at`
  - `updated_at`

#### `sync_runs`

- **Columns**
  - `sync_run_id` (uuid, pk)
  - `integration_id`
  - `job_type` (`shopify_7d_fill`, `shopify_fresh`, `meta_7d_fill`, `meta_fresh`, `aggregate_update`)
  - `status` (`queued`, `running`, `success`, `error`)
  - `trigger` (`auto`, `user_click`, `webhook`)
  - `started_at`
  - `finished_at`
  - `error_code`
  - `error_message`
  - `stats` (jsonb)
  - `retry_count` (int, default 0)
  - `rate_limited` (bool, default false)
  - `rate_limit_reset_at` (timestamptz, nullable)

#### `sync_cursors`

- **Columns**
  - `integration_id`
  - `job_type`
  - `cursor_key`
  - `cursor_value`
  - `updated_at`

- **Key examples**
  - `last_synced_order_updated_at` (Shopify fresh).
  - `meta_last_window_end` (Meta fresh).


