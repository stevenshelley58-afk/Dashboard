-- Core warehouse tables for Shopify data
-- Clean, typed, relational source of truth

-- Shops table
CREATE TABLE IF NOT EXISTS core_warehouse.shops (
    shop_id text PRIMARY KEY,
    shop_domain text NOT NULL,
    shop_name text,
    currency text,
    timezone text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Orders table
CREATE TABLE IF NOT EXISTS core_warehouse.orders (
    shop_id text NOT NULL,
    shopify_gid text NOT NULL,
    order_number integer,
    order_name text,
    total_price numeric(10, 2),
    subtotal_price numeric(10, 2),
    total_tax numeric(10, 2),
    currency text,
    financial_status text,
    fulfillment_status text,
    order_date timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (shop_id, shopify_gid)
);

-- Order line items table
CREATE TABLE IF NOT EXISTS core_warehouse.order_line_items (
    shop_id text NOT NULL,
    shopify_gid text NOT NULL,
    order_id text NOT NULL, -- references shopify_gid in orders
    product_id text,
    variant_id text,
    title text,
    variant_title text,
    quantity integer,
    price numeric(10, 2),
    total_discount numeric(10, 2),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (shop_id, shopify_gid),
    FOREIGN KEY (shop_id, order_id) REFERENCES core_warehouse.orders(shop_id, shopify_gid)
);

-- Transactions table
CREATE TABLE IF NOT EXISTS core_warehouse.transactions (
    shop_id text NOT NULL,
    shopify_gid text NOT NULL,
    order_id text, -- references shopify_gid in orders
    kind text, -- sale, refund, authorization, etc.
    amount numeric(10, 2),
    currency text,
    status text,
    processed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (shop_id, shopify_gid),
    FOREIGN KEY (shop_id, order_id) REFERENCES core_warehouse.orders(shop_id, shopify_gid)
);

-- Payouts table
CREATE TABLE IF NOT EXISTS core_warehouse.payouts (
    shop_id text NOT NULL,
    shopify_gid text NOT NULL,
    payout_date date,
    amount numeric(10, 2),
    currency text,
    status text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (shop_id, shopify_gid)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_shop_id ON core_warehouse.orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON core_warehouse.orders(order_date);
CREATE INDEX IF NOT EXISTS idx_order_line_items_order_id ON core_warehouse.order_line_items(shop_id, order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON core_warehouse.transactions(shop_id, order_id);
CREATE INDEX IF NOT EXISTS idx_payouts_shop_id ON core_warehouse.payouts(shop_id);
CREATE INDEX IF NOT EXISTS idx_payouts_payout_date ON core_warehouse.payouts(payout_date);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA core_warehouse TO postgres, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA core_warehouse TO anon, authenticated;

