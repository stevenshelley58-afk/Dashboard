-- Core tenancy + Shopify data layer schema

create table if not exists accounts (
  account_id uuid primary key default gen_random_uuid(),
  name text not null,
  plan_tier text not null check (plan_tier in ('agency_internal', 'client_paid', 'trial')),
  currency char(3),
  currency_locked_at timestamptz,
  currency_locked_by text check (currency_locked_by in ('shopify', 'meta')),
  created_at timestamptz not null default now()
);

create table if not exists users (
  user_id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(account_id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'client', 'viewer')),
  created_at timestamptz not null default now()
);

create unique index if not exists idx_users_account_email
  on users (account_id, lower(email));

create table if not exists shops (
  shop_id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(account_id) on delete cascade,
  myshopify_domain text not null,
  shopify_gid text,
  shop_name text,
  currency char(3),
  timezone text,
  status text not null default 'active' check (status in ('active', 'disconnected')),
  created_at timestamptz not null default now()
);

create unique index if not exists idx_shops_domain_lower
  on shops (lower(myshopify_domain));

create table if not exists ad_accounts (
  ad_account_id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(account_id) on delete cascade,
  platform text not null default 'meta' check (platform in ('meta')),
  platform_ad_account_id text not null,
  display_name text,
  currency char(3),
  timezone text,
  status text not null default 'active' check (status in ('active', 'disconnected')),
  attribution_window_days integer not null default 7 check (attribution_window_days between 1 and 28),
  created_at timestamptz not null default now(),
  unique (platform, platform_ad_account_id)
);

