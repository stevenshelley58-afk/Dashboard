import type { Pool, PoolClient } from "pg";

import type { JobType } from "../job-types.js";
import type { SyncRunRecord } from "../types/sync-run.js";
import { sleep } from "../utils/time.js";
import { rebuildDailySummary } from "./daily-summary.js";

const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION ?? "2025-01";
const SHOPIFY_PAGE_SIZE = 100;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const CURSOR_KEY = "last_synced_order_updated_at";
const CURSOR_JOB_TYPE: JobType = "shopify_fresh";

interface JobResult {
  stats?: Record<string, unknown>;
}

interface ShopifyIntegrationDetails {
  integrationId: string;
  accountId: string;
  shopId: string;
  shopDomain: string;
  accessToken: string;
  currency: string | null;
  timezone: string | null;
}

interface ShopifyMoney {
  amount?: string | number | null;
  currencyCode?: string | null;
}

interface ShopifyLineItemNode {
  id: string;
  title: string;
  variantTitle: string | null;
  sku: string | null;
  quantity: number;
  product?: {
    id: string;
    title: string;
  } | null;
  variant?: {
    id: string;
    title: string | null;
    sku: string | null;
  } | null;
  originalUnitPriceSet?: { shopMoney?: ShopifyMoney | null } | null;
  discountedUnitPriceSet?: { shopMoney?: ShopifyMoney | null } | null;
}

interface ShopifyOrderNode {
  id: string;
  name: string | null;
  orderNumber: number | null;
  createdAt: string;
  updatedAt: string;
  displayFinancialStatus: string | null;
  displayFulfillmentStatus: string | null;
  currencyCode: string | null;
  currentTotalPriceSet?: { shopMoney?: ShopifyMoney | null } | null;
  totalPriceSet?: { shopMoney?: ShopifyMoney | null } | null;
  subtotalPriceSet?: { shopMoney?: ShopifyMoney | null } | null;
  totalRefundedSet?: { shopMoney?: ShopifyMoney | null } | null;
  lineItems?: {
    edges: Array<{
      node: ShopifyLineItemNode;
    }>;
  } | null;
}

interface ShopifyOrdersResponse {
  orders: {
    edges: Array<{
      cursor: string;
      node: ShopifyOrderNode;
    }>;
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
  } | null;
}

interface ShopifyThrottleStatus {
  currentlyAvailable: number;
  maximumAvailable: number;
  restoreRate: number;
  requestedQueryCost?: number;
}

interface GraphqlResponse<T> {
  data: T;
  throttleStatus?: ShopifyThrottleStatus;
}

