-- Transform functions
-- SQL functions to transform staging data into core_warehouse

-- Shopify shops transform
CREATE OR REPLACE FUNCTION core_warehouse.transform_shopify_shops()
RETURNS void AS $$
BEGIN
    INSERT INTO core_warehouse.shops (
        shop_id,
        shop_domain,
        shop_name,
        currency,
        timezone,
        updated_at
    )
    SELECT 
        raw_data->>'id' as shop_id,
        raw_data->>'domain' as shop_domain,
        raw_data->>'name' as shop_name,
        raw_data->>'currencyCode' as currency,
        raw_data->>'timezone' as timezone,
        now() as updated_at
    FROM staging_ingest.shopify_shops_raw
    ON CONFLICT (shop_id) DO UPDATE SET
        shop_domain = EXCLUDED.shop_domain,
        shop_name = EXCLUDED.shop_name,
        currency = EXCLUDED.currency,
        timezone = EXCLUDED.timezone,
        updated_at = EXCLUDED.updated_at;
END;
$$ LANGUAGE plpgsql;

-- Shopify orders transform
CREATE OR REPLACE FUNCTION core_warehouse.transform_shopify_orders()
RETURNS void AS $$
BEGIN
    INSERT INTO core_warehouse.orders (
        shop_id,
        shopify_gid,
        order_number,
        order_name,
        total_price,
        subtotal_price,
        total_tax,
        currency,
        financial_status,
        fulfillment_status,
        order_date,
        updated_at
    )
    SELECT 
        shop_id,
        raw_data->>'id' as shopify_gid,
        (raw_data->>'orderNumber')::integer as order_number,
        raw_data->>'name' as order_name,
        (raw_data->>'totalPriceSet'->>'shopMoney'->>'amount')::numeric as total_price,
        (raw_data->>'subtotalPriceSet'->>'shopMoney'->>'amount')::numeric as subtotal_price,
        (raw_data->>'totalTaxSet'->>'shopMoney'->>'amount')::numeric as total_tax,
        raw_data->>'currencyCode' as currency,
        raw_data->>'displayFinancialStatus' as financial_status,
        raw_data->>'displayFulfillmentStatus' as fulfillment_status,
        (raw_data->>'createdAt')::timestamptz as order_date,
        now() as updated_at
    FROM staging_ingest.shopify_orders_raw
    ON CONFLICT (shop_id, shopify_gid) DO UPDATE SET
        order_number = EXCLUDED.order_number,
        order_name = EXCLUDED.order_name,
        total_price = EXCLUDED.total_price,
        subtotal_price = EXCLUDED.subtotal_price,
        total_tax = EXCLUDED.total_tax,
        currency = EXCLUDED.currency,
        financial_status = EXCLUDED.financial_status,
        fulfillment_status = EXCLUDED.fulfillment_status,
        order_date = EXCLUDED.order_date,
        updated_at = EXCLUDED.updated_at;
END;
$$ LANGUAGE plpgsql;

-- Shopify line items transform
CREATE OR REPLACE FUNCTION core_warehouse.transform_shopify_line_items()
RETURNS void AS $$
BEGIN
    INSERT INTO core_warehouse.order_line_items (
        shop_id,
        shopify_gid,
        order_id,
        product_id,
        variant_id,
        title,
        variant_title,
        quantity,
        price,
        total_discount,
        updated_at
    )
    SELECT 
        shop_id,
        raw_data->>'id' as shopify_gid,
        raw_data->>'order'->>'id' as order_id,
        raw_data->>'product'->>'id' as product_id,
        raw_data->>'variant'->>'id' as variant_id,
        raw_data->>'title' as title,
        raw_data->>'variantTitle' as variant_title,
        (raw_data->>'quantity')::integer as quantity,
        (raw_data->>'originalUnitPriceSet'->>'shopMoney'->>'amount')::numeric as price,
        (raw_data->>'discountAllocations'->0->>'allocatedAmountSet'->>'shopMoney'->>'amount')::numeric as total_discount,
        now() as updated_at
    FROM staging_ingest.shopify_line_items_raw
    ON CONFLICT (shop_id, shopify_gid) DO UPDATE SET
        order_id = EXCLUDED.order_id,
        product_id = EXCLUDED.product_id,
        variant_id = EXCLUDED.variant_id,
        title = EXCLUDED.title,
        variant_title = EXCLUDED.variant_title,
        quantity = EXCLUDED.quantity,
        price = EXCLUDED.price,
        total_discount = EXCLUDED.total_discount,
        updated_at = EXCLUDED.updated_at;
END;
$$ LANGUAGE plpgsql;

-- Shopify transactions transform
CREATE OR REPLACE FUNCTION core_warehouse.transform_shopify_transactions()
RETURNS void AS $$
BEGIN
    INSERT INTO core_warehouse.transactions (
        shop_id,
        shopify_gid,
        order_id,
        kind,
        amount,
        currency,
        status,
        processed_at,
        updated_at
    )
    SELECT 
        shop_id,
        raw_data->>'id' as shopify_gid,
        raw_data->>'order'->>'id' as order_id,
        raw_data->>'kind' as kind,
        (raw_data->>'amountSet'->>'shopMoney'->>'amount')::numeric as amount,
        raw_data->>'amountSet'->>'shopMoney'->>'currencyCode' as currency,
        raw_data->>'status' as status,
        (raw_data->>'processedAt')::timestamptz as processed_at,
        now() as updated_at
    FROM staging_ingest.shopify_transactions_raw
    ON CONFLICT (shop_id, shopify_gid) DO UPDATE SET
        order_id = EXCLUDED.order_id,
        kind = EXCLUDED.kind,
        amount = EXCLUDED.amount,
        currency = EXCLUDED.currency,
        status = EXCLUDED.status,
        processed_at = EXCLUDED.processed_at,
        updated_at = EXCLUDED.updated_at;
END;
$$ LANGUAGE plpgsql;

-- Shopify payouts transform
CREATE OR REPLACE FUNCTION core_warehouse.transform_shopify_payouts()
RETURNS void AS $$
BEGIN
    INSERT INTO core_warehouse.payouts (
        shop_id,
        shopify_gid,
        payout_date,
        amount,
        currency,
        status,
        updated_at
    )
    SELECT 
        shop_id,
        raw_data->>'id' as shopify_gid,
        (raw_data->>'date')::date as payout_date,
        (raw_data->>'amount')::numeric as amount,
        raw_data->>'currency' as currency,
        raw_data->>'status' as status,
        now() as updated_at
    FROM staging_ingest.shopify_payouts_raw
    ON CONFLICT (shop_id, shopify_gid) DO UPDATE SET
        payout_date = EXCLUDED.payout_date,
        amount = EXCLUDED.amount,
        currency = EXCLUDED.currency,
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION core_warehouse.transform_shopify_shops() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION core_warehouse.transform_shopify_orders() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION core_warehouse.transform_shopify_line_items() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION core_warehouse.transform_shopify_transactions() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION core_warehouse.transform_shopify_payouts() TO postgres, service_role;

