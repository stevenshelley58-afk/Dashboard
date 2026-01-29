import { z } from "zod";

// Home Dashboard Schemas
export const HomePeriodPresetSchema = z.enum(["today", "yesterday", "last_7", "last_30"]);

export const HomePeriodRangeSchema = z.object({
  preset: HomePeriodPresetSchema,
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const HomeKpisSchema = z.object({
  revenue_net: z.number().min(0),
  meta_spend: z.number().min(0),
  mer: z.number().min(0),
  roas: z.number().min(0),
  aov: z.number().min(0),
  orders: z.number().int().min(0),
  as_of: z.string().nullable(),
});

export const HomeTimeseriesPointSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  revenue_net: z.number().min(0),
  meta_spend: z.number().min(0),
  mer: z.number().min(0),
});

export const HomeDashboardResponseSchema = z.object({
  period: HomePeriodRangeSchema,
  kpis: HomeKpisSchema,
  timeseries: z.array(HomeTimeseriesPointSchema),
  currency: z.string().length(3),
  compare: z
    .object({
      range: HomePeriodRangeSchema,
      kpis: HomeKpisSchema,
      timeseries: z.array(HomeTimeseriesPointSchema),
    })
    .nullable(),
  meta: z.object({
    hasData: z.boolean(),
  }),
});

// Shopify Dashboard Schemas
export const ShopifyDateRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  preset: z.enum(["today", "yesterday", "last_7", "last_30"]).optional(),
});

export const ShopifyShopSummarySchema = z.object({
  shop_id: z.string().uuid(),
  shop_name: z.string().nullable(),
  myshopify_domain: z.string().nullable(),
  currency: z.string().nullable(),
  timezone: z.string().nullable(),
});

export const ShopifyTimeseriesPointSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  orders: z.number().int().min(0),
  revenue_gross: z.number().min(0),
  revenue_net: z.number().min(0),
  refunds: z.number().min(0),
  aov: z.number().nullable(),
});

export const ShopifyDashboardSummarySchema = z.object({
  orders: z.number().int().min(0),
  revenue_gross: z.number().min(0),
  revenue_net: z.number().min(0),
  refunds: z.number().min(0),
  aov: z.number().min(0),
});

export const ShopifyRecentOrderSchema = z.object({
  fact_order_id: z.string().uuid(),
  order_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  order_number: z.string().nullable(),
  order_status: z.string().nullable(),
  total_net: z.number().nullable(),
  currency: z.string().nullable(),
});

export const ShopifyDashboardResponseSchema = z.object({
  shop: ShopifyShopSummarySchema,
  range: ShopifyDateRangeSchema,
  summary: ShopifyDashboardSummarySchema,
  timeseries: z.array(ShopifyTimeseriesPointSchema),
  recentOrders: z.array(ShopifyRecentOrderSchema),
  meta: z.object({
    hasData: z.boolean(),
  }),
});

// Meta Dashboard Schemas
export const MetaDateRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  preset: z.enum(["today", "yesterday", "last_7", "last_30"]).optional(),
});

export const MetaAdAccountSummarySchema = z.object({
  ad_account_id: z.string().uuid(),
  display_name: z.string().nullable(),
  platform_ad_account_id: z.string().nullable(),
  currency: z.string().nullable(),
  timezone: z.string().nullable(),
});

export const MetaTimeseriesPointSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  spend: z.number().min(0),
  purchases: z.number().int().min(0),
  purchase_value: z.number().min(0),
  roas: z.number().nullable(),
});

export const MetaDashboardSummarySchema = z.object({
  spend: z.number().min(0),
  purchases: z.number().int().min(0),
  purchase_value: z.number().min(0),
  roas: z.number().min(0),
});

export const MetaDashboardResponseSchema = z.object({
  adAccount: MetaAdAccountSummarySchema,
  range: MetaDateRangeSchema,
  summary: MetaDashboardSummarySchema,
  timeseries: z.array(MetaTimeseriesPointSchema),
  meta: z.object({
    hasData: z.boolean(),
  }),
});

// Type exports for use in components
export type HomePeriodPreset = z.infer<typeof HomePeriodPresetSchema>;
export type HomePeriodRange = z.infer<typeof HomePeriodRangeSchema>;
export type HomeKpis = z.infer<typeof HomeKpisSchema>;
export type HomeTimeseriesPoint = z.infer<typeof HomeTimeseriesPointSchema>;
export type HomeDashboardResponse = z.infer<typeof HomeDashboardResponseSchema>;

export type ShopifyDateRange = z.infer<typeof ShopifyDateRangeSchema>;
export type ShopifyShopSummary = z.infer<typeof ShopifyShopSummarySchema>;
export type ShopifyTimeseriesPoint = z.infer<typeof ShopifyTimeseriesPointSchema>;
export type ShopifyDashboardSummary = z.infer<typeof ShopifyDashboardSummarySchema>;
export type ShopifyRecentOrder = z.infer<typeof ShopifyRecentOrderSchema>;
export type ShopifyDashboardResponse = z.infer<typeof ShopifyDashboardResponseSchema>;

export type MetaDateRange = z.infer<typeof MetaDateRangeSchema>;
export type MetaAdAccountSummary = z.infer<typeof MetaAdAccountSummarySchema>;
export type MetaTimeseriesPoint = z.infer<typeof MetaTimeseriesPointSchema>;
export type MetaDashboardSummary = z.infer<typeof MetaDashboardSummarySchema>;
export type MetaDashboardResponse = z.infer<typeof MetaDashboardResponseSchema>;