interface NormalizedLineItem {
  shopifyProductId: string | null;
  shopifyVariantId: string | null;
  productTitle: string;
  variantTitle: string | null;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface NormalizedShopifyOrder {
  shopifyOrderId: string;
  orderName: string;
  orderCreatedAt: string;
  orderUpdatedAt: string;
  orderDate: string;
  orderStatus: string | null;
  totalGross: number;
  totalNet: number;
  refundTotal: number;
  currencyCode: string | null;
  lineItems: NormalizedLineItem[];
  raw: ShopifyOrderNode;
}

interface FetchOrdersResult {
  orders: NormalizedShopifyOrder[];
  maxUpdatedAt: string | null;
  apiCalls: number;
}

function toDateOnly(value: string): string {
  return value.slice(0, 10);
}

function parseMoney(money?: ShopifyMoney | null): number {
  if (!money) {
    return 0;
  }
  const raw = typeof money.amount === "string" ? Number.parseFloat(money.amount) : money.amount;
  if (!raw || Number.isNaN(raw)) {
    return 0;
  }
  return raw;
}

function normalizeOrderStatus(node: ShopifyOrderNode): string | null {
  const segments = [node.displayFinancialStatus, node.displayFulfillmentStatus].filter(
    (segment): segment is string => Boolean(segment)
  );
  if (segments.length === 0) {
    return null;
  }
  return segments.join(" / ");
}

function extractGid(gid: string | null | undefined, type: string): string | null {
  if (!gid) return null;
  const match = gid.match(new RegExp(`gid://shopify/${type}/(\\d+)`));
  return match ? match[1] : gid;
}

function normalizeLineItems(node: ShopifyOrderNode): NormalizedLineItem[] {
  const edges = node.lineItems?.edges ?? [];
  return edges.map(({ node: item }) => {
    const unitPrice = parseMoney(item.discountedUnitPriceSet?.shopMoney) ||
                      parseMoney(item.originalUnitPriceSet?.shopMoney);
    const lineTotal = unitPrice * item.quantity;

    return {
      shopifyProductId: extractGid(item.product?.id, 'Product'),
      shopifyVariantId: extractGid(item.variant?.id, 'ProductVariant'),
      productTitle: item.product?.title ?? item.title ?? 'Unknown Product',
      variantTitle: item.variant?.title ?? item.variantTitle,
      sku: item.variant?.sku ?? item.sku,
      quantity: item.quantity,
      unitPrice,
      lineTotal,
    };
  });
}

function normalizeOrder(node: ShopifyOrderNode): NormalizedShopifyOrder {
  const currencyCode =
    node.currencyCode ??
    node.currentTotalPriceSet?.shopMoney?.currencyCode ??
    node.totalPriceSet?.shopMoney?.currencyCode ??
    null;

  const gross =
    parseMoney(node.currentTotalPriceSet?.shopMoney) || parseMoney(node.totalPriceSet?.shopMoney);
  const refunds = parseMoney(node.totalRefundedSet?.shopMoney);
  const net = Math.max(gross - refunds, 0);

  const orderName =
    node.name ??
    (typeof node.orderNumber === "number"
      ? `#${node.orderNumber}`
      : node.id.replace("gid://shopify/Order/", "order_"));

  return {
    shopifyOrderId: node.id,
    orderName,
    orderCreatedAt: node.createdAt,
    orderUpdatedAt: node.updatedAt,
    orderDate: toDateOnly(node.createdAt),
    orderStatus: normalizeOrderStatus(node),
    totalGross: gross,
    totalNet: net,
    refundTotal: refunds,
    currencyCode,
    lineItems: normalizeLineItems(node),
    raw: node,
  };
}

async function callShopifyGraphql<T>(
  integration: ShopifyIntegrationDetails,
  payload: Record<string, unknown>
): Promise<GraphqlResponse<T>> {
  const response = await fetch(
    `https://${integration.shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Shopify-Access-Token": integration.accessToken,
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Shopify GraphQL request failed (${response.status}): ${errorBody.slice(0, 500)}`
    );
  }

  const json = (await response.json()) as {
    data?: T;
    errors?: Array<{ message: string }>;
    extensions?: { cost?: { throttleStatus?: ShopifyThrottleStatus } };
  };

  if (!json.data) {
    const message = json.errors?.map((err) => err.message).join("; ") ?? "Unknown response error";
    throw new Error(`Shopify GraphQL returned no data: ${message}`);
  }

  if (json.errors?.length) {
    const message = json.errors.map((err) => err.message).join("; ");
    throw new Error(`Shopify GraphQL error: ${message}`);
  }

  return {
    data: json.data,
    throttleStatus: json.extensions?.cost?.throttleStatus,
  };
}

function computeThrottleDelayMs(status?: ShopifyThrottleStatus): number {
  if (!status) {
    return 0;
  }

  if (status.currentlyAvailable > status.maximumAvailable * 0.2) {
    return 0;
  }

  const requested = status.requestedQueryCost ?? 0;
  if (requested === 0 || requested <= status.currentlyAvailable) {
    return 0;
  }

  const deficit = requested - status.currentlyAvailable;
  if (deficit <= 0) {
    return 0;
  }

  const restoreRate = status.restoreRate > 0 ? status.restoreRate : 50;
  const waitSeconds = deficit / restoreRate;
  return Math.ceil(waitSeconds * 1000) + 200;
}

