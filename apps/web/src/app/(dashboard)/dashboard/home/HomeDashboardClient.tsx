"use client";

import { useEffect, useState } from "react";

type PeriodPreset = "today" | "yesterday" | "last_7" | "last_30";

interface KPIData {
  revenue_net: number;
  meta_spend: number;
  mer: number;
  roas: number;
  aov: number;
  orders: number;
}

interface TimeseriesPoint {
  date: string;
  revenue_net: number;
  meta_spend: number;
  mer: number;
}

interface DashboardData {
  kpis: KPIData;
  timeseries: TimeseriesPoint[];
  currency: string;
  hasData: boolean;
}

const PERIOD_OPTIONS: Array<{ id: PeriodPreset; label: string }> = [
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

// Combined Line Chart for Revenue vs Spend
function RevenueSpendChart({ data, currency }: { data: TimeseriesPoint[]; currency: string }) {
  if (data.length === 0) {
    return (
      <div className="chart-placeholder">
        No data available for this period
      </div>
    );
  }

  const width = 600;
  const height = 220;
  const padding = 40;

  const revenueValues = data.map((d) => d.revenue_net);
  const spendValues = data.map((d) => d.meta_spend);
  const maxValue = Math.max(...revenueValues, ...spendValues, 1);

  const revenuePoints = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * (width - padding * 2);
    const y = height - padding - (d.revenue_net / maxValue) * (height - padding * 2);
    return { x, y };
  });

  const spendPoints = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * (width - padding * 2);
    const y = height - padding - (d.meta_spend / maxValue) * (height - padding * 2);
    return { x, y };
  });

  const revenuePath = revenuePoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const spendPath = spendPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "100%" }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = height - padding - ratio * (height - padding * 2);
        return (
          <line
            key={ratio}
            x1={padding}
            y1={y}
            x2={width - padding}
            y2={y}
            stroke="#e2e8f0"
            strokeDasharray="4"
          />
        );
      })}

      {/* Revenue line */}
      <path
        d={revenuePath}
        fill="none"
        stroke="#10b981"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Spend line */}
      <path
        d={spendPath}
        fill="none"
        stroke="#3b82f6"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="6 4"
      />

      {/* Data points */}
      {revenuePoints.map((p, i) => (
        <circle key={`r-${i}`} cx={p.x} cy={p.y} r="3" fill="#10b981" />
      ))}
      {spendPoints.map((p, i) => (
        <circle key={`s-${i}`} cx={p.x} cy={p.y} r="3" fill="#3b82f6" />
      ))}
    </svg>
  );
}

// MER Trend Chart
function MERChart({ data }: { data: TimeseriesPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="chart-placeholder">
        No data available
      </div>
    );
  }

  const width = 400;
  const height = 200;
  const padding = 40;

  const merValues = data.map((d) => d.mer);
  const maxMer = Math.max(...merValues, 1);

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * (width - padding * 2);
    const y = height - padding - (d.mer / maxMer) * (height - padding * 2);
    return { x, y };
  });

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "100%" }}>
      {/* Grid */}
      {[0, 0.5, 1].map((ratio) => {
        const y = height - padding - ratio * (height - padding * 2);
        return (
          <line
            key={ratio}
            x1={padding}
            y1={y}
            x2={width - padding}
            y2={y}
            stroke="#e2e8f0"
            strokeDasharray="4"
          />
        );
      })}

      {/* MER line */}
      <path
        d={path}
        fill="none"
        stroke="#f59e0b"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Points */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#f59e0b" />
      ))}
    </svg>
  );
}

