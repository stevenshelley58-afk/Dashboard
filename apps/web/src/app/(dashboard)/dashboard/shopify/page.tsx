import { requireAccountId } from "@/lib/auth";
import {
  parseRange,
  resolveShopContext,
  fetchShopifyDailyMetrics,
  fetchShopifyRecentOrders,
  buildShopifySummary,
} from "@/lib/data/shopify-dashboard";
import type { ShopifyDashboardResponse } from "@/types/shopify-dashboard";
import ShopifyDashboardClient from "./ShopifyDashboardClient";

// Revalidate every 60 seconds for dashboard data
export const revalidate = 60;

interface ShopifyDashboardPageProps {
  searchParams: Promise<{ from?: string; to?: string; shop_id?: string }>;
}

async function fetchShopifyDashboardData(
  accountId: string,
  fromParam: string | null,
  toParam: string | null,
  shopIdParam: string | null
): Promise<ShopifyDashboardResponse> {
  const range = parseRange(fromParam, toParam);
  const shop = await resolveShopContext(accountId, shopIdParam);

  const [timeseries, recentOrders] = await Promise.all([
    fetchShopifyDailyMetrics({ accountId, shopId: shop.shop_id, ...range }),
    fetchShopifyRecentOrders({ accountId, shopId: shop.shop_id, ...range }),
  ]);

  const summary = buildShopifySummary(timeseries);

  return {
    shop,
    range,
    summary,
    timeseries,
    recentOrders,
    meta: {
      hasData: timeseries.length > 0 || recentOrders.length > 0,
    },
  };
}

export default async function ShopifyDashboardPage({
  searchParams,
}: ShopifyDashboardPageProps) {
  const accountId = await requireAccountId();
  const params = await searchParams;
  const data = await fetchShopifyDashboardData(
    accountId,
    params.from ?? null,
    params.to ?? null,
    params.shop_id ?? null
  );

  return <ShopifyDashboardClient initialData={data} />;
}