async function fetchShopifyOrders(
  integration: ShopifyIntegrationDetails,
  query: string,
  sortKey: "CREATED_AT" | "UPDATED_AT"
): Promise<FetchOrdersResult> {
  const orders: NormalizedShopifyOrder[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;
  let apiCalls = 0;
  let maxUpdatedAt: string | null = null;

  while (hasNextPage) {
    const variables: Record<string, unknown> = {
      first: SHOPIFY_PAGE_SIZE,
      sortKey,
      query,
    };

    if (cursor) {
      variables.cursor = cursor;
    }

    const { data, throttleStatus } = await callShopifyGraphql<ShopifyOrdersResponse>(integration, {
      query: `
        query FetchOrders($first: Int!, $cursor: String, $query: String!, $sortKey: OrderSortKeys!) {
          orders(first: $first, after: $cursor, query: $query, sortKey: $sortKey) {
            edges {
              cursor
              node {
                id
                name
                createdAt
                updatedAt
                displayFinancialStatus
                displayFulfillmentStatus
                currencyCode
                currentTotalPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                totalPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                subtotalPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                totalRefundedSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                lineItems(first: 50) {
                  edges {
                    node {
                      id
                      title
                      variantTitle
                      sku
                      quantity
                      product {
                        id
                        title
                      }
                      variant {
                        id
                        title
                        sku
                      }
                      originalUnitPriceSet {
                        shopMoney {
                          amount
                          currencyCode
                        }
                      }
                      discountedUnitPriceSet {
                        shopMoney {
                          amount
                          currencyCode
                        }
                      }
                    }
                  }
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `,
      variables,
    });

    apiCalls += 1;

    const connection = data.orders;
    if (!connection) {
      break;
    }

    for (const edge of connection.edges) {
      const normalized = normalizeOrder(edge.node);
      orders.push(normalized);
      if (!maxUpdatedAt || normalized.orderUpdatedAt > maxUpdatedAt) {
        maxUpdatedAt = normalized.orderUpdatedAt;
      }
    }

    hasNextPage = connection.pageInfo.hasNextPage;
    cursor = hasNextPage ? connection.pageInfo.endCursor : null;

    const throttleDelay = computeThrottleDelayMs(throttleStatus);
    if (throttleDelay > 0) {
      await sleep(throttleDelay);
    }

    if (!hasNextPage) {
      break;
    }

    if (!cursor) {
      // Defensive: avoid infinite loop if Shopify does not return a cursor.
      console.warn(
        `Shopify returned hasNextPage=true without endCursor for integration ${integration.integrationId}. Stopping pagination.`
      );
      break;
    }
  }

  // Deduplicate by Shopify order id to avoid double-processing updates within the same run.
  const dedupedMap = new Map<string, NormalizedShopifyOrder>();
  for (const order of orders) {
    dedupedMap.set(order.shopifyOrderId, order);
  }

  return {
    orders: Array.from(dedupedMap.values()),
    maxUpdatedAt,
    apiCalls,
  };
}

async function loadShopifyIntegration(
  pool: Pool,
  integrationId: string
): Promise<ShopifyIntegrationDetails> {
  const integrationResult = await pool.query<{
    integration_id: string;
    account_id: string;
    shop_id: string | null;
    shop_domain: string | null;
    currency: string | null;
    timezone: string | null;
  }>(
    `
      SELECT 
        i.integration_id,
        i.account_id,
        i.shop_id,
        s.myshopify_domain AS shop_domain,
        s.currency,
        s.timezone
      FROM integrations i
      LEFT JOIN shops s ON s.shop_id = i.shop_id
      WHERE i.integration_id = $1
        AND i.type = 'shopify'
      LIMIT 1
    `,
    [integrationId]
  );

  if (integrationResult.rowCount === 0) {
    throw new Error(`Shopify integration ${integrationId} not found`);
  }

  const row = integrationResult.rows[0];
  if (!row.shop_id || !row.shop_domain) {
    throw new Error(`Integration ${integrationId} is missing an active Shopify shop.`);
  }

  const tokenResult = await pool.query<{ value_encrypted: string }>(
    `
      SELECT value_encrypted
      FROM integration_secrets
      WHERE integration_id = $1
        AND key = 'shopify_offline_token'
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 1
    `,
    [integrationId]
  );

  if (tokenResult.rowCount === 0) {
    throw new Error(`Integration ${integrationId} is missing a Shopify offline token.`);
  }

  return {
    integrationId,
    accountId: row.account_id,
    shopId: row.shop_id,
    shopDomain: row.shop_domain,
    accessToken: tokenResult.rows[0].value_encrypted,
    currency: row.currency,
    timezone: row.timezone,
  };
}

function buildValuesPlaceholders(rowCount: number, columns: number): string {
  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const offset = rowIndex * columns;
    const placeholders = Array.from(
      { length: columns },
      (_, columnIndex) => `$${offset + columnIndex + 1}`
    );
    return `(${placeholders.join(", ")})`;
  }).join(", ");
}

