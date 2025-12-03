import { NextRequest, NextResponse } from "next/server";

import { requireAccountIdFromRequest } from "@/lib/auth";
import { getDbPool } from "@/lib/db";
import type {
  ShopifyDashboardResponse,
  ShopifyDashboardSummary,
  ShopifyRecentOrder,
  ShopifyShopSummary,
  ShopifyTimeseriesPoint,
} from "@/types/shopify-dashboard";

export const dynamic = "force-dynamic";

const DEFAULT_WINDOW_DAYS = 7;
const MAX_WINDOW_DAYS = 60;
const RECENT_ORDERS_LIMIT = 20;

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function startOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function parseDateParam(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : startOfDayUtc(new Date(parsed));
}

function clampRange(from: Date, to: Date): { from: Date; to: Date } {
  if (from > to) {
    throw new ApiError(400, "`from` date must be before or equal to `to` date.");
  }

  const maxLookback = new Date(to);
  maxLookback.setUTCDate(maxLookback.getUTCDate() - (MAX_WINDOW_DAYS - 1));

  if (from < maxLookback) {
    return { from: maxLookback, to };
  }

  return { from, to };
}

function parseRange(searchParams: URLSearchParams): ShopifyDashboardResponse["range"] {
  const today = startOfDayUtc(new Date());

  const resolvedTo = parseDateParam(searchParams.get("to")) ?? today;
  const resolvedFrom =
    parseDateParam(searchParams.get("from")) ??
    (() => {
      const fallback = new Date(resolvedTo);
      fallback.setUTCDate(fallback.getUTCDate() - (DEFAULT_WINDOW_DAYS - 1));
      return fallback;
    })();

  const { from, to } = clampRange(resolvedFrom, resolvedTo);
  return { from: formatDate(from), to: formatDate(to) };
}

