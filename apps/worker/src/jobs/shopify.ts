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

// ShopifyQL types for sessions/analytics data
interface ShopifyQLTableData {
  columns: Array<{
    name: string;
    dataType: string;
  }>;
  rowData: string[][];
}

interface ShopifyQLResponse {
  shopifyqlQuery: {
    __typename: string;
    tableData?: ShopifyQLTableData;
    parseErrors?: Array<{ message: string }>;
  };
}

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

interface ShopifyAddress {
  city: string | null;
  province: string | null;
  provinceCode: string | null;
  country: string | null;
  countryCodeV2: string | null;
}

interface ShopifyCustomer {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  ordersCount: number | null;
  acceptsMarketing: boolean | null;
  tags: string[];
}

interface ShopifyDiscountApplication {
  allocationMethod: string | null;
  targetSelection: string | null;
  targetType: string | null;
  value: {
    __typename: string;
    percentage?: number | null;
    amount?: { amount: string | number } | null;
  } | null;
  code?: string | null;
  title?: string | null;
}

interface ShopifyRefundNode {
  id: string;
  createdAt: string;
  note: string | null;
  totalRefundedSet?: { shopMoney?: ShopifyMoney | null } | null;
}

interface ShopifyOrderNode {
  id: string;
  name: string | null;
  orderNumber: number | null;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  closedAt: string | null;
  displayFinancialStatus: string | null;
  displayFulfillmentStatus: string | null;
  currencyCode: string | null;
  currentTotalPriceSet?: { shopMoney?: ShopifyMoney | null } | null;
  totalPriceSet?: { shopMoney?: ShopifyMoney | null } | null;
  subtotalPriceSet?: { shopMoney?: ShopifyMoney | null } | null;
  totalRefundedSet?: { shopMoney?: ShopifyMoney | null } | null;
  totalDiscountsSet?: { shopMoney?: ShopifyMoney | null } | null;
  totalShippingPriceSet?: { shopMoney?: ShopifyMoney | null } | null;
  totalTaxSet?: { shopMoney?: ShopifyMoney | null } | null;
  subtotalLineItemsQuantity: number | null;
  channelInformation?: {
    channelDefinition?: {
      channelName: string | null;
      handle: string | null;
    } | null;
  } | null;
  sourceIdentifier: string | null;
  sourceName: string | null;
  landingSite: string | null;
  referringSite: string | null;
  tags: string[];
  customer?: ShopifyCustomer | null;
  billingAddress?: ShopifyAddress | null;
  shippingAddress?: ShopifyAddress | null;
  clientDetails?: {
    browserIp: string | null;
    userAgent: string | null;
  } | null;
  discountApplications?: {
    edges: Array<{
      node: ShopifyDiscountApplication;
    }>;
  } | null;
  refunds?: ShopifyRefundNode[];
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

interface NormalizedDiscount {
  code: string | null;
  title: string | null;
  type: string; // 'percentage', 'fixed_amount'
  value: number;
}

interface NormalizedRefund {
  shopifyRefundId: string;
  createdAt: string;
  amount: number;
  note: string | null;
}

interface NormalizedShopifyOrder {
  shopifyOrderId: string;
  orderName: string;
  orderCreatedAt: string;
  orderUpdatedAt: string;
  orderDate: string;
  orderHour: number;
  orderStatus: string | null;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  cancelledAt: string | null;
  closedAt: string | null;
  totalGross: number;
  totalNet: number;
  subtotal: number;
  refundTotal: number;
  totalDiscounts: number;
  totalShipping: number;
  totalTax: number;
  currencyCode: string | null;
  // Customer
  shopifyCustomerId: string | null;
  customerEmail: string | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  customerOrdersCount: number;
  customerAcceptsMarketing: boolean;
  customerTags: string[];
  isFirstOrder: boolean;
  // Channel & Source
  salesChannel: string | null;
  sourceName: string | null;
  landingSite: string | null;
  referringSite: string | null;
  // Location
  billingCountry: string | null;
  billingRegion: string | null;
  billingCity: string | null;
  shippingCountry: string | null;
  shippingRegion: string | null;
  shippingCity: string | null;
  // Device
  deviceType: string | null;
  browser: string | null;
  // Tags
  tags: string[];
  // Line items, discounts, refunds
  lineItems: NormalizedLineItem[];
  discounts: NormalizedDiscount[];
  refunds: NormalizedRefund[];
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

function parseDeviceTypeFromUserAgent(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();
  if (/mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    if (/ipad|tablet/i.test(ua)) return 'tablet';
    return 'mobile';
  }
  return 'desktop';
}

function parseBrowserFromUserAgent(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();
  if (ua.includes('chrome')) return 'Chrome';
  if (ua.includes('safari')) return 'Safari';
  if (ua.includes('firefox')) return 'Firefox';
  if (ua.includes('edge')) return 'Edge';
  if (ua.includes('opera') || ua.includes('opr')) return 'Opera';
  if (ua.includes('msie') || ua.includes('trident')) return 'Internet Explorer';
  return 'Other';
}

function normalizeDiscounts(node: ShopifyOrderNode): NormalizedDiscount[] {
  const edges = node.discountApplications?.edges ?? [];
  return edges.map(({ node: disc }) => {
    let type = 'fixed_amount';
    let value = 0;

    if (disc.value?.__typename === 'PricingPercentageValue' && disc.value.percentage != null) {
      type = 'percentage';
      value = disc.value.percentage;
    } else if (disc.value?.amount) {
      type = 'fixed_amount';
      const amt = disc.value.amount.amount;
      value = typeof amt === 'string' ? parseFloat(amt) : (amt ?? 0);
    }

    return {
      code: disc.code ?? null,
      title: disc.title ?? null,
      type,
      value,
    };
  });
}

function normalizeRefunds(node: ShopifyOrderNode): NormalizedRefund[] {
  const refunds = node.refunds ?? [];
  return refunds.map((refund) => ({
    shopifyRefundId: refund.id,
    createdAt: refund.createdAt,
    amount: parseMoney(refund.totalRefundedSet?.shopMoney),
    note: refund.note,
  }));
}

function normalizeOrder(node: ShopifyOrderNode): NormalizedShopifyOrder {
  const currencyCode =
    node.currencyCode ??
    node.currentTotalPriceSet?.shopMoney?.currencyCode ??
    node.totalPriceSet?.shopMoney?.currencyCode ??
    null;

  const gross =
    parseMoney(node.currentTotalPriceSet?.shopMoney) || parseMoney(node.totalPriceSet?.shopMoney);
  const refundTotal = parseMoney(node.totalRefundedSet?.shopMoney);
  const net = Math.max(gross - refundTotal, 0);
  const subtotal = parseMoney(node.subtotalPriceSet?.shopMoney);
  const totalDiscounts = parseMoney(node.totalDiscountsSet?.shopMoney);
  const totalShipping = parseMoney(node.totalShippingPriceSet?.shopMoney);
  const totalTax = parseMoney(node.totalTaxSet?.shopMoney);

  const orderName =
    node.name ??
    (typeof node.orderNumber === "number"
      ? `#${node.orderNumber}`
      : node.id.replace("gid://shopify/Order/", "order_"));

  const createdAtDate = new Date(node.createdAt);
  const orderHour = createdAtDate.getUTCHours();

  // Customer info
  const shopifyCustomerId = node.customer ? extractGid(node.customer.id, 'Customer') : null;
  const customerOrdersCount = node.customer?.ordersCount ?? 0;
  const isFirstOrder = customerOrdersCount <= 1;

  // Channel
  const salesChannel = node.channelInformation?.channelDefinition?.channelName ??
    node.channelInformation?.channelDefinition?.handle ??
    node.sourceName ??
    'Online Store';

  return {
    shopifyOrderId: node.id,
    orderName,
    orderCreatedAt: node.createdAt,
    orderUpdatedAt: node.updatedAt,
    orderDate: toDateOnly(node.createdAt),
    orderHour,
    orderStatus: normalizeOrderStatus(node),
    financialStatus: node.displayFinancialStatus,
    fulfillmentStatus: node.displayFulfillmentStatus,
    cancelledAt: node.cancelledAt,
    closedAt: node.closedAt,
    totalGross: gross,
    totalNet: net,
    subtotal,
    refundTotal,
    totalDiscounts,
    totalShipping,
    totalTax,
    currencyCode,
    // Customer
    shopifyCustomerId,
    customerEmail: node.customer?.email ?? null,
    customerFirstName: node.customer?.firstName ?? null,
    customerLastName: node.customer?.lastName ?? null,
    customerOrdersCount,
    customerAcceptsMarketing: node.customer?.acceptsMarketing ?? false,
    customerTags: node.customer?.tags ?? [],
    isFirstOrder,
    // Channel & Source
    salesChannel,
    sourceName: node.sourceName,
    landingSite: node.landingSite,
    referringSite: node.referringSite,
    // Location
    billingCountry: node.billingAddress?.country ?? node.billingAddress?.countryCodeV2 ?? null,
    billingRegion: node.billingAddress?.province ?? node.billingAddress?.provinceCode ?? null,
    billingCity: node.billingAddress?.city ?? null,
    shippingCountry: node.shippingAddress?.country ?? node.shippingAddress?.countryCodeV2 ?? null,
    shippingRegion: node.shippingAddress?.province ?? node.shippingAddress?.provinceCode ?? null,
    shippingCity: node.shippingAddress?.city ?? null,
    // Device
    deviceType: parseDeviceTypeFromUserAgent(node.clientDetails?.userAgent),
    browser: parseBrowserFromUserAgent(node.clientDetails?.userAgent),
    // Tags
    tags: node.tags ?? [],
    // Line items, discounts, refunds
    lineItems: normalizeLineItems(node),
    discounts: normalizeDiscounts(node),
    refunds: normalizeRefunds(node),
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

/**
 * Execute a ShopifyQL query to fetch analytics data (sessions, conversions, etc.)
 * Requires the `read_reports` scope on the Shopify access token.
 */
async function fetchShopifyQLData(
  integration: ShopifyIntegrationDetails,
  shopifyqlQuery: string
): Promise<ShopifyQLTableData | null> {
  try {
    const { data } = await callShopifyGraphql<ShopifyQLResponse>(integration, {
      query: `
        mutation RunShopifyQL($query: String!) {
          shopifyqlQuery(query: $query) {
            __typename
            ... on TableResponse {
              tableData {
                columns {
                  name
                  dataType
                }
                rowData
              }
            }
            ... on PolarisVizResponse {
              tableData {
                columns {
                  name
                  dataType
                }
                rowData
              }
            }
            ... on ParseError {
              parseErrors {
                message
              }
            }
          }
        }
      `,
      variables: { query: shopifyqlQuery },
    });

    if (data.shopifyqlQuery.__typename === 'ParseError') {
      const errors = data.shopifyqlQuery.parseErrors?.map(e => e.message).join('; ') ?? 'Unknown parse error';
      console.warn(`ShopifyQL parse error for integration ${integration.integrationId}: ${errors}`);
      return null;
    }

    return data.shopifyqlQuery.tableData ?? null;
  } catch (error) {
    // ShopifyQL may not be available for all stores (requires read_reports scope)
    console.warn(`ShopifyQL query failed for integration ${integration.integrationId}:`, error);
    return null;
  }
}

interface SessionsData {
  date: string;
  sessions: number;
  visitors: number;
  pageViews: number;
  addedToCart: number;
  reachedCheckout: number;
  sessionsConverted: number;
  conversionRate: number;
}

/**
 * Fetch sessions/traffic data for the last N days using ShopifyQL
 */
async function fetchSessionsData(
  integration: ShopifyIntegrationDetails,
  daysBack: number = 30
): Promise<SessionsData[]> {
  const query = `
    FROM sessions
    SINCE -${daysBack}d
    UNTIL today
    GROUP BY day
    SELECT
      sum(sessions) AS sessions,
      sum(unique_visitors) AS visitors,
      sum(page_views) AS page_views,
      sum(added_to_cart) AS added_to_cart,
      sum(reached_checkout) AS reached_checkout,
      sum(sessions_converted) AS sessions_converted
  `;

  const tableData = await fetchShopifyQLData(integration, query);
  if (!tableData) {
    return [];
  }

  // Map column indices
  const columnMap: Record<string, number> = {};
  tableData.columns.forEach((col, idx) => {
    columnMap[col.name.toLowerCase()] = idx;
  });

  const results: SessionsData[] = [];
  for (const row of tableData.rowData) {
    const sessions = parseFloat(row[columnMap['sessions']] ?? '0') || 0;
    const visitors = parseFloat(row[columnMap['visitors']] ?? '0') || 0;
    const pageViews = parseFloat(row[columnMap['page_views']] ?? '0') || 0;
    const addedToCart = parseFloat(row[columnMap['added_to_cart']] ?? '0') || 0;
    const reachedCheckout = parseFloat(row[columnMap['reached_checkout']] ?? '0') || 0;
    const sessionsConverted = parseFloat(row[columnMap['sessions_converted']] ?? '0') || 0;
    const conversionRate = sessions > 0 ? sessionsConverted / sessions : 0;

    // The first column is typically the date (day)
    const dateValue = row[columnMap['day']] ?? row[0] ?? '';
    const date = dateValue.slice(0, 10); // Extract YYYY-MM-DD

    if (date) {
      results.push({
        date,
        sessions,
        visitors,
        pageViews,
        addedToCart,
        reachedCheckout,
        sessionsConverted,
        conversionRate,
      });
    }
  }

  return results;
}

/**
 * Fetch traffic sources data using ShopifyQL
 */
interface TrafficSourceData {
  date: string;
  source: string;
  sessions: number;
  orders: number;
  revenue: number;
}

async function fetchTrafficSources(
  integration: ShopifyIntegrationDetails,
  daysBack: number = 30
): Promise<TrafficSourceData[]> {
  const query = `
    FROM sessions
    SINCE -${daysBack}d
    UNTIL today
    GROUP BY day, referrer_source
    SELECT
      sum(sessions) AS sessions,
      sum(orders) AS orders,
      sum(total_sales) AS revenue
  `;

  const tableData = await fetchShopifyQLData(integration, query);
  if (!tableData) {
    return [];
  }

  const columnMap: Record<string, number> = {};
  tableData.columns.forEach((col, idx) => {
    columnMap[col.name.toLowerCase()] = idx;
  });

  const results: TrafficSourceData[] = [];
  for (const row of tableData.rowData) {
    const date = (row[columnMap['day']] ?? row[0] ?? '').slice(0, 10);
    const source = row[columnMap['referrer_source']] ?? row[1] ?? 'Direct';
    const sessions = parseFloat(row[columnMap['sessions']] ?? '0') || 0;
    const orders = parseFloat(row[columnMap['orders']] ?? '0') || 0;
    const revenue = parseFloat(row[columnMap['revenue']] ?? '0') || 0;

    if (date) {
      results.push({ date, source, sessions, orders, revenue });
    }
  }

  return results;
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
                cancelledAt
                closedAt
                displayFinancialStatus
                displayFulfillmentStatus
                currencyCode
                tags
                sourceName
                landingSite
                referringSite
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
                totalDiscountsSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                totalShippingPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                totalTaxSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                subtotalLineItemsQuantity
                channelInformation {
                  channelDefinition {
                    channelName
                    handle
                  }
                }
                customer {
                  id
                  email
                  firstName
                  lastName
                  ordersCount
                  acceptsMarketing
                  tags
                }
                billingAddress {
                  city
                  province
                  provinceCode
                  country
                  countryCodeV2
                }
                shippingAddress {
                  city
                  province
                  provinceCode
                  country
                  countryCodeV2
                }
                clientDetails {
                  browserIp
                  userAgent
                }
                discountApplications(first: 10) {
                  edges {
                    node {
                      allocationMethod
                      targetSelection
                      targetType
                      value {
                        __typename
                        ... on PricingPercentageValue {
                          percentage
                        }
                        ... on MoneyV2 {
                          amount
                        }
                      }
                      ... on DiscountCodeApplication {
                        code
                      }
                      ... on ManualDiscountApplication {
                        title
                      }
                      ... on AutomaticDiscountApplication {
                        title
                      }
                      ... on ScriptDiscountApplication {
                        title
                      }
                    }
                  }
                }
                refunds {
                  id
                  createdAt
                  note
                  totalRefundedSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
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

  const columns = 30;
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
      order.currencyCode ?? integration.currency ?? null,
      // New columns
      order.shopifyOrderId,
      order.shopifyCustomerId,
      order.customerEmail,
      order.isFirstOrder,
      order.totalDiscounts,
      order.totalShipping,
      order.totalTax,
      order.subtotal,
      order.subtotal, // total_line_items_price (same as subtotal)
      order.fulfillmentStatus,
      order.financialStatus,
      order.cancelledAt,
      order.closedAt,
      order.salesChannel,
      order.sourceName,
      order.landingSite,
      order.referringSite,
      order.shippingCountry,
      order.shippingRegion
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
        currency,
        shopify_order_id,
        shopify_customer_id,
        customer_email,
        is_first_order,
        total_discounts,
        total_shipping,
        total_tax,
        subtotal,
        total_line_items_price,
        fulfillment_status,
        financial_status,
        cancelled_at,
        closed_at,
        sales_channel,
        source_name,
        landing_site,
        referring_site,
        shipping_country,
        shipping_region
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
        aov,
        total_discounts,
        total_shipping,
        total_tax,
        new_customers,
        returning_customers,
        returning_customer_rate
      )
      SELECT
        $1::uuid AS shop_id,
        $2::uuid AS account_id,
        f.order_date::date AS date,
        COUNT(*) AS orders,
        COALESCE(SUM(f.total_gross), 0) AS revenue_gross,
        COALESCE(SUM(f.total_net), 0) AS revenue_net,
        COALESCE(SUM(f.refund_total), 0) AS refunds,
        CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(f.total_net), 0) / COUNT(*) ELSE 0 END AS aov,
        COALESCE(SUM(f.total_discounts), 0) AS total_discounts,
        COALESCE(SUM(f.total_shipping), 0) AS total_shipping,
        COALESCE(SUM(f.total_tax), 0) AS total_tax,
        COUNT(*) FILTER (WHERE f.is_first_order = true) AS new_customers,
        COUNT(*) FILTER (WHERE f.is_first_order = false OR f.is_first_order IS NULL) AS returning_customers,
        CASE
          WHEN COUNT(*) > 0 THEN
            (COUNT(*) FILTER (WHERE f.is_first_order = false OR f.is_first_order IS NULL))::numeric / COUNT(*)
          ELSE 0
        END AS returning_customer_rate
      FROM fact_orders f
      WHERE f.shop_id = $1
        AND f.account_id = $2
        AND f.order_date = ANY($3::date[])
      GROUP BY f.order_date
    `,
    [integration.shopId, integration.accountId, dates]
  );
}

async function rebuildDailySalesByChannel(
  client: PoolClient,
  integration: ShopifyIntegrationDetails,
  dates: string[]
): Promise<void> {
  if (dates.length === 0) {
    return;
  }

  await client.query(
    `
      DELETE FROM daily_sales_by_channel
      WHERE shop_id = $1
        AND date = ANY($2::date[])
    `,
    [integration.shopId, dates]
  );

  await client.query(
    `
      INSERT INTO daily_sales_by_channel (
        shop_id,
        account_id,
        date,
        sales_channel,
        orders,
        revenue_gross,
        revenue_net,
        aov
      )
      SELECT
        $1::uuid AS shop_id,
        $2::uuid AS account_id,
        f.order_date::date AS date,
        COALESCE(f.sales_channel, 'Unknown') AS sales_channel,
        COUNT(*) AS orders,
        COALESCE(SUM(f.total_gross), 0) AS revenue_gross,
        COALESCE(SUM(f.total_net), 0) AS revenue_net,
        CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(f.total_net), 0) / COUNT(*) ELSE 0 END AS aov
      FROM fact_orders f
      WHERE f.shop_id = $1
        AND f.account_id = $2
        AND f.order_date = ANY($3::date[])
      GROUP BY f.order_date, COALESCE(f.sales_channel, 'Unknown')
    `,
    [integration.shopId, integration.accountId, dates]
  );
}

async function rebuildDailySalesByLocation(
  client: PoolClient,
  integration: ShopifyIntegrationDetails,
  dates: string[]
): Promise<void> {
  if (dates.length === 0) {
    return;
  }

  await client.query(
    `
      DELETE FROM daily_sales_by_location
      WHERE shop_id = $1
        AND date = ANY($2::date[])
    `,
    [integration.shopId, dates]
  );

  await client.query(
    `
      INSERT INTO daily_sales_by_location (
        shop_id,
        account_id,
        date,
        country,
        region,
        orders,
        revenue_net,
        new_customers
      )
      SELECT
        $1::uuid AS shop_id,
        $2::uuid AS account_id,
        f.order_date::date AS date,
        COALESCE(f.shipping_country, 'Unknown') AS country,
        f.shipping_region AS region,
        COUNT(*) AS orders,
        COALESCE(SUM(f.total_net), 0) AS revenue_net,
        COUNT(*) FILTER (WHERE f.is_first_order = true) AS new_customers
      FROM fact_orders f
      WHERE f.shop_id = $1
        AND f.account_id = $2
        AND f.order_date = ANY($3::date[])
      GROUP BY f.order_date, COALESCE(f.shipping_country, 'Unknown'), f.shipping_region
    `,
    [integration.shopId, integration.accountId, dates]
  );
}

async function rebuildHourlySales(
  client: PoolClient,
  integration: ShopifyIntegrationDetails,
  dates: string[]
): Promise<void> {
  if (dates.length === 0) {
    return;
  }

  await client.query(
    `
      DELETE FROM hourly_sales
      WHERE shop_id = $1
        AND date = ANY($2::date[])
    `,
    [integration.shopId, dates]
  );

  await client.query(
    `
      INSERT INTO hourly_sales (
        shop_id,
        account_id,
        date,
        hour,
        orders,
        revenue_net
      )
      SELECT
        $1::uuid AS shop_id,
        $2::uuid AS account_id,
        f.order_date::date AS date,
        EXTRACT(HOUR FROM f.order_created_at AT TIME ZONE 'UTC')::integer AS hour,
        COUNT(*) AS orders,
        COALESCE(SUM(f.total_net), 0) AS revenue_net
      FROM fact_orders f
      WHERE f.shop_id = $1
        AND f.account_id = $2
        AND f.order_date = ANY($3::date[])
      GROUP BY f.order_date, EXTRACT(HOUR FROM f.order_created_at AT TIME ZONE 'UTC')::integer
    `,
    [integration.shopId, integration.accountId, dates]
  );
}

async function persistSessionsData(
  client: PoolClient,
  integration: ShopifyIntegrationDetails,
  sessionsData: SessionsData[]
): Promise<void> {
  if (sessionsData.length === 0) {
    return;
  }

  const dates = sessionsData.map(s => s.date);

  // Delete existing funnel metrics for these dates
  await client.query(
    `
      DELETE FROM daily_funnel_metrics
      WHERE shop_id = $1
        AND date = ANY($2::date[])
    `,
    [integration.shopId, dates]
  );

  // Insert new funnel metrics
  const columns = 12;
  const values: unknown[] = [];
  const placeholders = buildValuesPlaceholders(sessionsData.length, columns);

  for (const data of sessionsData) {
    values.push(
      integration.shopId,
      integration.accountId,
      data.date,
      data.sessions,
      data.pageViews,
      data.addedToCart,
      data.reachedCheckout,
      data.reachedCheckout, // checkouts_started = reached_checkout
      data.sessionsConverted,
      data.sessionsConverted, // orders_placed approximated from sessions converted
      data.addedToCart > 0 ? (1 - data.reachedCheckout / data.addedToCart) : 0, // cart abandonment
      data.conversionRate
    );
  }

  await client.query(
    `
      INSERT INTO daily_funnel_metrics (
        shop_id,
        account_id,
        date,
        sessions,
        product_views,
        add_to_carts,
        reached_checkout,
        checkouts_started,
        checkouts_completed,
        orders_placed,
        cart_abandonment_rate,
        overall_conversion_rate
      )
      VALUES ${placeholders}
    `,
    values
  );
}

async function persistTrafficSources(
  client: PoolClient,
  integration: ShopifyIntegrationDetails,
  trafficData: TrafficSourceData[]
): Promise<void> {
  if (trafficData.length === 0) {
    return;
  }

  const dates = [...new Set(trafficData.map(t => t.date))];

  // Delete existing traffic source data for these dates
  await client.query(
    `
      DELETE FROM daily_traffic_sources
      WHERE shop_id = $1
        AND date = ANY($2::date[])
    `,
    [integration.shopId, dates]
  );

  // Insert new traffic source data
  const columns = 7;
  const values: unknown[] = [];
  const placeholders = buildValuesPlaceholders(trafficData.length, columns);

  for (const data of trafficData) {
    values.push(
      integration.shopId,
      integration.accountId,
      data.date,
      data.source,
      data.sessions,
      data.orders,
      data.revenue
    );
  }

  await client.query(
    `
      INSERT INTO daily_traffic_sources (
        shop_id,
        account_id,
        date,
        source,
        sessions,
        orders,
        revenue
      )
      VALUES ${placeholders}
    `,
    values
  );
}

async function upsertCustomers(
  client: PoolClient,
  integration: ShopifyIntegrationDetails,
  orders: NormalizedShopifyOrder[]
): Promise<void> {
  // Extract unique customers from orders
  const customerMap = new Map<string, NormalizedShopifyOrder>();
  for (const order of orders) {
    if (order.shopifyCustomerId) {
      const existing = customerMap.get(order.shopifyCustomerId);
      // Keep the most recent order for each customer
      if (!existing || order.orderCreatedAt > existing.orderCreatedAt) {
        customerMap.set(order.shopifyCustomerId, order);
      }
    }
  }

  const uniqueCustomers = Array.from(customerMap.values());
  if (uniqueCustomers.length === 0) {
    return;
  }

  // Upsert each customer
  for (const order of uniqueCustomers) {
    await client.query(
      `
        INSERT INTO dim_customers (
          shop_id,
          account_id,
          shopify_customer_id,
          email,
          first_name,
          last_name,
          total_orders,
          accepts_marketing,
          tags,
          country,
          region,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        ON CONFLICT (shop_id, shopify_customer_id)
        DO UPDATE SET
          email = COALESCE(EXCLUDED.email, dim_customers.email),
          first_name = COALESCE(EXCLUDED.first_name, dim_customers.first_name),
          last_name = COALESCE(EXCLUDED.last_name, dim_customers.last_name),
          total_orders = GREATEST(EXCLUDED.total_orders, dim_customers.total_orders),
          accepts_marketing = EXCLUDED.accepts_marketing,
          tags = EXCLUDED.tags,
          country = COALESCE(EXCLUDED.country, dim_customers.country),
          region = COALESCE(EXCLUDED.region, dim_customers.region),
          updated_at = NOW()
      `,
      [
        integration.shopId,
        integration.accountId,
        order.shopifyCustomerId,
        order.customerEmail,
        order.customerFirstName,
        order.customerLastName,
        order.customerOrdersCount,
        order.customerAcceptsMarketing,
        order.customerTags,
        order.shippingCountry,
        order.shippingRegion,
      ]
    );
  }

  // Update first_order_date for customers who don't have it set
  await client.query(
    `
      UPDATE dim_customers c
      SET
        first_order_date = (
          SELECT MIN(f.order_date)
          FROM fact_orders f
          WHERE f.shop_id = c.shop_id
            AND f.shopify_customer_id = c.shopify_customer_id
        ),
        last_order_date = (
          SELECT MAX(f.order_date)
          FROM fact_orders f
          WHERE f.shop_id = c.shop_id
            AND f.shopify_customer_id = c.shopify_customer_id
        ),
        total_spent = (
          SELECT COALESCE(SUM(f.total_net), 0)
          FROM fact_orders f
          WHERE f.shop_id = c.shop_id
            AND f.shopify_customer_id = c.shopify_customer_id
        ),
        average_order_value = (
          SELECT CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(f.total_net), 0) / COUNT(*) ELSE 0 END
          FROM fact_orders f
          WHERE f.shop_id = c.shop_id
            AND f.shopify_customer_id = c.shopify_customer_id
        )
      WHERE c.shop_id = $1
        AND c.shopify_customer_id = ANY($2::text[])
    `,
    [integration.shopId, Array.from(customerMap.keys())]
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
      await upsertCustomers(client, integration, orders);
      await rebuildDailyShopifyMetrics(client, integration, dates);
      await rebuildDailyProductMetrics(client, integration, dates);
      await rebuildDailySalesByChannel(client, integration, dates);
      await rebuildDailySalesByLocation(client, integration, dates);
      await rebuildHourlySales(client, integration, dates);
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

/**
 * Sync sessions and traffic data from ShopifyQL Analytics.
 * This job fetches sessions, conversion rates, and traffic sources.
 * Requires the `read_reports` scope on the Shopify access token.
 */
export async function runShopifySessionsJob(run: SyncRunRecord, pool: Pool): Promise<JobResult> {
  const integration = await loadShopifyIntegration(pool, run.integration_id);
  const daysBack = 30;

  // Fetch sessions and traffic data in parallel
  const [sessionsData, trafficData] = await Promise.all([
    fetchSessionsData(integration, daysBack),
    fetchTrafficSources(integration, daysBack),
  ]);

  // Persist the data
  await withTransaction(pool, async (client) => {
    await persistSessionsData(client, integration, sessionsData);
    await persistTrafficSources(client, integration, trafficData);
  });

  const dates = [...new Set([
    ...sessionsData.map(s => s.date),
    ...trafficData.map(t => t.date),
  ])].sort();

  return {
    stats: {
      jobType: "shopify_sessions",
      integrationId: integration.integrationId,
      sessionsRowsFetched: sessionsData.length,
      trafficSourcesRowsFetched: trafficData.length,
      datesAffected: dates,
      daysBack,
      shopifyqlAvailable: sessionsData.length > 0 || trafficData.length > 0,
    },
  };
}


