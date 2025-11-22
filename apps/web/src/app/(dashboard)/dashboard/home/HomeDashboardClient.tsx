"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  HomeDashboardResponse,
  HomePeriodPreset,
  HomePeriodRange,
  HomeTimeseriesPoint,
} from "@/types/home-dashboard";

type PeriodPreset = HomePeriodPreset;

interface PolylineData {
  path: string;
  first: { x: number; y: number } | null;
  last: { x: number; y: number } | null;
}

const PERIOD_PRESETS: Array<{ id: PeriodPreset; label: string }> = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last_7", label: "Last 7 days" },
  { id: "last_30", label: "Last 30 days" },
];

const DEFAULT_PRESET: PeriodPreset = "last_7";

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const currencyFormatterCache = new Map<string, Intl.NumberFormat>();

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

function startOfDay(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function computeRange(preset: PeriodPreset): HomePeriodRange {
  const today = startOfDay();
  const rangeStart = new Date(today);
  const rangeEnd = new Date(today);

  switch (preset) {
    case "today":
      break;
    case "yesterday":
      rangeStart.setUTCDate(rangeStart.getUTCDate() - 1);
      rangeEnd.setUTCDate(rangeEnd.getUTCDate() - 1);
      break;
    case "last_7":
      rangeStart.setUTCDate(rangeStart.getUTCDate() - 6);
      break;
    case "last_30":
      rangeStart.setUTCDate(rangeStart.getUTCDate() - 29);
      break;
    default:
      rangeStart.setUTCDate(rangeStart.getUTCDate() - 6);
      break;
  }

  return {
    preset,
    from: toDateInputValue(rangeStart),
    to: toDateInputValue(rangeEnd),
  };
}

function formatRangeLabel(range: HomePeriodRange): string {
  return `${dateFormatter.format(parseDate(range.from))} – ${dateFormatter.format(parseDate(range.to))}`;
}

function formatCurrency(value: number, currency: string): string {
  return getCurrencyFormatter(currency).format(value);
}

function formatRatio(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "0.00×";
  }
  if (value >= 100) {
    return `${value.toFixed(0)}×`;
  }
  if (value >= 10) {
    return `${value.toFixed(1)}×`;
  }
  return `${value.toFixed(2)}×`;
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "n/a";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
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

function TimeseriesChart(props: { series: HomeTimeseriesPoint[]; currency: string }) {
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
        No blended metrics yet for this range.
      </div>
    );
  }

  const width = 820;
  const height = 320;

  const revenueValues = props.series.map((point) => point.revenue_net);
  const spendValues = props.series.map((point) => point.meta_spend);
  const merValues = props.series.map((point) => (Number.isFinite(point.mer) ? point.mer : 0));

  const maxCurrency = Math.max(0, ...revenueValues, ...spendValues);
  const safeCurrency = maxCurrency === 0 ? 1 : maxCurrency;
  const maxMer = Math.max(0, ...merValues);
  const safeMer = maxMer === 0 ? 1 : maxMer;

  const revenueLine = buildPolylinePoints(revenueValues, safeCurrency, width, height);
  const spendLine = buildPolylinePoints(spendValues, safeCurrency, width, height);
  const merLine = buildPolylinePoints(merValues, safeMer, width, height);

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
        aria-label="Revenue vs spend vs MER"
        width={width}
        height={height}
        style={{ width: "100%", minWidth: "640px" }}
      >
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="transparent"
          stroke="rgba(255,255,255,0.08)"
        />
        {revenueLine.path ? (
          <polyline
            points={revenueLine.path}
            fill="none"
            stroke="rgba(16,185,129,1)"
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {spendLine.path ? (
          <polyline
            points={spendLine.path}
            fill="none"
            stroke="rgba(59,130,246,1)"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray="6 4"
          />
        ) : null}
        {merLine.path ? (
          <polyline
            points={merLine.path}
            fill="none"
            stroke="rgba(250,204,21,1)"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray="4 3"
          />
        ) : null}
      </svg>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "1.5rem",
          marginTop: "0.75rem",
          alignItems: "center",
        }}
      >
        <LegendSwatch label={`Revenue (net, ${props.currency})`} color="rgba(16,185,129,1)" />
        <LegendSwatch label={`Meta spend (${props.currency})`} color="rgba(59,130,246,1)" dashed />
        <LegendSwatch label="MER (right axis)" color="rgba(250,204,21,1)" dashed />
      </div>
      <p style={{ marginTop: "0.5rem", fontSize: "0.85rem", opacity: 0.7 }}>
        Revenue & spend share the left axis. MER uses the right axis.
      </p>
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

