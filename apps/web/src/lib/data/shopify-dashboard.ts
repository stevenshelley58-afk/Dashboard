import { getDbPool } from "@/lib/db";
import type {
  ShopifyDashboardResponse,
  ShopifyDashboardSummary,
  ShopifyRecentOrder,
  ShopifyShopSummary,
  ShopifyTimeseriesPoint,
} from "@/types/shopify-dashboard";

const DEFAULT_WINDOW_DAYS = 7;
const MAX_WINDOW_DAYS = 60;
const RECENT_ORDERS_LIMIT = 20;

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
    throw new Error("`from` date must be before or equal to `to` date.");
  }

  const maxLookback = new Date(to);
  maxLookback.setUTCDate(maxLookback.getUTCDate() - (MAX_WINDOW_DAYS - 1));

  if (from < maxLookback) {
    return { from: maxLookback, to };
  }

  return { from, to };
}

export function parseRange(
  fromParam: string | null,
  toParam: string | null
): ShopifyDashboardResponse["range"] {
  const today = startOfDayUtc(new Date());

  const resolvedTo = parseDateParam(toParam) ?? today;
  const resolvedFrom =
    parseDateParam(fromParam) ??
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

export async function resolveShopContext(
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
      throw new Error("Shop not found for this account.");
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
    throw new Error("No Shopify integration found for this account.");
  }

  return result.rows[0];
}

export async function fetchShopifyDailyMetrics(params: {
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

export async function fetchShopifyRecentOrders(params: {
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

export function buildShopifySummary(series: ShopifyTimeseriesPoint[]): ShopifyDashboardSummary {
  const totals = series.reduce(
    (acc, row) => {
      acc.orders += row.orders;
      acc.revenue_gross += row.revenue_gross;
      acc.revenue_net += row.revenue_net;
      acc.refunds += row.refunds;
      return acc;
    },
    { orders: 0, revenue_gross: 0, revenue_net: 0, refunds: 0 }
  );

  const aov =
    totals.orders > 0
      ? totals.revenue_net / totals.orders
      : series.length > 0
        ? series[series.length - 1].aov ?? 0
        : 0;

  return { ...totals, aov };
}