export default function HomeDashboardClient() {
  const [period, setPeriod] = useState<PeriodPreset>("last_7");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    async function fetchData() {
      try {
        const res = await fetch(`/api/dashboard/home?period=${period}`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to load dashboard data");
        }

        const json = await res.json();
        setData({
          kpis: {
            revenue_net: json.kpis?.revenue_net ?? 0,
            meta_spend: json.kpis?.meta_spend ?? 0,
            mer: json.kpis?.mer ?? 0,
            roas: json.kpis?.roas ?? 0,
            aov: json.kpis?.aov ?? 0,
            orders: json.kpis?.orders ?? 0,
          },
          timeseries: json.timeseries ?? [],
          currency: json.currency ?? "AUD",
          hasData: json.meta?.hasData ?? false,
        });
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Failed to load data");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchData();
    return () => controller.abort();
  }, [period]);

  const currency = data?.currency ?? "AUD";
  const kpis = data?.kpis ?? { revenue_net: 0, meta_spend: 0, mer: 0, roas: 0, aov: 0, orders: 0 };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-title-section">
          <h1>Performance Overview</h1>
          <p>Blended view across Shopify revenue and Meta advertising spend.</p>
        </div>

        <div className="date-filter">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.id}
              className={`date-btn ${period === option.id ? "date-btn-active" : ""}`}
              onClick={() => setPeriod(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
          <div className="spinner" />
        </div>
      )}

      {/* Dashboard Content */}
      {!loading && (
        <>
          {/* KPI Cards */}
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-value">{formatCurrency(kpis.revenue_net, currency)}</div>
              <div className="kpi-label">Revenue (Net)</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value">{formatCurrency(kpis.meta_spend, currency)}</div>
              <div className="kpi-label">Meta Spend</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value">{formatRatio(kpis.mer)}</div>
              <div className="kpi-label">MER</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value">{formatRatio(kpis.roas)}</div>
              <div className="kpi-label">ROAS</div>
            </div>
          </div>

          {/* Charts */}
          <div className="charts-grid">
            <div className="chart-card">
              <div className="card-header">
                <h3 className="card-title">Revenue vs Ad Spend</h3>
              </div>
              <div className="chart-container">
                <RevenueSpendChart data={data?.timeseries ?? []} currency={currency} />
              </div>
              <div className="chart-legend">
                <div className="legend-item">
                  <span className="legend-dot" style={{ backgroundColor: "#10b981" }} />
                  <span>Revenue (Net)</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot" style={{ backgroundColor: "#3b82f6" }} />
                  <span>Meta Spend</span>
                </div>
              </div>
            </div>

            <div className="chart-card">
              <div className="card-header">
                <h3 className="card-title">Marketing Efficiency (MER)</h3>
                <span className="card-subtitle">Revenue ÷ Ad Spend</span>
              </div>
              <div className="chart-container">
                <MERChart data={data?.timeseries ?? []} />
              </div>
              <div className="chart-legend">
                <div className="legend-item">
                  <span className="legend-dot" style={{ backgroundColor: "#f59e0b" }} />
                  <span>MER Ratio</span>
                </div>
              </div>
            </div>
          </div>

          {/* Secondary KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem", marginTop: "1.5rem" }}>
            <div className="kpi-card">
              <div className="kpi-value">{formatCurrency(kpis.aov, currency)}</div>
              <div className="kpi-label">Average Order Value</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value">{kpis.orders.toLocaleString()}</div>
              <div className="kpi-label">Total Orders</div>
            </div>
          </div>

          {/* Empty State / CTA */}
          {!data?.hasData && (
            <div className="card" style={{ marginTop: "1.5rem", textAlign: "center", padding: "2rem" }}>
              <h3 style={{ marginBottom: "0.5rem" }}>Get started with your dashboard</h3>
              <p style={{ color: "var(--text-muted)", marginBottom: "1rem" }}>
                Connect your Shopify store and Meta ad account to see blended performance metrics.
              </p>
              <a href="/settings" className="btn btn-primary">
                Connect Integrations
              </a>
            </div>
          )}

          {/* Quick Links */}
          <div className="card" style={{ marginTop: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <h3 style={{ margin: "0 0 0.25rem" }}>Need more detail?</h3>
                <p style={{ margin: 0, color: "var(--text-muted)" }}>
                  View individual platform dashboards for deeper insights.
                </p>
              </div>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <a href="/dashboard/shopify" className="btn btn-secondary">
                  Shopify Dashboard
                </a>
                <a href="/dashboard/meta" className="btn btn-secondary">
                  Meta Dashboard
                </a>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
