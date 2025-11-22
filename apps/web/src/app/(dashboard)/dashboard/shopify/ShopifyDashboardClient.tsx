"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  ShopifyDashboardResponse,
  ShopifyDatePreset,
  ShopifyDateRange,
  ShopifyRecentOrder,
  ShopifyTimeseriesPoint,
} from "@/types/shopify-dashboard";

type DatePresetId = ShopifyDatePreset;

interface PolylineData {
  path: string;
  first: { x: number; y: number } | null;
  last: { x: number; y: number } | null;
}

const DATE_PRESETS: Array<{ id: DatePresetId; label: string }> = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last_7", label: "Last 7 days" },
  { id: "last_30", label: "Last 30 days" },
];

const DEFAULT_PRESET: DatePresetId = "last_7";

const currencyFormatterCache = new Map<string, Intl.NumberFormat>();
const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

function getCurrencyFormatter(currency: string): Intl.NumberFormat {
  if (!currencyFormatterCache.has(currency)) {
    currencyFormatterCache.set(
      currency,
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      })
    );
  }
  return currencyFormatterCache.get(currency)!;
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function startOfDay(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function computeRange(preset: DatePresetId): ShopifyDateRange {
  const today = startOfDay();
  let rangeEnd = today;
  let rangeStart = today;

  switch (preset) {
    case "today":
      rangeStart = today;
      break;
    case "yesterday":
      rangeEnd = addDays(today, -1);
      rangeStart = rangeEnd;
      break;
    case "last_7":
      rangeStart = addDays(today, -6);
      break;
    case "last_30":
      rangeStart = addDays(today, -29);
      break;
    default:
      rangeStart = addDays(today, -6);
      break;
  }

  return {
    from: toDateInputValue(rangeStart),
    to: toDateInputValue(rangeEnd),
  };
}

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function formatRangeLabel(range: ShopifyDateRange): string {
  return `${dateFormatter.format(parseDate(range.from))} – ${dateFormatter.format(parseDate(range.to))}`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: value >= 1000 ? 0 : 1,
  }).format(value);
}

function formatCurrency(value: number, currency: string): string {
  return getCurrencyFormatter(currency).format(value);
}

function formatOrderStatus(status: string | null): string {
  if (!status) {
    return "n/a";
  }
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function buildPolylinePoints(values: number[], maxValue: number, width: number, height: number): PolylineData {
  if (values.length === 0) {
    return { path: "", first: null, last: null };
  }

  const innerWidth = width - 32 * 2;
  const innerHeight = height - 32 * 2;
  const hasMultiplePoints = values.length > 1;

  const points = values.map((value, index) => {
    const normalized = maxValue === 0 ? 0 : clamp(value / maxValue, 0, 1);
    const x = hasMultiplePoints ? 32 + (innerWidth / (values.length - 1)) * index : width / 2;
    const y = 32 + innerHeight - normalized * innerHeight;
    return { x, y };
  });

  return {
    path: points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" "),
    first: points[0],
    last: points[points.length - 1],
  };
}

function TimeseriesChart(props: { series: ShopifyTimeseriesPoint[]; currency: string }) {
  if (props.series.length === 0) {
    return (
      <div
        style={{
          border: "1px dashed rgba(255,255,255,0.3)",
          borderRadius: "0.75rem",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        No daily metrics yet for this range.
      </div>
    );
  }

  const width = 760;
  const height = 280;
  const revenueValues = props.series.map((row) => row.revenue_net);
  const ordersValues = props.series.map((row) => row.orders);
  const revenueMax = Math.max(...revenueValues);
  const ordersMax = Math.max(...ordersValues);
  const revenuePolyline = buildPolylinePoints(revenueValues, revenueMax, width, height);
  const orderPolyline = buildPolylinePoints(ordersValues, ordersMax, width, height);

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.2)",
        borderRadius: "0.75rem",
        padding: "1rem",
        overflowX: "auto",
      }}
    >
      <svg
        role="img"
        aria-label="Revenue and orders timeseries"
        width={width}
        height={height}
        style={{ width: "100%", minWidth: "600px" }}
      >
        <defs>
          <linearGradient id="revenueArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(99,102,241,0.35)" />
            <stop offset="100%" stopColor="rgba(99,102,241,0)" />
          </linearGradient>
        </defs>
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="transparent"
          stroke="rgba(255,255,255,0.08)"
        />
        {revenuePolyline.path ? (
          <>
            <polyline
              points={revenuePolyline.path}
              fill="none"
              stroke="rgba(99,102,241,1)"
              strokeWidth={3}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {revenuePolyline.first && revenuePolyline.last ? (
              <polygon
                points={`${revenuePolyline.path} ${revenuePolyline.last.x.toFixed(1)},${(height - 32).toFixed(
                  1
                )} ${revenuePolyline.first.x.toFixed(1)},${(height - 32).toFixed(1)}`}
                fill="url(#revenueArea)"
                stroke="none"
              />
            ) : null}
          </>
        ) : null}
        {orderPolyline.path ? (
          <polyline
            points={orderPolyline.path}
            fill="none"
            stroke="rgba(34,211,238,1)"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray="6 4"
          />
        ) : null}
      </svg>
      <div
        style={{
          display: "flex",
          gap: "1.5rem",
          marginTop: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        <LegendSwatch
          label={`Revenue (net, ${props.currency})`}
          color="rgba(99,102,241,1)"
        />
        <LegendSwatch label="Orders" color="rgba(34,211,238,1)" dashed />
      </div>
    </div>
  );
}

