/**
 * Shared dashboard types used across web and worker
 */

// Home Dashboard Types
export type HomePeriodPreset = "today" | "yesterday" | "last_7" | "last_30";

export interface HomePeriodRange {
  preset: HomePeriodPreset;
  from: string;
  to: string;
}

export interface HomeKpis {
  revenue_net: number;
  meta_spend: number;
  mer: number;
  roas: number;
  aov: number;
  orders: number;
  as_of: string | null;
}

export interface HomeTimeseriesPoint {
  date: string;
  revenue_net: number;
  meta_spend: number;
  mer: number;
}

export interface HomeDashboardCompare {
  range: HomePeriodRange;
  kpis: HomeKpis;
  timeseries: HomeTimeseriesPoint[];
}

export interface HomeDashboardResponse {
  period: HomePeriodRange;
  kpis: HomeKpis;
  timeseries: HomeTimeseriesPoint[];
  currency: string;
  compare: HomeDashboardCompare | null;
  meta: {
    hasData: boolean;
  };
}

// Shopify Dashboard Types
export interface ShopifyDateRange {
  from: string;
  to: string;
  preset?: "today" | "yesterday" | "last_7" | "last_30";
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

export interface ShopifyDashboardSummary {
  orders: number;
  revenue_gross: number;
  revenue_net: number;
  refunds: number;
  aov: number;
}

export interface ShopifyRecentOrder {
  fact_order_id: string;
  order_date: string;
  order_number: string | null;
  order_status: string | null;
  total_net: number | null;
  currency: string | null;
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

// Meta Dashboard Types
export interface MetaDateRange {
  from: string;
  to: string;
  preset?: "today" | "yesterday" | "last_7" | "last_30";
}

export interface MetaAdAccountSummary {
  ad_account_id: string;
  display_name: string | null;
  platform_ad_account_id: string | null;
  currency: string | null;
  timezone: string | null;
}

export interface MetaTimeseriesPoint {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  purchase_value: number;
  roas: number | null;
}

export interface MetaDashboardSummary {
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  purchase_value: number;
  roas: number;
}

export interface MetaDashboardResponse {
  adAccount: MetaAdAccountSummary;
  range: MetaDateRange;
  summary: MetaDashboardSummary;
  timeseries: MetaTimeseriesPoint[];
  meta: {
    hasData: boolean;
  };
}

// Sync Status Types
export interface SyncStatusIntegration {
  integration_id: string;
  type: "shopify" | "meta";
  status: string;
  display_name: string | null;
  identifier: string | null;
  last_attempted_sync: string | null;
  last_successful_sync: string | null;
  data_fresh_to: string | null;
  manual_job_types: string[];
}

export interface SyncStatusResponse {
  integrations: SyncStatusIntegration[];
}