async function upsertShopifyRaw(
  client: PoolClient,
  integrationId: string,
  orders: NormalizedShopifyOrder[]
): Promise<void> {
  if (orders.length === 0) {
    return;
  }

  const columns = 5;
  const values: unknown[] = [];
  const placeholders = buildValuesPlaceholders(orders.length, columns);

  orders.forEach((order) => {
    values.push(
      integrationId,
      order.shopifyOrderId,
      order.orderCreatedAt,
      order.orderUpdatedAt,
      JSON.stringify(order.raw)
    );
  });

  await client.query(
    `
      INSERT INTO shopify_orders_raw (
        integration_id,
        shopify_order_id,
        order_created_at,
        order_updated_at,
        raw_payload
      )
      VALUES ${placeholders}
      ON CONFLICT (integration_id, shopify_order_id)
      DO UPDATE SET
        order_created_at = EXCLUDED.order_created_at,
        order_updated_at = EXCLUDED.order_updated_at,
        raw_payload = EXCLUDED.raw_payload
    `,
    values
  );
}

async function replaceFactOrders(
  client: PoolClient,
  integration: ShopifyIntegrationDetails,
  orders: NormalizedShopifyOrder[]
): Promise<void> {
  if (orders.length === 0) {
    return;
  }

  const orderNames = orders.map((order) => order.orderName);
  await client.query(
    `
      DELETE FROM fact_orders
      WHERE integration_id = $1
        AND order_number = ANY($2::text[])
    `,
    [integration.integrationId, orderNames]
  );

  const columns = 11;
  const values: unknown[] = [];
  const placeholders = buildValuesPlaceholders(orders.length, columns);

  orders.forEach((order) => {
    values.push(
      integration.integrationId,
      integration.shopId,
      integration.accountId,
      order.orderCreatedAt,
      order.orderDate,
      order.orderName,
      order.orderStatus,
      order.totalGross,
      order.totalNet,
      order.refundTotal,
      order.currencyCode ?? integration.currency ?? null
    );
  });

  await client.query(
    `
      INSERT INTO fact_orders (
        integration_id,
        shop_id,
        account_id,
        order_created_at,
        order_date,
        order_number,
        order_status,
        total_gross,
        total_net,
        refund_total,
        currency
      )
      VALUES ${placeholders}
    `,
    values
  );
}