export default function HomeDashboardClient() {
  const [preset, setPreset] = useState<PeriodPreset>(DEFAULT_PRESET);
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState<HomeDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const optimisticRange = useMemo(() => computeRange(preset), [preset]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    async function load() {
      try {
        const response = await fetch(`/api/dashboard/home?period=${preset}`, {
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
              : "Failed to load home dashboard data.";
          throw new Error(message);
        }

        setData(payload as HomeDashboardResponse);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        console.error("Failed to fetch home dashboard data", err);
        setError(err instanceof Error ? err.message : "Unable to load home dashboard data.");
        setData(null);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    load();
    return () => controller.abort();
  }, [preset, reloadKey]);

  const kpis = data?.kpis ?? {
    revenue_net: 0,
    meta_spend: 0,
    mer: 0,
    roas: 0,
    aov: 0,
    as_of: null,
  };

  const periodRange = data?.period ?? optimisticRange;
  const currency = data?.currency ?? "USD";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
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
            Home Dashboard
          </p>
          <h1 style={{ fontSize: "2.2rem", marginTop: "0.35rem" }}>Full-funnel performance</h1>
          <p style={{ marginTop: "0.35rem", opacity: 0.8 }}>
            Blended view across Shopify revenue & Meta spend.
          </p>
        </div>
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: "0.75rem",
            padding: "0.85rem 1rem",
            minWidth: "260px",
          }}
        >
          <p style={{ fontSize: "0.8rem", textTransform: "uppercase", marginBottom: "0.25rem" }}>
            Selected period
          </p>
          <strong>{formatRangeLabel(periodRange)}</strong>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.85rem", opacity: 0.7 }}>
            As of {formatTimestamp(kpis.as_of)}
          </p>
        </div>
      </header>

      <section
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        {PERIOD_PRESETS.map((option) => {
          const isActive = preset === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setPreset(option.id)}
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
              {option.label}
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

      {loading ? (
        <div
          style={{
            border: "1px dashed rgba(255,255,255,0.3)",
            borderRadius: "0.75rem",
            padding: "1rem",
            fontSize: "0.95rem",
            opacity: 0.8,
          }}
        >
          Loading blended metrics…
        </div>
      ) : null}

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
        }}
      >
        <KpiCard label="Revenue (net)" value={formatCurrency(kpis.revenue_net, currency)} />
        <KpiCard label="Meta spend" value={formatCurrency(kpis.meta_spend, currency)} />
        <KpiCard label="MER" value={formatRatio(kpis.mer)} />
        <KpiCard label="ROAS" value={formatRatio(kpis.roas)} />
        <KpiCard label="AOV" value={formatCurrency(kpis.aov, currency)} />
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          <h2 style={{ margin: 0 }}>Revenue vs spend + MER</h2>
          <span style={{ fontSize: "0.85rem", opacity: 0.7 }}>
            {data?.timeseries?.length
              ? `Showing ${data.timeseries.length} day${data.timeseries.length === 1 ? "" : "s"}`
              : "Awaiting timeseries data"}
          </span>
        </div>
        {data ? (
          <TimeseriesChart series={data.timeseries} currency={currency} />
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
          <p style={{ marginBottom: "0.5rem" }}>No blended metrics yet.</p>
          <p style={{ opacity: 0.8 }}>
            We haven’t completed a Shopify + Meta sync for this period. Verify your connections or run a
            manual sync from Settings once the integrations finish onboarding.
          </p>
        </div>
      ) : null}

      <section
        style={{
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: "0.75rem",
          padding: "1rem",
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.75rem",
          alignItems: "center",
        }}
      >
        <div>
          <h3 style={{ margin: "0 0 0.25rem" }}>Need fresher data?</h3>
          <p style={{ margin: 0, opacity: 0.75 }}>
            Head to Settings &gt; Sync Status to trigger a manual sync per integration.
          </p>
        </div>
        <a
          href="/settings"
          style={{
            borderRadius: "999px",
            border: "1px solid rgba(255,255,255,0.4)",
            padding: "0.6rem 1.2rem",
            fontWeight: 600,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          View sync status
        </a>
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


