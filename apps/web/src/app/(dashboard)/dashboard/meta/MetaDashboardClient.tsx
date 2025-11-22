"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  MetaDashboardResponse,
  MetaDatePreset,
  MetaDateRange,
  MetaTimeseriesPoint,
} from "@/types/meta-dashboard";

type DatePresetId = MetaDatePreset;

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

function computeRange(preset: DatePresetId): MetaDateRange {
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

function formatRangeLabel(range: MetaDateRange): string {
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

function formatRoas(value: number): string {
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

function TimeseriesChart(props: { series: MetaTimeseriesPoint[]; currency: string }) {
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
        No Meta spend or revenue recorded yet for this range.
      </div>
    );
  }

  const width = 780;
  const height = 320;
  const spendValues = props.series.map((row) => row.spend);
  const purchaseValues = props.series.map((row) => row.purchase_value);
  const roasValues = props.series.map((row) => (row.roas ?? 0));
  const currencyMax = Math.max(0, ...spendValues, ...purchaseValues);
  const safeCurrencyMax = currencyMax === 0 ? 1 : currencyMax;
  const roasMax = Math.max(0, ...roasValues);
  const safeRoasMax = roasMax === 0 ? 1 : roasMax;

  const spendPolyline = buildPolylinePoints(spendValues, safeCurrencyMax, width, height);
  const purchasesPolyline = buildPolylinePoints(purchaseValues, safeCurrencyMax, width, height);
  const roasPolyline = buildPolylinePoints(roasValues, safeRoasMax, width, height);

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
        aria-label="Meta spend, purchase value, and ROAS timeseries"
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
        {spendPolyline.path ? (
          <polyline
            points={spendPolyline.path}
            fill="none"
            stroke="rgba(59,130,246,1)"
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {purchasesPolyline.path ? (
          <polyline
            points={purchasesPolyline.path}
            fill="none"
            stroke="rgba(147,197,253,1)"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray="6 4"
          />
        ) : null}
        {roasPolyline.path ? (
          <polyline
            points={roasPolyline.path}
            fill="none"
            stroke="rgba(251,191,36,1)"
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
          gap: "1.5rem",
          marginTop: "0.75rem",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <LegendSwatch label={`Spend (${props.currency})`} color="rgba(59,130,246,1)" />
        <LegendSwatch label={`Purchase value (${props.currency})`} color="rgba(147,197,253,1)" dashed />
        <LegendSwatch label="ROAS (right axis)" color="rgba(251,191,36,1)" dashed />
      </div>
      <p style={{ marginTop: "0.5rem", fontSize: "0.85rem", opacity: 0.7 }}>
        Spend & purchase value share the left axis; ROAS uses the right axis.
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

export default function MetaDashboardClient() {
  const [selectedPreset, setSelectedPreset] = useState<DatePresetId>(DEFAULT_PRESET);
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState<MetaDashboardResponse | null>(null);
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
        const response = await fetch(`/api/dashboard/meta?${query}`, {
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
              : "Failed to load Meta dashboard data.";
          throw new Error(message);
        }

        setData(payload as MetaDashboardResponse);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        console.error("Failed to fetch Meta dashboard data", err);
        setData(null);
        setError(err instanceof Error ? err.message : "Unable to load Meta dashboard data.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => controller.abort();
  }, [range, reloadKey]);

  const currencyCode = data?.adAccount.currency ?? "USD";
  const summary = data?.summary ?? {
    spend: 0,
    purchases: 0,
    purchase_value: 0,
    roas: 0,
  };

  const headerSubtitle = data
    ? data.adAccount.display_name ?? data.adAccount.platform_ad_account_id ?? "Connected Meta ad account"
    : "Fetching ad account details…";

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
            Meta Dashboard
          </p>
          <h1 style={{ fontSize: "2rem", marginTop: "0.35rem" }}>Ad performance</h1>
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
          Loading Meta metrics…
        </div>
      )}

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
        }}
      >
        <KpiCard label="Spend" value={formatCurrency(summary.spend, currencyCode)} />
        <KpiCard label="Purchases" value={formatNumber(summary.purchases)} />
        <KpiCard label="Purchase value" value={formatCurrency(summary.purchase_value, currencyCode)} />
        <KpiCard label="ROAS" value={formatRoas(summary.roas)} />
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Spend vs. revenue + ROAS</h2>
          <span style={{ fontSize: "0.85rem", opacity: 0.7 }}>
            {timeseriesLabel(data?.timeseries ?? [])}
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
          <p style={{ marginBottom: "0.5rem" }}>No Meta data yet.</p>
          <p style={{ opacity: 0.8 }}>
            We haven’t completed a Meta sync for this range. Once the worker finishes the first sync,
            your spend and purchase metrics will appear here. Try a different date window or run a manual
            sync if needed.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function timeseriesLabel(series: MetaTimeseriesPoint[]): string {
  if (!series.length) {
    return "Awaiting timeseries data";
  }
  return `Showing ${series.length} day${series.length === 1 ? "" : "s"}`;
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