create table if not exists integrations (
  integration_id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(account_id) on delete cascade,
  type text not null check (type in ('shopify', 'meta')),
  shop_id uuid references shops(shop_id),
  ad_account_id uuid references ad_accounts(ad_account_id),
  status text not null default 'pending' check (status in ('connected', 'error', 'disconnected', 'pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_integrations_account_id
  on integrations (account_id);

create table if not exists integration_secrets (
  integration_id uuid not null references integrations(integration_id) on delete cascade,
  key text not null,
  value_encrypted text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (integration_id, key)
);

create table if not exists sync_cursors (
  integration_id uuid not null references integrations(integration_id) on delete cascade,
  job_type text not null,
  cursor_key text not null,
  cursor_value text not null,
  updated_at timestamptz not null default now(),
  primary key (integration_id, job_type, cursor_key)
);

create table if not exists shopify_webhooks_raw (
  webhook_id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references integrations(integration_id) on delete cascade,
  topic text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  payload_json jsonb not null
);

create index if not exists idx_shopify_webhooks_integration_topic
  on shopify_webhooks_raw (integration_id, topic, received_at desc);

create table if not exists shopify_orders_raw (
  integration_id uuid not null references integrations(integration_id) on delete cascade,
  shopify_order_id text not null,
  order_created_at timestamptz not null,
  order_updated_at timestamptz not null,
  raw_payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (integration_id, shopify_order_id)
);

create index if not exists idx_shopify_orders_raw_updated_at
  on shopify_orders_raw (integration_id, order_updated_at desc);

create table if not exists shopify_products_raw (
  integration_id uuid not null references integrations(integration_id) on delete cascade,
  shopify_product_id text not null,
  product_updated_at timestamptz not null,
  raw_payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (integration_id, shopify_product_id)
);

create index if not exists idx_shopify_products_raw_updated_at
  on shopify_products_raw (integration_id, product_updated_at desc);

create table if not exists shopify_customers_raw (
  integration_id uuid not null references integrations(integration_id) on delete cascade,
  shopify_customer_id text not null,
  customer_updated_at timestamptz not null,
  raw_payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (integration_id, shopify_customer_id)
);

create index if not exists idx_shopify_customers_raw_updated_at
  on shopify_customers_raw (integration_id, customer_updated_at desc);

create table if not exists meta_insights_raw (
  integration_id uuid not null references integrations(integration_id) on delete cascade,
  platform_ad_account_id text not null,
  ad_id text not null,
  date date not null,
  level text not null,
  ad_effective_status text,
  last_synced_at timestamptz not null default now(),
  raw_payload jsonb not null,
  primary key (integration_id, ad_id, date, level)
);

create index if not exists idx_meta_insights_raw_date
  on meta_insights_raw (integration_id, date);

create table if not exists meta_creatives_raw (
  integration_id uuid not null references integrations(integration_id) on delete cascade,
  creative_id text not null,
  creative_updated_at timestamptz,
  raw_payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (integration_id, creative_id)
);

create index if not exists idx_meta_creatives_raw_updated_at
  on meta_creatives_raw (integration_id, creative_updated_at desc nulls last);

create table if not exists fact_orders (
  fact_order_id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references integrations(integration_id) on delete cascade,
  shop_id uuid not null references shops(shop_id) on delete cascade,
  account_id uuid not null references accounts(account_id) on delete cascade,
  order_created_at timestamptz not null,
  order_date date not null,
  order_number text not null,
  order_status text,
  total_gross numeric(18,2) not null default 0,
  total_net numeric(18,2) not null default 0,
  refund_total numeric(18,2) not null default 0,
  currency char(3)
);

create unique index if not exists idx_fact_orders_integration_order_number
  on fact_orders (integration_id, order_number);

create index if not exists idx_fact_orders_shop_date
  on fact_orders (shop_id, order_date);

create table if not exists fact_meta_daily (
  fact_meta_daily_id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references integrations(integration_id) on delete cascade,
  ad_account_id uuid not null references ad_accounts(ad_account_id) on delete cascade,
  account_id uuid not null references accounts(account_id) on delete cascade,
  date date not null,
  campaign_id text,
  adset_id text,
  ad_id text,
  spend numeric(18,2) not null default 0,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  purchases integer not null default 0,
  purchase_value numeric(18,2) not null default 0
);

create index if not exists idx_fact_meta_daily_account_date
  on fact_meta_daily (account_id, date);

create index if not exists idx_fact_meta_daily_integration_date
  on fact_meta_daily (integration_id, date);

create table if not exists daily_shopify_metrics (
  shop_id uuid not null references shops(shop_id) on delete cascade,
  account_id uuid not null references accounts(account_id) on delete cascade,
  date date not null,
  orders integer not null default 0,
  revenue_gross numeric(18,2) not null default 0,
  revenue_net numeric(18,2) not null default 0,
  refunds numeric(18,2) not null default 0,
  aov numeric(18,2) not null default 0,
  primary key (shop_id, date)
);

create table if not exists daily_meta_metrics (
  ad_account_id uuid not null references ad_accounts(ad_account_id) on delete cascade,
  account_id uuid not null references accounts(account_id) on delete cascade,
  date date not null,
  spend numeric(18,2) not null default 0,
  purchases integer not null default 0,
  purchase_value numeric(18,2) not null default 0,
  roas numeric(18,2),
  primary key (ad_account_id, date)
);

create table if not exists daily_summary (
  account_id uuid not null references accounts(account_id) on delete cascade,
  date date not null,
  revenue_net numeric(18,2) not null default 0,
  meta_spend numeric(18,2) not null default 0,
  mer numeric(18,2),
  orders integer not null default 0,
  aov numeric(18,2) not null default 0,
  primary key (account_id, date)
);

create table if not exists latest_kpis (
  account_id uuid not null references accounts(account_id) on delete cascade,
  period text not null check (period in ('today', 'yesterday', 'last_7', 'last_30')),
  as_of timestamptz not null default now(),
  revenue_net numeric(18,2) not null default 0,
  meta_spend numeric(18,2) not null default 0,
  mer numeric(18,2),
  roas numeric(18,2),
  aov numeric(18,2),
  primary key (account_id, period)
);

create index if not exists idx_latest_kpis_account_asof
  on latest_kpis (account_id, as_of desc);

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_name = 'sync_runs_integration_id_fkey'
      and table_name = 'sync_runs'
  ) then
    alter table sync_runs
      add constraint sync_runs_integration_id_fkey
      foreign key (integration_id) references integrations(integration_id) on delete cascade;
  end if;
end $$;


