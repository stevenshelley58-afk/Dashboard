## Phase 0 API & Frontend

### 1. Principles

- **Audience**
  - Non-technical users.

- **Architecture**
  - Frontend only hits backend API.
  - Only aggregates and limited facts exposed.

### 2. Endpoints

#### 1) `GET /api/dashboard/home`

- **Input**
  - `period`: `today`, `yesterday`, `last_7`, `last_30` (and implied `account_id` from auth).

- **Output**
  - `latest_kpis` for account + period.
  - Time series from `daily_summary`.

#### 2) `GET /api/dashboard/shopify`

- **Input**
  - `shop_id`, date range (auth gives `account_id`).

- **Output**
  - Series: `daily_shopify_metrics`.
  - Optional orders: from `fact_orders` (date, number, `total_net`, status).

#### 3) `GET /api/dashboard/meta`

- **Input**
  - `ad_account_id`, date range (auth gives `account_id`).

- **Output**
  - Series: `daily_meta_metrics`.

#### 4) `GET /api/settings/sync-status`

- **Input**
  - (auth gives `account_id`).

- **Output per integration**
  - `type`
  - `status`
  - `last_successful_sync`
  - `last_attempted_sync`
  - `data_fresh_to`:
    - Shopify: max `order_date` in `fact_orders` for that integration.
    - Meta: max `date` in `fact_meta_daily`.

### 3. Manual Sync API

#### `POST /api/settings/manual-sync`

- **Body**
  - `{ integration_id, job_type }`
  - `job_type ∈ { shopify_7d_fill, shopify_fresh, meta_7d_fill, meta_fresh }`.

- **Behaviour**
  - Creates `sync_runs` row with `status='queued'`, `trigger='user_click'`.
  - Worker picks up queued runs and executes jobs.