async function replaceFactOrderLines(
  client: PoolClient,
  integration: ShopifyIntegrationDetails,
  orders: NormalizedShopifyOrder[]
): Promise<void> {
  if (orders.length === 0) {
    return;
  }

  // Collect all line items from all orders
  const allLineItems: Array<{
    orderDate: string;
    orderNumber: string;
    currencyCode: string | null;
    item: NormalizedLineItem;
  }> = [];

  for (const order of orders) {
    for (const item of order.lineItems) {
      allLineItems.push({
        orderDate: order.orderDate,
        orderNumber: order.orderName,
        currencyCode: order.currencyCode,
        item,
      });
    }
  }

  if (allLineItems.length === 0) {
    return;
  }

  // Delete existing line items for these orders
  const orderNames = orders.map((order) => order.orderName);
  await client.query(
    `
      DELETE FROM fact_order_lines
      WHERE integration_id = $1
        AND order_number = ANY($2::text[])
    `,
    [integration.integrationId, orderNames]
  );

  // Insert new line items
  const columns = 12;
  const values: unknown[] = [];
  const placeholders = buildValuesPlaceholders(allLineItems.length, columns);

  for (const { orderDate, orderNumber, currencyCode, item } of allLineItems) {
    values.push(
      integration.integrationId,
      integration.shopId,
      integration.accountId,
      orderDate,
      orderNumber,
      item.shopifyProductId,
      item.shopifyVariantId,
      item.productTitle,
      item.variantTitle,
      item.sku,
      item.quantity,
      item.unitPrice,
      item.lineTotal,
      currencyCode ?? integration.currency ?? null
    );
  }

  // Adjust columns count to match actual values
  const actualColumns = 14;
  const actualPlaceholders = buildValuesPlaceholders(allLineItems.length, actualColumns);

  await client.query(
    `
      INSERT INTO fact_order_lines (
        integration_id,
        shop_id,
        account_id,
        order_date,
        order_number,
        shopify_product_id,
        shopify_variant_id,
        product_title,
        variant_title,
        sku,
        quantity,
        unit_price,
        line_total,
        currency
      )
      VALUES ${actualPlaceholders}
    `,
    values
  );
}

async function rebuildDailyProductMetrics(
  client: PoolClient,
  integration: ShopifyIntegrationDetails,
  dates: string[]
): Promise<void> {
  if (dates.length === 0) {
    return;
  }

  // Delete existing product metrics for these dates
  await client.query(
    `
      DELETE FROM daily_product_metrics
      WHERE shop_id = $1
        AND date = ANY($2::date[])
    `,
    [integration.shopId, dates]
  );

  // Rebuild from fact_order_lines
  await client.query(
    `
      INSERT INTO daily_product_metrics (
        shop_id,
        account_id,
        date,
        shopify_product_id,
        product_title,
        quantity_sold,
        revenue,
        orders_count
      )
      SELECT
        $1::uuid AS shop_id,
        $2::uuid AS account_id,
        f.order_date::date AS date,
        COALESCE(f.shopify_product_id, 'unknown') AS shopify_product_id,
        MAX(f.product_title) AS product_title,
        SUM(f.quantity) AS quantity_sold,
        SUM(f.line_total) AS revenue,
        COUNT(DISTINCT f.order_number) AS orders_count
      FROM fact_order_lines f
      WHERE f.shop_id = $1
        AND f.account_id = $2
        AND f.order_date = ANY($3::date[])
      GROUP BY f.order_date, COALESCE(f.shopify_product_id, 'unknown')
    `,
    [integration.shopId, integration.accountId, dates]
  );
}

