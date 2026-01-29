"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { MetaDashboardResponse } from "@/types/meta-dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataFreshnessBadge } from "@/components/dashboard/DataFreshnessBadge";
import { MetricDefinition } from "@/components/dashboard/MetricDefinition";

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString();
}

function formatRatio(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0.00×";
  if (value >= 100) return `${value.toFixed(0)}×`;
  if (value >= 10) return `${value.toFixed(1)}×`;
  return `${value.toFixed(2)}×`;
}

interface MetaDashboardClientProps {
  initialData: MetaDashboardResponse;
}

export default function MetaDashboardClient({ initialData }: MetaDashboardClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const adAccount = initialData.adAccount;
  const summary = initialData.summary;
  const currency = adAccount.currency || "USD";

  // Prepare chart data
  const chartData = initialData.timeseries.map((point) => ({
    date: new Date(point.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    spend: point.spend,
    purchaseValue: point.purchase_value,
    roas: point.roas ?? 0,
    purchases: point.purchases,
  }));

  const handleDateChange = (from: string, to: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", from);
    params.set("to", to);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">
              {adAccount.display_name || adAccount.platform_ad_account_id || "Meta Dashboard"}
            </h1>
            <DataFreshnessBadge asOf={null} />
          </div>
          <p className="text-muted-foreground mt-1">
            {adAccount.platform_ad_account_id && (
              <span className="text-sm">{adAccount.platform_ad_account_id}</span>
            )}
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const today = new Date();
              const yesterday = new Date(today);
              yesterday.setDate(yesterday.getDate() - 1);
              handleDateChange(yesterday.toISOString().split("T")[0], yesterday.toISOString().split("T")[0]);
            }}
          >
            Yesterday
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const today = new Date();
              const last7 = new Date(today);
              last7.setDate(last7.getDate() - 6);
              handleDateChange(last7.toISOString().split("T")[0], today.toISOString().split("T")[0]);
            }}
          >
            Last 7 days
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const today = new Date();
              const last30 = new Date(today);
              last30.setDate(last30.getDate() - 29);
              handleDateChange(last30.toISOString().split("T")[0], today.toISOString().split("T")[0]);
            }}
          >
            Last 30 days
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              Spend
              <MetricDefinition metric="meta_spend" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.spend, currency)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              ROAS
              <MetricDefinition metric="roas" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatRatio(summary.roas)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Purchases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(summary.purchases)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Purchase Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.purchase_value, currency)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Spend vs Purchase Value</CardTitle>
            <CardDescription>Daily ad spend and attributed purchase value</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    formatter={(value, name) => {
                      const numeric = Number(value ?? 0);
                      if (name === "spend" || name === "purchaseValue") {
                        return formatCurrency(numeric, currency);
                      }
                      return formatNumber(numeric);
                    }}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="spend"
                    stroke="hsl(217, 91%, 60%)"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    name="Spend"
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="purchaseValue"
                    stroke="hsl(142, 71%, 45%)"
                    strokeWidth={2}
                    name="Purchase Value"
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                No data available for this period
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ROAS Trend</CardTitle>
            <CardDescription>Return on ad spend over time</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    formatter={(value) => formatRatio(Number(value ?? 0))}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="roas"
                    stroke="hsl(38, 92%, 50%)"
                    strokeWidth={2}
                    name="ROAS"
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                No data available for this period
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Empty State */}
      {!initialData.meta.hasData && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center text-center py-8">
              <h3 className="text-lg font-semibold mb-2">No data available</h3>
              <p className="text-muted-foreground mb-4 max-w-md">
                No Meta ad data found for the selected period. Try adjusting the date range or check your Meta integration.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
