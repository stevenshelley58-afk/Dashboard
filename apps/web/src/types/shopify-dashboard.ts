export type ShopifyDatePreset = "today" | "yesterday" | "last_7" | "last_30";

export interface ShopifyDateRange {
  from: string;
  to: string;
  preset?: ShopifyDatePreset;
}

export interface ShopifyShopSummary {
  shop_id: string;
  shop_name: string | null;
  myshopify_domain: string | null;
  currency: string | null;
  timezone: string | null;
}

export interface ShopifyTimeseriesPoint {
  date: string;
  orders: number;
  revenue_gross: number;
  revenue_net: number;
  refunds: number;
  aov: number | null;
}

export interface ShopifyRecentOrder {
  fact_order_id: string;
  order_date: string;
  order_number: string | null;
  order_status: string | null;
  total_net: number | null;
  currency: string | null;
}

export interface ShopifyDashboardSummary {
  orders: number;
  revenue_gross: number;
  revenue_net: number;
  refunds: number;
  aov: number;
}

export interface ShopifyDashboardResponse {
  shop: ShopifyShopSummary;
  range: ShopifyDateRange;
  summary: ShopifyDashboardSummary;
  timeseries: ShopifyTimeseriesPoint[];
  recentOrders: ShopifyRecentOrder[];
  meta: {
    hasData: boolean;
  };
}