function toNumber(value: string | number | null | undefined, fallback = 0): number {
  if (value === null || value === undefined) {
    return fallback;
  }
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

async function resolveShopContext(
  accountId: string,
  requestedShopId: string | null
): Promise<ShopifyShopSummary> {
  const pool = getDbPool();

  if (requestedShopId) {
    const result = await pool.query<ShopifyShopSummary>(
      `
        SELECT s.shop_id, s.shop_name, s.myshopify_domain, s.currency, s.timezone
        FROM shops s
        INNER JOIN integrations i ON i.shop_id = s.shop_id
        WHERE s.shop_id = $2
          AND i.account_id = $1
          AND i.type = 'shopify'
        ORDER BY i.updated_at DESC NULLS LAST
        LIMIT 1
      `,
      [accountId, requestedShopId]
    );

    if (result.rowCount === 0) {
      throw new ApiError(404, "Shop not found for this account.");
    }

    return result.rows[0];
  }

  const result = await pool.query<ShopifyShopSummary>(
    `
      SELECT s.shop_id, s.shop_name, s.myshopify_domain, s.currency, s.timezone
      FROM integrations i
      INNER JOIN shops s ON s.shop_id = i.shop_id
      WHERE i.account_id = $1
        AND i.type = 'shopify'
      ORDER BY 
        CASE WHEN i.status = 'active' THEN 0 ELSE 1 END,
        i.updated_at DESC NULLS LAST
      LIMIT 1
    `,
    [accountId]
  );

  if (result.rowCount === 0) {
    throw new ApiError(404, "No Shopify integration found for this account.");
  }

  return result.rows[0];
}

async function fetchDailyMetrics(params: {
  accountId: string;
  shopId: string;
  from: string;
  to: string;
}): Promise<ShopifyTimeseriesPoint[]> {
  const pool = getDbPool();
  const result = await pool.query(
    `
      SELECT date::date AS date,
             orders,
             revenue_gross,
             revenue_net,
             refunds,
             aov
      FROM daily_shopify_metrics
      WHERE account_id = $1
        AND shop_id = $2
        AND date BETWEEN $3::date AND $4::date
      ORDER BY date ASC
    `,
    [params.accountId, params.shopId, params.from, params.to]
  );

  return result.rows.map((row) => ({
    date: row.date,
    orders: toNumber(row.orders),
    revenue_gross: toNumber(row.revenue_gross),
    revenue_net: toNumber(row.revenue_net),
    refunds: toNumber(row.refunds),
    aov: row.aov === null ? null : toNumber(row.aov),
  }));
}

async function fetchRecentOrders(params: {
  accountId: string;
  shopId: string;
  from: string;
  to: string;
}): Promise<ShopifyRecentOrder[]> {
  const pool = getDbPool();
  const result = await pool.query(
    `
      SELECT fact_order_id,
             order_date::date AS order_date,
             order_number,
             order_status,
             total_net,
             currency
      FROM fact_orders
      WHERE account_id = $1
        AND shop_id = $2
        AND order_date BETWEEN $3::date AND $4::date
      ORDER BY order_date DESC, fact_order_id DESC
      LIMIT $5
    `,
    [params.accountId, params.shopId, params.from, params.to, RECENT_ORDERS_LIMIT]
  );

  return result.rows.map((row) => ({
    fact_order_id: row.fact_order_id,
    order_date: row.order_date,
    order_number: row.order_number,
    order_status: row.order_status,
    total_net: row.total_net === null ? null : toNumber(row.total_net),
    currency: row.currency,
  }));
}

interface TopProduct {
  product_id: string;
  product_title: string;
  quantity_sold: number;
  revenue: number;
  orders_count: number;
}

interface SalesByChannel {
  sales_channel: string;
  orders: number;
  revenue_net: number;
  aov: number;
}

interface SalesByLocation {
  country: string;
  region: string | null;
  orders: number;
  revenue_net: number;
  new_customers: number;
}

interface HourlySales {
  hour: number;
  orders: number;
  revenue_net: number;
}

interface EnhancedTimeseries {
  date: string;
  orders: number;
  revenue_gross: number;
  revenue_net: number;
  refunds: number;
  aov: number | null;
  total_discounts: number;
  total_shipping: number;
  total_tax: number;
  new_customers: number;
  returning_customers: number;
  returning_customer_rate: number;
}

async function fetchTopProducts(params: {
  accountId: string;
  shopId: string;
  from: string;
  to: string;
  limit?: number;
}): Promise<TopProduct[]> {
  const pool = getDbPool();
  const result = await pool.query(
    `
      SELECT
        shopify_product_id AS product_id,
        product_title,
        SUM(quantity_sold) AS quantity_sold,
        SUM(revenue) AS revenue,
        SUM(orders_count) AS orders_count
      FROM daily_product_metrics
      WHERE account_id = $1
        AND shop_id = $2
        AND date BETWEEN $3::date AND $4::date
      GROUP BY shopify_product_id, product_title
      ORDER BY SUM(revenue) DESC
      LIMIT $5
    `,
    [params.accountId, params.shopId, params.from, params.to, params.limit ?? 10]
  );

  return result.rows.map((row) => ({
    product_id: row.product_id,
    product_title: row.product_title,
    quantity_sold: toNumber(row.quantity_sold),
    revenue: toNumber(row.revenue),
    orders_count: toNumber(row.orders_count),
  }));
}

async function fetchEnhancedDailyMetrics(params: {
  accountId: string;
  shopId: string;
  from: string;
  to: string;
}): Promise<EnhancedTimeseries[]> {
  const pool = getDbPool();
  const result = await pool.query(
    `
      SELECT date::date AS date,
             orders,
             revenue_gross,
             revenue_net,
             refunds,
             aov,
             COALESCE(total_discounts, 0) AS total_discounts,
             COALESCE(total_shipping, 0) AS total_shipping,
             COALESCE(total_tax, 0) AS total_tax,
             COALESCE(new_customers, 0) AS new_customers,
             COALESCE(returning_customers, 0) AS returning_customers,
             COALESCE(returning_customer_rate, 0) AS returning_customer_rate
      FROM daily_shopify_metrics
      WHERE account_id = $1
        AND shop_id = $2
        AND date BETWEEN $3::date AND $4::date
      ORDER BY date ASC
    `,
    [params.accountId, params.shopId, params.from, params.to]
  );

  return result.rows.map((row) => ({
    date: row.date,
    orders: toNumber(row.orders),
    revenue_gross: toNumber(row.revenue_gross),
    revenue_net: toNumber(row.revenue_net),
    refunds: toNumber(row.refunds),
    aov: row.aov === null ? null : toNumber(row.aov),
    total_discounts: toNumber(row.total_discounts),
    total_shipping: toNumber(row.total_shipping),
    total_tax: toNumber(row.total_tax),
    new_customers: toNumber(row.new_customers),
    returning_customers: toNumber(row.returning_customers),
    returning_customer_rate: toNumber(row.returning_customer_rate),
  }));
}

async function fetchSalesByChannel(params: {
  accountId: string;
  shopId: string;
  from: string;
  to: string;
}): Promise<SalesByChannel[]> {
  const pool = getDbPool();
  const result = await pool.query(
    `
      SELECT
        sales_channel,
        SUM(orders) AS orders,
        SUM(revenue_net) AS revenue_net,
        CASE WHEN SUM(orders) > 0 THEN SUM(revenue_net) / SUM(orders) ELSE 0 END AS aov
      FROM daily_sales_by_channel
      WHERE account_id = $1
        AND shop_id = $2
        AND date BETWEEN $3::date AND $4::date
      GROUP BY sales_channel
      ORDER BY SUM(revenue_net) DESC
    `,
    [params.accountId, params.shopId, params.from, params.to]
  );

  return result.rows.map((row) => ({
    sales_channel: row.sales_channel,
    orders: toNumber(row.orders),
    revenue_net: toNumber(row.revenue_net),
    aov: toNumber(row.aov),
  }));
}

async function fetchSalesByLocation(params: {
  accountId: string;
  shopId: string;
  from: string;
  to: string;
  limit?: number;
}): Promise<SalesByLocation[]> {
  const pool = getDbPool();
  const result = await pool.query(
    `
      SELECT
        country,
        region,
        SUM(orders) AS orders,
        SUM(revenue_net) AS revenue_net,
        SUM(new_customers) AS new_customers
      FROM daily_sales_by_location
      WHERE account_id = $1
        AND shop_id = $2
        AND date BETWEEN $3::date AND $4::date
      GROUP BY country, region
      ORDER BY SUM(revenue_net) DESC
      LIMIT $5
    `,
    [params.accountId, params.shopId, params.from, params.to, params.limit ?? 10]
  );

  return result.rows.map((row) => ({
    country: row.country,
    region: row.region,
    orders: toNumber(row.orders),
    revenue_net: toNumber(row.revenue_net),
    new_customers: toNumber(row.new_customers),
  }));
}

async function fetchHourlySales(params: {
  accountId: string;
  shopId: string;
  from: string;
  to: string;
}): Promise<HourlySales[]> {
  const pool = getDbPool();
  const result = await pool.query(
    `
      SELECT
        hour,
        SUM(orders) AS orders,
        SUM(revenue_net) AS revenue_net
      FROM hourly_sales
      WHERE account_id = $1
        AND shop_id = $2
        AND date BETWEEN $3::date AND $4::date
      GROUP BY hour
      ORDER BY hour ASC
    `,
    [params.accountId, params.shopId, params.from, params.to]
  );

  return result.rows.map((row) => ({
    hour: toNumber(row.hour),
    orders: toNumber(row.orders),
    revenue_net: toNumber(row.revenue_net),
  }));
}

async function fetchCustomerStats(params: {
  accountId: string;
  shopId: string;
  from: string;
  to: string;
}): Promise<{
  total_customers: number;
  new_customers: number;
  returning_customers: number;
  returning_rate: number;
  avg_customer_value: number;
}> {
  const pool = getDbPool();

  // Calculate from enhanced daily metrics
  const result = await pool.query(
    `
      SELECT
        SUM(new_customers) + SUM(returning_customers) AS total_customers,
        SUM(new_customers) AS new_customers,
        SUM(returning_customers) AS returning_customers,
        CASE
          WHEN SUM(new_customers) + SUM(returning_customers) > 0 THEN
            SUM(returning_customers)::numeric / (SUM(new_customers) + SUM(returning_customers))
          ELSE 0
        END AS returning_rate,
        CASE
          WHEN SUM(new_customers) + SUM(returning_customers) > 0 THEN
            SUM(revenue_net) / (SUM(new_customers) + SUM(returning_customers))
          ELSE 0
        END AS avg_customer_value
      FROM daily_shopify_metrics
      WHERE account_id = $1
        AND shop_id = $2
        AND date BETWEEN $3::date AND $4::date
    `,
    [params.accountId, params.shopId, params.from, params.to]
  );

  const row = result.rows[0] || {};
  return {
    total_customers: toNumber(row.total_customers),
    new_customers: toNumber(row.new_customers),
    returning_customers: toNumber(row.returning_customers),
    returning_rate: toNumber(row.returning_rate),
    avg_customer_value: toNumber(row.avg_customer_value),
  };
}

interface EnhancedSummary extends ShopifyDashboardSummary {
  total_discounts: number;
  total_shipping: number;
  total_tax: number;
  new_customers: number;
  returning_customers: number;
  returning_customer_rate: number;
}

function buildEnhancedSummary(series: EnhancedTimeseries[]): EnhancedSummary {
  const totals = series.reduce(
    (acc, row) => {
      acc.orders += row.orders;
      acc.revenue_gross += row.revenue_gross;
      acc.revenue_net += row.revenue_net;
      acc.refunds += row.refunds;
      acc.total_discounts += row.total_discounts;
      acc.total_shipping += row.total_shipping;
      acc.total_tax += row.total_tax;
      acc.new_customers += row.new_customers;
      acc.returning_customers += row.returning_customers;
      return acc;
    },
    {
      orders: 0,
      revenue_gross: 0,
      revenue_net: 0,
      refunds: 0,
      total_discounts: 0,
      total_shipping: 0,
      total_tax: 0,
      new_customers: 0,
      returning_customers: 0,
    }
  );

  const aov =
    totals.orders > 0
      ? totals.revenue_net / totals.orders
      : series.length > 0
        ? series[series.length - 1].aov ?? 0
        : 0;

  const returning_customer_rate =
    totals.orders > 0
      ? totals.returning_customers / totals.orders
      : 0;

  return { ...totals, aov, returning_customer_rate };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const accountId = requireAccountIdFromRequest(request);
    const range = parseRange(request.nextUrl.searchParams);
    const shopIdParam = request.nextUrl.searchParams.get("shop_id");

    const shop = await resolveShopContext(accountId, shopIdParam);
    const queryParams = { accountId, shopId: shop.shop_id, ...range };

    const [
      timeseries,
      recentOrders,
      topProducts,
      salesByChannel,
      salesByLocation,
      hourlySales,
      customerStats,
    ] = await Promise.all([
      fetchEnhancedDailyMetrics(queryParams),
      fetchRecentOrders(queryParams),
      fetchTopProducts({ ...queryParams, limit: 10 }),
      fetchSalesByChannel(queryParams),
      fetchSalesByLocation({ ...queryParams, limit: 10 }),
      fetchHourlySales(queryParams),
      fetchCustomerStats(queryParams),
    ]);

    const summary = buildEnhancedSummary(timeseries);

    const payload = {
      shop,
      range,
      summary,
      timeseries,
      recentOrders,
      topProducts,
      salesByChannel,
      salesByLocation,
      hourlySales,
      customerStats,
      meta: {
        hasData: timeseries.length > 0 || recentOrders.length > 0,
      },
    };

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to load Shopify dashboard data", error);
    return NextResponse.json(
      { error: "Unexpected error fetching Shopify dashboard data." },
      { status: 500 }
    );
  }
}