function LegendSwatch(props: { label: string; color: string; dashed?: boolean }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.9rem" }}>
      <span
        style={{
          width: "1.5rem",
          height: "0.25rem",
          backgroundColor: props.dashed ? "transparent" : props.color,
          border: props.dashed ? `2px dashed ${props.color}` : undefined,
        }}
      />
      {props.label}
    </span>
  );
}

function RecentOrdersTable(props: { orders: ShopifyRecentOrder[]; currency: string }) {
  if (props.orders.length === 0) {
    return (
      <p style={{ margin: 0, opacity: 0.8 }}>No orders recorded in this period.</p>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          minWidth: "600px",
        }}
      >
        <thead>
          <tr style={{ textAlign: "left", fontSize: "0.85rem", textTransform: "uppercase" }}>
            <th style={{ padding: "0.75rem 0.5rem" }}>Date</th>
            <th style={{ padding: "0.75rem 0.5rem" }}>Order #</th>
            <th style={{ padding: "0.75rem 0.5rem" }}>Net revenue</th>
            <th style={{ padding: "0.75rem 0.5rem" }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {props.orders.map((order) => (
            <tr
              key={order.fact_order_id}
              style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}
            >
              <td style={{ padding: "0.75rem 0.5rem" }}>
                {dateFormatter.format(parseDate(order.order_date))}
              </td>
              <td style={{ padding: "0.75rem 0.5rem", fontFamily: "var(--font-geist-mono, monospace)" }}>
                {order.order_number ?? "—"}
              </td>
              <td style={{ padding: "0.75rem 0.5rem", fontWeight: 600 }}>
                {order.total_net !== null
                  ? formatCurrency(order.total_net, order.currency ?? props.currency)
                  : "—"}
              </td>
              <td style={{ padding: "0.75rem 0.5rem" }}>
                <span
                  style={{
                    display: "inline-flex",
                    padding: "0.15rem 0.5rem",
                    borderRadius: "999px",
                    backgroundColor: "rgba(255,255,255,0.1)",
                    fontSize: "0.85rem",
                  }}
                >
                  {formatOrderStatus(order.order_status)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ShopifyDashboardClient() {
  const [selectedPreset, setSelectedPreset] = useState<DatePresetId>(DEFAULT_PRESET);
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState<ShopifyDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => computeRange(selectedPreset), [selectedPreset]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    async function load() {
      try {
        const query = new URLSearchParams({
          from: range.from,
          to: range.to,
        }).toString();
        const response = await fetch(`/api/dashboard/shopify?${query}`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        let payload: unknown = null;
        try {
          payload = await response.json();
        } catch {
          payload = null;
        }

        if (!response.ok) {
          const message =
            payload &&
            typeof payload === "object" &&
            "error" in payload &&
            typeof (payload as { error?: unknown }).error === "string"
              ? (payload as { error: string }).error
              : "Failed to load Shopify dashboard data.";
          throw new Error(message);
        }

        setData(payload as ShopifyDashboardResponse);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        console.error("Failed to fetch Shopify dashboard data", err);
        setData(null);
        setError(err instanceof Error ? err.message : "Unable to load Shopify dashboard data.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => controller.abort();
  }, [range, reloadKey]);

  const currencyCode = data?.shop.currency ?? "USD";
  const summary = data?.summary ?? {
    orders: 0,
    revenue_gross: 0,
    revenue_net: 0,
    refunds: 0,
    aov: 0,
  };

  const headerSubtitle = data
    ? data.shop.shop_name ?? data.shop.myshopify_domain ?? "Connected Shopify store"
    : "Fetching store details…";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: "1rem",
        }}
      >
        <div>
          <p style={{ textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "0.08em" }}>
            Shopify Dashboard
          </p>
          <h1 style={{ fontSize: "2rem", marginTop: "0.35rem" }}>Store performance</h1>
          <p style={{ marginTop: "0.35rem", opacity: 0.8 }}>{headerSubtitle}</p>
        </div>
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: "0.75rem",
            padding: "0.85rem 1rem",
            minWidth: "220px",
          }}
        >
          <p style={{ fontSize: "0.8rem", textTransform: "uppercase", marginBottom: "0.25rem" }}>
            Range
          </p>
          <strong>{formatRangeLabel(range)}</strong>
        </div>
      </header>

      <section
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        {DATE_PRESETS.map((preset) => {
          const isActive = selectedPreset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => setSelectedPreset(preset.id)}
              disabled={loading && isActive}
              style={{
                padding: "0.65rem 1.25rem",
                borderRadius: "999px",
                border: isActive ? "1px solid transparent" : "1px solid rgba(255,255,255,0.4)",
                backgroundColor: isActive ? "var(--foreground)" : "transparent",
                color: isActive ? "var(--background)" : "inherit",
                cursor: isActive ? "default" : "pointer",
                fontWeight: 600,
              }}
            >
              {preset.label}
            </button>
          );
        })}
      </section>

      {error ? (
        <div
          style={{
            border: "1px solid rgba(239,68,68,0.5)",
            background: "rgba(239,68,68,0.1)",
            borderRadius: "0.75rem",
            padding: "1rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            style={{
              borderRadius: "0.5rem",
              border: "none",
              padding: "0.55rem 1rem",
              backgroundColor: "rgba(239,68,68,0.9)",
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      ) : null}

      {loading && (
        <div
          style={{
            border: "1px dashed rgba(255,255,255,0.3)",
            borderRadius: "0.75rem",
            padding: "1rem",
            fontSize: "0.95rem",
            opacity: 0.8,
          }}
        >
          Loading Shopify metrics…
        </div>
      )}

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
        }}
      >
        <KpiCard label="Orders" value={formatNumber(summary.orders)} />
        <KpiCard label="Revenue (net)" value={formatCurrency(summary.revenue_net, currencyCode)} />
        <KpiCard label="Refunds" value={formatCurrency(summary.refunds, currencyCode)} />
        <KpiCard label="AOV" value={formatCurrency(summary.aov, currencyCode)} />
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Revenue vs. orders</h2>
          <span style={{ fontSize: "0.85rem", opacity: 0.7 }}>
            Showing {summary.orders.toLocaleString()} orders
          </span>
        </div>
        {data ? (
          <TimeseriesChart series={data.timeseries} currency={currencyCode} />
        ) : (
          <div
            style={{
              border: "1px dashed rgba(255,255,255,0.3)",
              borderRadius: "0.75rem",
              padding: "2rem",
              textAlign: "center",
              opacity: 0.8,
            }}
          >
            We’ll render the chart as soon as the API responds.
          </div>
        )}
      </section>

      {!loading && data && !data.meta.hasData ? (
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: "0.75rem",
            padding: "1rem",
          }}
        >
          <p style={{ marginBottom: "0.5rem" }}>No Shopify data yet.</p>
          <p style={{ opacity: 0.8 }}>
            We haven’t synced orders for this range. Verify your Shopify connection or try a
            different date window once the initial sync finishes.
          </p>
        </div>
      ) : null}

      <section style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Recent orders</h2>
          <span style={{ fontSize: "0.85rem", opacity: 0.7 }}>
            Latest {data?.recentOrders.length ?? 0} orders in this window
          </span>
        </div>
        <RecentOrdersTable orders={data?.recentOrders ?? []} currency={currencyCode} />
      </section>
    </div>
  );
}

function KpiCard(props: { label: string; value: string }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.25)",
        borderRadius: "0.75rem",
        padding: "1rem",
      }}
    >
      <p style={{ fontSize: "0.85rem", textTransform: "uppercase", opacity: 0.7 }}>{props.label}</p>
      <p style={{ fontSize: "1.75rem", fontWeight: 600, marginTop: "0.5rem" }}>{props.value}</p>
    </div>
  );
}


