import { requireAccountId } from "@/lib/auth";
import {
  parsePreset,
  computePeriodRange,
  computeCompareRange,
  fetchHomeKpis,
  fetchHomeTimeseries,
  normalizeTimeseries,
  resolveAccountCurrency,
} from "@/lib/data/home-dashboard";
import type { HomeDashboardResponse } from "@/types/home-dashboard";
import HomeDashboardClient from "./HomeDashboardClient";

// Revalidate every 60 seconds for dashboard data
export const revalidate = 60;

interface HomeDashboardPageProps {
  searchParams: Promise<{ period?: string; compare?: string }>;
}

async function fetchDashboardData(
  accountId: string,
  periodParam: string | null,
  compareParam: string | null
): Promise<HomeDashboardResponse> {
  const preset = parsePreset(periodParam);
  const range = computePeriodRange(preset);
  const compareEnabled = compareParam === "1" || compareParam === "true";
  const compareRange = compareEnabled ? computeCompareRange(range) : null;

  const [kpis, rows, currency, compareKpis, compareRows] = await Promise.all([
    fetchHomeKpis(accountId, preset, range),
    fetchHomeTimeseries({ accountId, from: range.from, to: range.to }),
    resolveAccountCurrency(accountId),
    compareRange ? fetchHomeKpis(accountId, preset, compareRange) : Promise.resolve(null),
    compareRange
      ? fetchHomeTimeseries({ accountId, from: compareRange.from, to: compareRange.to })
      : Promise.resolve(null),
  ]);

  const timeseries = normalizeTimeseries(range, rows);
  const compareTimeseries =
    compareRange && compareRows ? normalizeTimeseries(compareRange, compareRows) : null;

  const hasData =
    kpis.revenue_net > 0 ||
    kpis.meta_spend > 0 ||
    kpis.orders > 0 ||
    timeseries.some((p) => p.revenue_net > 0 || p.meta_spend > 0);

  return {
    period: range,
    kpis,
    timeseries,
    currency,
    compare:
      compareRange && compareKpis && compareTimeseries
        ? {
            range: compareRange,
            kpis: compareKpis,
            timeseries: compareTimeseries,
          }
        : null,
    meta: {
      hasData,
    },
  };
}

export default async function HomeDashboardPage({
  searchParams,
}: HomeDashboardPageProps) {
  const accountId = await requireAccountId();
  const params = await searchParams;
  const data = await fetchDashboardData(
    accountId,
    params.period ?? null,
    params.compare ?? null
  );

  return <HomeDashboardClient initialData={data} />;
}