async function rebuildDailyShopifyMetrics(
  client: PoolClient,
  integration: ShopifyIntegrationDetails,
  dates: string[]
): Promise<void> {
  if (dates.length === 0) {
    return;
  }

  await client.query(
    `
      DELETE FROM daily_shopify_metrics
      WHERE shop_id = $1
        AND date = ANY($2::date[])
    `,
    [integration.shopId, dates]
  );

  await client.query(
    `
      INSERT INTO daily_shopify_metrics (
        shop_id,
        account_id,
        date,
        orders,
        revenue_gross,
        revenue_net,
        refunds,
        aov
      )
      SELECT
        $1::uuid AS shop_id,
        $2::uuid AS account_id,
        f.order_date::date AS date,
        COUNT(*) AS orders,
        COALESCE(SUM(f.total_gross), 0) AS revenue_gross,
        COALESCE(SUM(f.total_net), 0) AS revenue_net,
        COALESCE(SUM(f.refund_total), 0) AS refunds,
        CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(f.total_net), 0) / COUNT(*) ELSE 0 END AS aov
      FROM fact_orders f
      WHERE f.shop_id = $1
        AND f.account_id = $2
        AND f.order_date = ANY($3::date[])
      GROUP BY f.order_date
    `,
    [integration.shopId, integration.accountId, dates]
  );
}

