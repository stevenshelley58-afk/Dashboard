-- Order line items for product-level analytics
-- This enables "Top Products by Revenue" and product performance tracking

create table if not exists fact_order_lines (
  fact_order_line_id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references integrations(integration_id) on delete cascade,
  shop_id uuid not null references shops(shop_id) on delete cascade,
  account_id uuid not null references accounts(account_id) on delete cascade,
  order_date date not null,
  order_number text not null,
  shopify_product_id text,
  shopify_variant_id text,
  product_title text not null,
  variant_title text,
  sku text,
  quantity integer not null default 1,
  unit_price numeric(18,2) not null default 0,
  line_total numeric(18,2) not null default 0,
  currency char(3),
  created_at timestamptz not null default now()
);

create index if not exists idx_fact_order_lines_integration_date
  on fact_order_lines (integration_id, order_date);

create index if not exists idx_fact_order_lines_product_id
  on fact_order_lines (shopify_product_id, order_date);

create index if not exists idx_fact_order_lines_account_date
  on fact_order_lines (account_id, order_date);

-- Daily product metrics aggregation
create table if not exists daily_product_metrics (
  shop_id uuid not null references shops(shop_id) on delete cascade,
  account_id uuid not null references accounts(account_id) on delete cascade,
  date date not null,
  shopify_product_id text not null,
  product_title text not null,
  quantity_sold integer not null default 0,
  revenue numeric(18,2) not null default 0,
  orders_count integer not null default 0,
  primary key (shop_id, date, shopify_product_id)
);

create index if not exists idx_daily_product_metrics_account_date
  on daily_product_metrics (account_id, date);

-- Sessions and traffic data from ShopifyQL
create table if not exists daily_sessions (
  shop_id uuid not null references shops(shop_id) on delete cascade,
  account_id uuid not null references accounts(account_id) on delete cascade,
  date date not null,
  sessions integer not null default 0,
  visitors integer not null default 0,
  pageviews integer not null default 0,
  add_to_carts integer not null default 0,
  checkouts_started integer not null default 0,
  orders_placed integer not null default 0,
  conversion_rate numeric(8,4) not null default 0,
  primary key (shop_id, date)
);

create index if not exists idx_daily_sessions_account_date
  on daily_sessions (account_id, date);

-- Device breakdown
create table if not exists daily_sessions_by_device (
  shop_id uuid not null references shops(shop_id) on delete cascade,
  account_id uuid not null references accounts(account_id) on delete cascade,
  date date not null,
  device_type text not null, -- 'mobile', 'desktop', 'tablet', 'other'
  sessions integer not null default 0,
  primary key (shop_id, date, device_type)
);

-- Location breakdown
create table if not exists daily_sessions_by_location (
  shop_id uuid not null references shops(shop_id) on delete cascade,
  account_id uuid not null references accounts(account_id) on delete cascade,
  date date not null,
  country text not null,
  region text,
  city text,
  sessions integer not null default 0,
  primary key (shop_id, date, country, COALESCE(region, ''), COALESCE(city, ''))
);

-- Referrer/traffic source breakdown
create table if not exists daily_sessions_by_referrer (
  shop_id uuid not null references shops(shop_id) on delete cascade,
  account_id uuid not null references accounts(account_id) on delete cascade,
  date date not null,
  referrer_source text not null, -- 'facebook', 'google', 'direct', etc.
  referrer_name text,
  sessions integer not null default 0,
  revenue numeric(18,2) not null default 0,
  primary key (shop_id, date, referrer_source)
);

-- Landing page performance
create table if not exists daily_landing_pages (
  shop_id uuid not null references shops(shop_id) on delete cascade,
  account_id uuid not null references accounts(account_id) on delete cascade,
  date date not null,
  landing_page_path text not null,
  sessions integer not null default 0,
  primary key (shop_id, date, landing_page_path)
);
