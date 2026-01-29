"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { ShopifyDashboardResponse } from "@/types/shopify-dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataFreshnessBadge } from "@/components/dashboard/DataFreshnessBadge";
import { Badge } from "@/components/ui/badge";

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

interface ShopifyDashboardClientProps {
  initialData: ShopifyDashboardResponse;
}

export default function ShopifyDashboardClient({ initialData }: ShopifyDashboardClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shop = initialData.shop;
  const summary = initialData.summary;
  const currency = shop.currency || "USD";

  // Prepare chart data
  const chartData = initialData.timeseries.map((point) => ({
    date: new Date(point.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    revenue: point.revenue_net,
    orders: point.orders,
    refunds: point.refunds,
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
              {shop.shop_name || shop.myshopify_domain || "Shopify Dashboard"}
            </h1>
            <DataFreshnessBadge asOf={null} />
          </div>
          <p className="text-muted-foreground mt-1">
            {shop.myshopify_domain && (
              <span className="text-sm">{shop.myshopify_domain}</span>
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
            <CardTitle className="text-sm font-medium">Revenue (Net)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.revenue_net, currency)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Gross: {formatCurrency(summary.revenue_gross, currency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(summary.orders)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AOV</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.aov, currency)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Refunds</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.refunds, currency)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue & Orders</CardTitle>
            <CardDescription>Daily revenue and order count over time</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis yAxisId="left" className="text-xs" />
                  <YAxis yAxisId="right" orientation="right" className="text-xs" />
                  <Tooltip
                    formatter={(value, name) => {
                      const numeric = Number(value ?? 0);
                      if (name === "revenue" || name === "refunds") {
                        return formatCurrency(numeric, currency);
                      }
                      return formatNumber(numeric);
                    }}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(142, 71%, 45%)"
                    strokeWidth={2}
                    name="Revenue (Net)"
                    dot={{ r: 4 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="orders"
                    stroke="hsl(217, 91%, 60%)"
                    strokeWidth={2}
                    name="Orders"
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
            <CardTitle>Refunds</CardTitle>
            <CardDescription>Daily refund amount over time</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value ?? 0), currency)}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="refunds"
                    stroke="hsl(0, 84%, 60%)"
                    strokeWidth={2}
                    name="Refunds"
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

      {/* Recent Orders */}
      {initialData.recentOrders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
            <CardDescription>Latest orders from the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {initialData.recentOrders.slice(0, 10).map((order) => (
                <div
                  key={order.fact_order_id}
                  className="flex items-center justify-between p-3 border rounded-md hover:bg-accent transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {order.order_number ? `#${order.order_number}` : "Order"}
                      </span>
                      {order.order_status && (
                        <Badge variant="outline" className="text-xs">
                          {order.order_status}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {new Date(order.order_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    {order.total_net !== null && (
                      <div className="font-semibold">
                        {formatCurrency(order.total_net, order.currency || currency)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!initialData.meta.hasData && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center text-center py-8">
              <h3 className="text-lg font-semibold mb-2">No data available</h3>
              <p className="text-muted-foreground mb-4 max-w-md">
                No orders found for the selected period. Try adjusting the date range or check your Shopify integration.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