async function withTransaction<T>(pool: Pool, cb: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await cb(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function setCursorIfMissing(
  client: PoolClient,
  integrationId: string,
  cursorValue: string
): Promise<boolean> {
  const result = await client.query(
    `
      INSERT INTO sync_cursors (integration_id, job_type, cursor_key, cursor_value, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (integration_id, job_type, cursor_key)
      DO NOTHING
      RETURNING cursor_value
    `,
    [integrationId, CURSOR_JOB_TYPE, CURSOR_KEY, cursorValue]
  );
  return (result.rowCount ?? 0) > 0;
}

async function setCursorValue(
  client: PoolClient,
  integrationId: string,
  cursorValue: string
): Promise<void> {
  await client.query(
    `
      INSERT INTO sync_cursors (integration_id, job_type, cursor_key, cursor_value, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (integration_id, job_type, cursor_key)
      DO UPDATE SET
        cursor_value = EXCLUDED.cursor_value,
        updated_at = NOW()
    `,
    [integrationId, CURSOR_JOB_TYPE, CURSOR_KEY, cursorValue]
  );
}

async function getCursorValue(pool: Pool, integrationId: string): Promise<string | null> {
  const result = await pool.query<{ cursor_value: string }>(
    `
      SELECT cursor_value
      FROM sync_cursors
      WHERE integration_id = $1
        AND job_type = $2
        AND cursor_key = $3
      LIMIT 1
    `,
    [integrationId, CURSOR_JOB_TYPE, CURSOR_KEY]
  );
  return result.rows[0]?.cursor_value ?? null;
}

function uniqueDates(orders: NormalizedShopifyOrder[]): string[] {
  const dateSet = new Set<string>();
  orders.forEach((order) => {
    dateSet.add(order.orderDate);
  });
  return Array.from(dateSet.values()).sort();
}

async function persistOrdersAndAggregates(
  pool: Pool,
  integration: ShopifyIntegrationDetails,
  orders: NormalizedShopifyOrder[],
  options?: {
    cursorUpdate?: (client: PoolClient) => Promise<boolean | void>;
  }
): Promise<{ persisted: number; dates: string[]; cursorChanged: boolean }> {
  if (orders.length === 0 && !options?.cursorUpdate) {
    return { persisted: 0, dates: [], cursorChanged: false };
  }

  const dates = uniqueDates(orders);
  let cursorChanged = false;

  await withTransaction(pool, async (client) => {
    if (orders.length > 0) {
      await upsertShopifyRaw(client, integration.integrationId, orders);
      await replaceFactOrders(client, integration, orders);
      await replaceFactOrderLines(client, integration, orders);
      await rebuildDailyShopifyMetrics(client, integration, dates);
      await rebuildDailyProductMetrics(client, integration, dates);
      await rebuildDailySummary(client, integration.accountId, dates);
    }

    if (options?.cursorUpdate) {
      const result = await options.cursorUpdate(client);
      cursorChanged = Boolean(result);
    }
  });

  return { persisted: orders.length, dates, cursorChanged };
}

function formatIsoTimestamp(value: Date): string {
  return value.toISOString();
}

function isoStringOrNull(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function maxIsoString(valueA: string | null, valueB: string | null): string | null {
  if (!valueA) {
    return valueB ?? null;
  }
  if (!valueB) {
    return valueA;
  }
  return valueA > valueB ? valueA : valueB;
}

export async function runShopifySevenDayFillJob(
  run: SyncRunRecord,
  pool: Pool
): Promise<JobResult> {
  const integration = await loadShopifyIntegration(pool, run.integration_id);
  const now = new Date();
  const windowStart = new Date(now.getTime() - 7 * DAY_IN_MS);
  const query = `created_at:>=${formatIsoTimestamp(windowStart)}`;

  const fetchResult = await fetchShopifyOrders(integration, query, "CREATED_AT");
  let cursorInitialized = false;

  if (fetchResult.orders.length > 0) {
    const maxUpdatedAt = isoStringOrNull(fetchResult.maxUpdatedAt);
    const persistResult = await persistOrdersAndAggregates(pool, integration, fetchResult.orders, {
      cursorUpdate:
        maxUpdatedAt === null
          ? undefined
          : (client) => setCursorIfMissing(client, integration.integrationId, maxUpdatedAt),
    });
    cursorInitialized = persistResult.cursorChanged;
    return {
      stats: {
        jobType: "shopify_7d_fill",
        integrationId: integration.integrationId,
        fetchedOrders: fetchResult.orders.length,
        persistedOrders: persistResult.persisted,
        datesAffected: persistResult.dates,
        shopifyApiCalls: fetchResult.apiCalls,
        windowStart: formatIsoTimestamp(windowStart),
        windowEnd: formatIsoTimestamp(now),
        cursorInitialized,
      },
    };
  }

  return {
    stats: {
      jobType: "shopify_7d_fill",
      integrationId: integration.integrationId,
      fetchedOrders: 0,
      persistedOrders: 0,
      datesAffected: [],
      shopifyApiCalls: fetchResult.apiCalls,
      windowStart: formatIsoTimestamp(windowStart),
      windowEnd: formatIsoTimestamp(now),
      cursorInitialized,
    },
  };
}

export async function runShopifyFreshJob(run: SyncRunRecord, pool: Pool): Promise<JobResult> {
  const integration = await loadShopifyIntegration(pool, run.integration_id);
  const previousCursor = await getCursorValue(pool, integration.integrationId);
  const fallbackCursor = new Date(Date.now() - 7 * DAY_IN_MS).toISOString();
  const cursorValue = previousCursor ?? fallbackCursor;
  const query = `updated_at:>=${cursorValue}`;

  const fetchResult = await fetchShopifyOrders(integration, query, "UPDATED_AT");
  const maxUpdatedAt = maxIsoString(previousCursor, fetchResult.maxUpdatedAt);

  let cursorAdvanced = false;
  const persistResult = await persistOrdersAndAggregates(
    pool,
    integration,
    fetchResult.orders,
    maxUpdatedAt
      ? {
        cursorUpdate: async (client) => {
          const nextCursor = isoStringOrNull(maxUpdatedAt);
          if (!nextCursor) {
            return false;
          }
          if (previousCursor && nextCursor <= previousCursor) {
            return false;
          }
          await setCursorValue(client, integration.integrationId, nextCursor);
          cursorAdvanced = true;
          return true;
        },
      }
      : undefined
  );

  return {
    stats: {
      jobType: "shopify_fresh",
      integrationId: integration.integrationId,
      fetchedOrders: fetchResult.orders.length,
      persistedOrders: persistResult.persisted,
      datesAffected: persistResult.dates,
      shopifyApiCalls: fetchResult.apiCalls,
      cursorPrevious: previousCursor,
      cursorNext: cursorAdvanced ? maxUpdatedAt : previousCursor,
      cursorAdvanced,
      windowStart: cursorValue,
      windowEnd: formatIsoTimestamp(new Date()),
    },
  };
}


