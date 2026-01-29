import { requireAccountId } from "@/lib/auth";
import {
  parseMetaRange,
  resolveMetaAdAccount,
  fetchMetaDailyMetrics,
  buildMetaSummary,
} from "@/lib/data/meta-dashboard";
import type { MetaDashboardResponse } from "@/types/meta-dashboard";
import MetaDashboardClient from "./MetaDashboardClient";

// Revalidate every 60 seconds for dashboard data
export const revalidate = 60;

interface MetaDashboardPageProps {
  searchParams: Promise<{ from?: string; to?: string; ad_account_id?: string }>;
}

async function fetchMetaDashboardData(
  accountId: string,
  fromParam: string | null,
  toParam: string | null,
  adAccountIdParam: string | null
): Promise<MetaDashboardResponse> {
  const range = parseMetaRange(fromParam, toParam);
  const adAccount = await resolveMetaAdAccount(accountId, adAccountIdParam);

  const timeseries = await fetchMetaDailyMetrics({
    accountId,
    adAccountId: adAccount.ad_account_id,
    ...range,
  });

  const summary = buildMetaSummary(timeseries);

  return {
    adAccount,
    range,
    summary,
    timeseries,
    meta: {
      hasData: timeseries.length > 0,
    },
  };
}

export default async function MetaDashboardPage({
  searchParams,
}: MetaDashboardPageProps) {
  const accountId = await requireAccountId();
  const params = await searchParams;
  const data = await fetchMetaDashboardData(
    accountId,
    params.from ?? null,
    params.to ?? null,
    params.ad_account_id ?? null
  );

  return <MetaDashboardClient initialData={data} />;
}
