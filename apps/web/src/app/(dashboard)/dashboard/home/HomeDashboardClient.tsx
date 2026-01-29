"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { HomeDashboardResponse, HomePeriodPreset } from "@/types/home-dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataFreshnessBadge } from "@/components/dashboard/DataFreshnessBadge";
import { MetricDefinition } from "@/components/dashboard/MetricDefinition";
import { cn } from "@/lib/utils";

const PERIOD_OPTIONS: Array<{ id: HomePeriodPreset; label: string }> = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last_7", label: "Last 7" },
  { id: "last_30", label: "Last 30" },
];

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatRatio(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0.00×";
  if (value >= 100) return `${value.toFixed(0)}×`;
  if (value >= 10) return `${value.toFixed(1)}×`;
  return `${value.toFixed(2)}×`;
}

function formatDateShort(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function formatDateRange(from: string, to: string): string {
  return `${formatDateShort(from)} – ${formatDateShort(to)}`;
}

function formatDelta(value: number, currency?: string): string {
  if (!Number.isFinite(value)) return "—";
  if (currency) return formatCurrency(value, currency);
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toLocaleString()}`;
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value * 100).toFixed(1)}%`;
}

interface HomeDashboardClientProps {
  initialData: HomeDashboardResponse;
}

export default function HomeDashboardClient({ initialData }: HomeDashboardClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPeriod = (searchParams.get("period") as HomePeriodPreset) || initialData.period.preset;
  const compareEnabled = searchParams.get("compare") === "1" || searchParams.get("compare") === "true";

  const handlePeriodChange = (period: HomePeriodPreset) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", period);
    router.push(`?${params.toString()}`);
  };

  const handleCompareToggle = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (compareEnabled) {
      params.delete("compare");
    } else {
      params.set("compare", "1");
    }
    router.push(`?${params.toString()}`);
  };

  const currency = initialData.currency;
  const kpis = initialData.kpis;
  const compare = initialData.compare;
  const compareKpis = compare?.kpis ?? null;
  const hasData = initialData.meta.hasData;

  const chartData = initialData.timeseries.map((point, index) => {
    const prev = compare?.timeseries?.[index] ?? null;
    return {
      date: formatDateShort(point.date),
      revenue: point.revenue_net,
      spend: point.meta_spend,
      mer: point.mer,
      revenue_prev: prev?.revenue_net ?? null,
      spend_prev: prev?.meta_spend ?? null,
      mer_prev: prev?.mer ?? null,
    };
  });

  const kpiDeltas = compareKpis
    ? {
        revenue_net: {
          delta: kpis.revenue_net - compareKpis.revenue_net,
          pct:
            compareKpis.revenue_net > 0
              ? (kpis.revenue_net - compareKpis.revenue_net) / compareKpis.revenue_net
              : null,
        },
        meta_spend: {
          delta: kpis.meta_spend - compareKpis.meta_spend,
          pct:
            compareKpis.meta_spend > 0
              ? (kpis.meta_spend - compareKpis.meta_spend) / compareKpis.meta_spend
              : null,
        },
        mer: {
          delta: kpis.mer - compareKpis.mer,
          pct: compareKpis.mer > 0 ? (kpis.mer - compareKpis.mer) / compareKpis.mer : null,
        },
        roas: {
          delta: kpis.roas - compareKpis.roas,
          pct: compareKpis.roas > 0 ? (kpis.roas - compareKpis.roas) / compareKpis.roas : null,
        },
        aov: {
          delta: kpis.aov - compareKpis.aov,
          pct: compareKpis.aov > 0 ? (kpis.aov - compareKpis.aov) / compareKpis.aov : null,
        },
        orders: {
          delta: kpis.orders - compareKpis.orders,
          pct:
            compareKpis.orders > 0 ? (kpis.orders - compareKpis.orders) / compareKpis.orders : null,
        },
      }
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Analytics overview</h1>
            <DataFreshnessBadge asOf={kpis.as_of} />
          </div>
          <p className="text-sm text-muted-foreground">
            Blended performance across Shopify revenue and Meta advertising spend.
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDateRange(initialData.period.from, initialData.period.to)}
            {compareEnabled && compare ? (
              <span className="ml-2">
                · Comparing to {formatDateRange(compare.range.from, compare.range.to)}
              </span>
            ) : null}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="inline-flex w-full flex-wrap items-center gap-1 rounded-md border bg-card p-1 sm:w-auto">
              {PERIOD_OPTIONS.map((option) => (
                <Button
                  key={option.id}
                  variant={currentPeriod === option.id ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-3"
                  onClick={() => handlePeriodChange(option.id)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <Button
              variant={compareEnabled ? "secondary" : "outline"}
              size="sm"
              className="h-8"
              onClick={handleCompareToggle}
              disabled={compareEnabled && !compare}
              title={compareEnabled && !compare ? "Compare data unavailable" : "Compare to previous period"}
            >
              Compare
            </Button>
          </div>
        </div>
      </div>

      {/* Empty-first experience */}
      {!hasData ? (
        <Card>
          <CardContent className="py-10">
            <div className="mx-auto max-w-lg text-center space-y-2">
              <div className="text-lg font-semibold">No data yet</div>
              <div className="text-sm text-muted-foreground">
                Connect your Shopify store (and optionally Meta) to start seeing blended performance.
              </div>
              <div className="pt-2">
                <Button asChild>
                  <a href="/settings">Connect integrations</a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* KPI strip */}
      {hasData ? (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="space-y-0 pb-2">
            <div className="text-sm font-medium flex items-center gap-1">
              Revenue (net) <MetricDefinition metric="revenue_net" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {formatCurrency(kpis.revenue_net, currency)}
            </div>
            {kpiDeltas ? (
              <div
                className={cn(
                  "mt-1 text-xs",
                  kpiDeltas.revenue_net.delta > 0
                    ? "text-emerald-600"
                    : kpiDeltas.revenue_net.delta < 0
                      ? "text-red-600"
                      : "text-muted-foreground"
                )}
              >
                {formatDelta(kpiDeltas.revenue_net.delta, currency)} ({formatPercent(kpiDeltas.revenue_net.pct)})
              </div>
            ) : (
              <div className="mt-1 text-xs text-muted-foreground">—</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-0 pb-2">
            <div className="text-sm font-medium flex items-center gap-1">
              Meta spend <MetricDefinition metric="meta_spend" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {kpis.meta_spend > 0 ? formatCurrency(kpis.meta_spend, currency) : "—"}
            </div>
            {kpiDeltas ? (
              <div
                className={cn(
                  "mt-1 text-xs",
                  kpiDeltas.meta_spend.delta < 0
                    ? "text-emerald-600"
                    : kpiDeltas.meta_spend.delta > 0
                      ? "text-red-600"
                      : "text-muted-foreground"
                )}
              >
                {formatDelta(kpiDeltas.meta_spend.delta, currency)} ({formatPercent(kpiDeltas.meta_spend.pct)})
              </div>
            ) : (
              <div className="mt-1 text-xs text-muted-foreground">—</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-0 pb-2">
            <div className="text-sm font-medium flex items-center gap-1">
              MER <MetricDefinition metric="mer" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {kpis.meta_spend > 0 && kpis.mer > 0 ? formatRatio(kpis.mer) : "—"}
            </div>
            {kpiDeltas ? (
              <div
                className={cn(
                  "mt-1 text-xs",
                  kpiDeltas.mer.delta > 0
                    ? "text-emerald-600"
                    : kpiDeltas.mer.delta < 0
                      ? "text-red-600"
                      : "text-muted-foreground"
                )}
              >
                {formatRatio(kpiDeltas.mer.delta)} ({formatPercent(kpiDeltas.mer.pct)})
              </div>
            ) : (
              <div className="mt-1 text-xs text-muted-foreground">—</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-0 pb-2">
            <div className="text-sm font-medium flex items-center gap-1">
              Orders <MetricDefinition metric="orders" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">{kpis.orders.toLocaleString()}</div>
            {kpiDeltas ? (
              <div
                className={cn(
                  "mt-1 text-xs",
                  kpiDeltas.orders.delta > 0
                    ? "text-emerald-600"
                    : kpiDeltas.orders.delta < 0
                      ? "text-red-600"
                      : "text-muted-foreground"
                )}
              >
                {formatDelta(kpiDeltas.orders.delta)} ({formatPercent(kpiDeltas.orders.pct)})
              </div>
            ) : (
              <div className="mt-1 text-xs text-muted-foreground">—</div>
            )}
          </CardContent>
        </Card>
      </div>
      ) : null}

      {/* Main panel */}
      {hasData ? (
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue and spend</CardTitle>
            <CardDescription>
              Daily revenue (net) and Meta spend for the selected range
              {compareEnabled && compare ? " (with previous period overlay)" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={340}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value ?? 0), currency)}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                    }}
                  />
                  <Legend />

                  {compareEnabled && compare ? (
                    <>
                      <Line
                        type="monotone"
                        dataKey="revenue_prev"
                        stroke="hsl(142, 71%, 45%)"
                        strokeWidth={2}
                        strokeDasharray="6 4"
                        opacity={0.45}
                        name="Revenue (prev)"
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="spend_prev"
                        stroke="hsl(217, 91%, 60%)"
                        strokeWidth={2}
                        strokeDasharray="6 4"
                        opacity={0.45}
                        name="Spend (prev)"
                        dot={false}
                      />
                    </>
                  ) : null}

                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(142, 71%, 45%)"
                    strokeWidth={2}
                    name="Revenue (net)"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="spend"
                    stroke="hsl(217, 91%, 60%)"
                    strokeWidth={2}
                    name="Meta spend"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[340px] items-center justify-center text-muted-foreground">
                No data available for this period
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Breakdown</CardTitle>
            <CardDescription>Key metrics for the selected range</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  AOV <MetricDefinition metric="aov" />
                </div>
                <div className="text-lg font-semibold tabular-nums">
                  {formatCurrency(kpis.aov, currency)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  ROAS <MetricDefinition metric="roas" />
                </div>
                <div className="text-lg font-semibold tabular-nums">
                  {kpis.roas > 0 ? formatRatio(kpis.roas) : "—"}
                </div>
              </div>
            </div>

            {compareEnabled && compare && compareKpis ? (
              <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
                <div className="font-medium text-foreground">Compared to previous period</div>
                <div>Revenue: {formatPercent(kpiDeltas?.revenue_net.pct ?? null)}</div>
                <div>Spend: {formatPercent(kpiDeltas?.meta_spend.pct ?? null)}</div>
                <div>Orders: {formatPercent(kpiDeltas?.orders.pct ?? null)}</div>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">
                Turn on <span className="font-medium text-foreground">Compare</span> to see deltas vs the previous period.
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Button variant="outline" asChild>
                <a href="/dashboard/shopify">Open Shopify dashboard</a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/dashboard/meta">Open Meta dashboard</a>
              </Button>
              <Button asChild>
                <a href="/settings">Manage integrations</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      ) : null}

      {/* When empty, avoid showing "0" KPIs and empty charts above. */}
    </div>
  );
}
