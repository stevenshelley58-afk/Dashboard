"use client";

import { useEffect, useState } from "react";

type PeriodPreset = "today" | "yesterday" | "last_7" | "this_week" | "last_30";

interface EnhancedTimeseries {
  date: string;
  orders: number;
  revenue_gross: number;
  revenue_net: number;
  refunds: number;
  aov: number | null;
  total_discounts: number;
  total_shipping: number;
  total_tax: number;
  new_customers: number;
  returning_customers: number;
  returning_customer_rate: number;
}

interface TopProduct {
  product_id: string;
  product_title: string;
  quantity_sold: number;
  revenue: number;
  orders_count: number;
}

interface SalesByChannel {
  sales_channel: string;
  orders: number;
  revenue_net: number;
  aov: number;
}

interface SalesByLocation {
  country: string;
  region: string | null;
  orders: number;
  revenue_net: number;
  new_customers: number;
}

interface HourlySales {
  hour: number;
  orders: number;
  revenue_net: number;
}

interface CustomerStats {
  total_customers: number;
  new_customers: number;
  returning_customers: number;
  returning_rate: number;
  avg_customer_value: number;
}

interface EnhancedSummary {
  orders: number;
  revenue_gross: number;
  revenue_net: number;
  refunds: number;
  aov: number;
  total_discounts: number;
  total_shipping: number;
  total_tax: number;
  new_customers: number;
  returning_customers: number;
  returning_customer_rate: number;
}

interface DashboardData {
  summary: EnhancedSummary;
  timeseries: EnhancedTimeseries[];
  topProducts: TopProduct[];
  salesByChannel: SalesByChannel[];
  salesByLocation: SalesByLocation[];
  hourlySales: HourlySales[];
  customerStats: CustomerStats;
  currency: string;
  hasData: boolean;
}

const PERIOD_OPTIONS: Array<{ id: PeriodPreset; label: string }> = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last_7", label: "Last 7 Days" },
  { id: "this_week", label: "This Week" },
  { id: "last_30", label: "Last 30 Days" },
];

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatHour(hour: number): string {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  return `${h}${ampm}`;
}

// Revenue Over Time Chart
function RevenueChart({ data, currency }: { data: EnhancedTimeseries[]; currency: string }) {
  if (data.length === 0) {
    return (
      <div className="chart-placeholder">
        No data available for this period
      </div>
    );
  }

  const width = 600;
  const height = 200;
  const padding = 40;

  const values = data.map((d) => d.revenue_net);
  const maxValue = Math.max(...values, 1);

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * (width - padding * 2);
    const y = height - padding - (d.revenue_net / maxValue) * (height - padding * 2);
    return { x, y, value: d.revenue_net, date: d.date };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "100%" }}>
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
      <path
        d={pathD}
        fill="none"
        stroke="#4F46E5"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={`${pathD} L ${points[points.length - 1]?.x || padding} ${height - padding} L ${padding} ${height - padding} Z`}
        fill="url(#revenueGradient)"
        opacity="0.1"
      />
      <defs>
        <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#4F46E5" stopOpacity="0" />
        </linearGradient>
      </defs>
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4" fill="#4F46E5" />
      ))}
    </svg>
  );
}

// Orders Over Time Chart
function OrdersChart({ data }: { data: EnhancedTimeseries[] }) {
  if (data.length === 0) {
    return <div className="chart-placeholder">No data available</div>;
  }

  const width = 400;
  const height = 200;
  const padding = 40;

  const values = data.map((d) => d.orders);
  const maxValue = Math.max(...values, 1);

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * (width - padding * 2);
    const y = height - padding - (d.orders / maxValue) * (height - padding * 2);
    return { x, y };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "100%" }}>
      {[0, 0.5, 1].map((ratio) => {
        const y = height - padding - ratio * (height - padding * 2);
        return (
          <line key={ratio} x1={padding} y1={y} x2={width - padding} y2={y} stroke="#e2e8f0" strokeDasharray="4" />
        );
      })}
      <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#3b82f6" />
      ))}
    </svg>
  );
}

// AOV Trend Chart
function AOVChart({ data, currency }: { data: EnhancedTimeseries[]; currency: string }) {
  if (data.length === 0) {
    return <div className="chart-placeholder">No data available</div>;
  }

  const width = 400;
  const height = 200;
  const padding = 40;

  const values = data.map((d) => d.aov ?? 0);
  const maxValue = Math.max(...values, 1);

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * (width - padding * 2);
    const y = height - padding - ((d.aov ?? 0) / maxValue) * (height - padding * 2);
    return { x, y };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "100%" }}>
      {[0, 0.5, 1].map((ratio) => {
        const y = height - padding - ratio * (height - padding * 2);
        return (
          <line key={ratio} x1={padding} y1={y} x2={width - padding} y2={y} stroke="#e2e8f0" strokeDasharray="4" />
        );
      })}
      <path d={pathD} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#10b981" />
      ))}
    </svg>
  );
}

// Hourly Sales Bar Chart
function HourlySalesChart({ data, currency }: { data: HourlySales[]; currency: string }) {
  if (data.length === 0) {
    return <div className="chart-placeholder">No hourly data available</div>;
  }

  const width = 600;
  const height = 200;
  const padding = 40;
  const barWidth = (width - padding * 2) / 24 - 2;

  // Fill in missing hours with 0
  const hourlyData: HourlySales[] = Array.from({ length: 24 }, (_, i) => {
    const found = data.find(d => d.hour === i);
    return found || { hour: i, orders: 0, revenue_net: 0 };
  });

  const maxValue = Math.max(...hourlyData.map(d => d.revenue_net), 1);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "100%" }}>
      {hourlyData.map((d, i) => {
        const barHeight = (d.revenue_net / maxValue) * (height - padding * 2);
        const x = padding + i * ((width - padding * 2) / 24) + 1;
        const y = height - padding - barHeight;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barWidth}
            height={barHeight}
            fill="#6366f1"
            rx="2"
          />
        );
      })}
      {/* X axis labels */}
      {[0, 6, 12, 18, 23].map((hour) => (
        <text
          key={hour}
          x={padding + hour * ((width - padding * 2) / 24) + barWidth / 2}
          y={height - 10}
          fontSize="10"
          textAnchor="middle"
          fill="#64748b"
        >
          {formatHour(hour)}
        </text>
      ))}
    </svg>
  );
}

// Customer Distribution Pie Chart
function CustomerPieChart({ newCustomers, returningCustomers }: { newCustomers: number; returningCustomers: number }) {
  const total = newCustomers + returningCustomers;
  if (total === 0) {
    return <div className="chart-placeholder">No customer data</div>;
  }

  const newPercent = newCustomers / total;
  const size = 120;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#4F46E5"
          strokeWidth={strokeWidth}
          strokeDasharray={`${newPercent * circumference} ${circumference}`}
          strokeDashoffset={circumference / 4}
          strokeLinecap="round"
        />
      </svg>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <span className="legend-dot" style={{ backgroundColor: "#4F46E5" }} />
          <span>New: {formatNumber(newCustomers)} ({formatPercent(newPercent)})</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span className="legend-dot" style={{ backgroundColor: "#e2e8f0" }} />
          <span>Returning: {formatNumber(returningCustomers)} ({formatPercent(1 - newPercent)})</span>
        </div>
      </div>
    </div>
  );
}

function periodToDateRange(period: PeriodPreset): { from: string; to: string } {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const to = new Date(today);
  let from = new Date(today);

  switch (period) {
    case "today":
      from = new Date(today);
      break;
    case "yesterday":
      from = new Date(today);
      from.setUTCDate(from.getUTCDate() - 1);
      to.setUTCDate(to.getUTCDate() - 1);
      break;
    case "last_7":
      from.setUTCDate(from.getUTCDate() - 6);
      break;
    case "this_week":
      const dayOfWeek = today.getUTCDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      from.setUTCDate(from.getUTCDate() - diff);
      break;
    case "last_30":
      from.setUTCDate(from.getUTCDate() - 29);
      break;
  }

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export default function ShopifyDashboardClient() {
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
        const { from, to } = periodToDateRange(period);
        const res = await fetch(`/api/dashboard/shopify?from=${from}&to=${to}`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to load Shopify data");
        }

        const json = await res.json();

        setData({
          summary: json.summary ?? {
            orders: 0, revenue_gross: 0, revenue_net: 0, refunds: 0, aov: 0,
            total_discounts: 0, total_shipping: 0, total_tax: 0,
            new_customers: 0, returning_customers: 0, returning_customer_rate: 0,
          },
          timeseries: json.timeseries ?? [],
          topProducts: json.topProducts ?? [],
          salesByChannel: json.salesByChannel ?? [],
          salesByLocation: json.salesByLocation ?? [],
          hourlySales: json.hourlySales ?? [],
          customerStats: json.customerStats ?? {
            total_customers: 0, new_customers: 0, returning_customers: 0,
            returning_rate: 0, avg_customer_value: 0,
          },
          currency: json.shop?.currency ?? "AUD",
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
  const summary = data?.summary ?? {
    orders: 0, revenue_gross: 0, revenue_net: 0, refunds: 0, aov: 0,
    total_discounts: 0, total_shipping: 0, total_tax: 0,
    new_customers: 0, returning_customers: 0, returning_customer_rate: 0,
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-title-section">
          <h1>Shopify Analytics</h1>
          <p>Complete analytics matching your Shopify dashboard.</p>
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
          {/* Primary KPI Cards */}
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-value">{formatCurrency(summary.revenue_net, currency)}</div>
              <div className="kpi-label">Net Sales</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value">{formatNumber(summary.orders)}</div>
              <div className="kpi-label">Total Orders</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value">{formatCurrency(summary.aov, currency)}</div>
              <div className="kpi-label">Average Order Value</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-value">{formatPercent(summary.returning_customer_rate)}</div>
              <div className="kpi-label">Returning Customer Rate</div>
            </div>
          </div>

          {/* Secondary KPIs - Sales Breakdown */}
          <div className="kpi-grid" style={{ marginTop: "1rem" }}>
            <div className="kpi-card kpi-card-secondary">
              <div className="kpi-value-small">{formatCurrency(summary.revenue_gross, currency)}</div>
              <div className="kpi-label">Gross Sales</div>
            </div>
            <div className="kpi-card kpi-card-secondary">
              <div className="kpi-value-small">{formatCurrency(summary.total_discounts, currency)}</div>
              <div className="kpi-label">Discounts</div>
            </div>
            <div className="kpi-card kpi-card-secondary">
              <div className="kpi-value-small">{formatCurrency(summary.refunds, currency)}</div>
              <div className="kpi-label">Returns</div>
            </div>
            <div className="kpi-card kpi-card-secondary">
              <div className="kpi-value-small">{formatCurrency(summary.total_shipping, currency)}</div>
              <div className="kpi-label">Shipping</div>
            </div>
            <div className="kpi-card kpi-card-secondary">
              <div className="kpi-value-small">{formatCurrency(summary.total_tax, currency)}</div>
              <div className="kpi-label">Tax</div>
            </div>
          </div>

          {/* Main Charts Row */}
          <div className="charts-grid" style={{ marginTop: "1.5rem" }}>
            <div className="chart-card" style={{ gridColumn: "span 2" }}>
              <div className="card-header">
                <h3 className="card-title">Total Sales Over Time</h3>
              </div>
              <div className="chart-container">
                <RevenueChart data={data?.timeseries ?? []} currency={currency} />
              </div>
            </div>
          </div>

          {/* Secondary Charts Row */}
          <div className="charts-grid">
            <div className="chart-card">
              <div className="card-header">
                <h3 className="card-title">Orders Over Time</h3>
              </div>
              <div className="chart-container">
                <OrdersChart data={data?.timeseries ?? []} />
              </div>
            </div>

            <div className="chart-card">
              <div className="card-header">
                <h3 className="card-title">Average Order Value Trend</h3>
              </div>
              <div className="chart-container">
                <AOVChart data={data?.timeseries ?? []} currency={currency} />
              </div>
            </div>
          </div>

          {/* Hourly Sales */}
          <div className="charts-grid">
            <div className="chart-card" style={{ gridColumn: "span 2" }}>
              <div className="card-header">
                <h3 className="card-title">Sales by Hour of Day</h3>
                <span className="card-subtitle">When your customers are buying</span>
              </div>
              <div className="chart-container">
                <HourlySalesChart data={data?.hourlySales ?? []} currency={currency} />
              </div>
            </div>
          </div>

          {/* Customer Analytics */}
          <div className="charts-grid">
            <div className="chart-card">
              <div className="card-header">
                <h3 className="card-title">Customer Breakdown</h3>
                <span className="card-subtitle">New vs Returning customers</span>
              </div>
              <div className="chart-container" style={{ padding: "1rem" }}>
                <CustomerPieChart
                  newCustomers={summary.new_customers}
                  returningCustomers={summary.returning_customers}
                />
              </div>
            </div>

            <div className="chart-card">
              <div className="card-header">
                <h3 className="card-title">Customer Stats</h3>
              </div>
              <div style={{ padding: "1rem" }}>
                <div className="stat-row">
                  <span>Total Customers</span>
                  <strong>{formatNumber(data?.customerStats.total_customers ?? 0)}</strong>
                </div>
                <div className="stat-row">
                  <span>New Customers</span>
                  <strong>{formatNumber(data?.customerStats.new_customers ?? 0)}</strong>
                </div>
                <div className="stat-row">
                  <span>Returning Customers</span>
                  <strong>{formatNumber(data?.customerStats.returning_customers ?? 0)}</strong>
                </div>
                <div className="stat-row">
                  <span>Avg. Customer Value</span>
                  <strong>{formatCurrency(data?.customerStats.avg_customer_value ?? 0, currency)}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Tables Row */}
          <div className="tables-grid">
            {/* Top Products */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Top Products by Revenue</h3>
                <span className="card-subtitle">Best selling products</span>
              </div>
              {data?.topProducts && data.topProducts.length > 0 ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th style={{ textAlign: "right" }}>Qty</th>
                      <th style={{ textAlign: "right" }}>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topProducts.map((product, i) => (
                      <tr key={i}>
                        <td>{product.product_title}</td>
                        <td style={{ textAlign: "right" }}>{formatNumber(product.quantity_sold)}</td>
                        <td style={{ textAlign: "right" }}>{formatCurrency(product.revenue, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state">
                  <p className="empty-state-title">No products yet</p>
                  <p className="empty-state-text">Sales will appear here once orders are synced.</p>
                </div>
              )}
            </div>

            {/* Sales by Channel */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Sales by Channel</h3>
                <span className="card-subtitle">Revenue breakdown by source</span>
              </div>
              {data?.salesByChannel && data.salesByChannel.length > 0 ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Channel</th>
                      <th style={{ textAlign: "right" }}>Orders</th>
                      <th style={{ textAlign: "right" }}>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.salesByChannel.map((channel, i) => (
                      <tr key={i}>
                        <td>{channel.sales_channel}</td>
                        <td style={{ textAlign: "right" }}>{formatNumber(channel.orders)}</td>
                        <td style={{ textAlign: "right" }}>{formatCurrency(channel.revenue_net, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state">
                  <p className="empty-state-title">No channel data</p>
                  <p className="empty-state-text">Channel attribution will appear after syncing orders.</p>
                </div>
              )}
            </div>
          </div>

          {/* Location Table */}
          <div className="tables-grid">
            <div className="card" style={{ gridColumn: "span 2" }}>
              <div className="card-header">
                <h3 className="card-title">Sales by Location</h3>
                <span className="card-subtitle">Top regions by revenue</span>
              </div>
              {data?.salesByLocation && data.salesByLocation.length > 0 ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Country</th>
                      <th>Region</th>
                      <th style={{ textAlign: "right" }}>Orders</th>
                      <th style={{ textAlign: "right" }}>New Customers</th>
                      <th style={{ textAlign: "right" }}>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.salesByLocation.map((location, i) => (
                      <tr key={i}>
                        <td>{location.country}</td>
                        <td>{location.region || '-'}</td>
                        <td style={{ textAlign: "right" }}>{formatNumber(location.orders)}</td>
                        <td style={{ textAlign: "right" }}>{formatNumber(location.new_customers)}</td>
                        <td style={{ textAlign: "right" }}>{formatCurrency(location.revenue_net, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state">
                  <p className="empty-state-title">No location data</p>
                  <p className="empty-state-text">Location data will appear after syncing orders.</p>
                </div>
              )}
            </div>
          </div>

          {/* Sessions Notice - ShopifyQL Required */}
          <div className="card" style={{ marginTop: "1.5rem", textAlign: "center", padding: "2rem", background: "var(--bg-muted)" }}>
            <h3 style={{ marginBottom: "0.5rem" }}>Sessions & Conversion Rate</h3>
            <p style={{ color: "var(--text-muted)", marginBottom: "1rem" }}>
              Session data and conversion rates require ShopifyQL integration.
              <br />
              This data is fetched separately from the Analytics API.
            </p>
            <span className="badge badge-info">Coming Soon</span>
          </div>

          {/* Empty State */}
          {!data?.hasData && (
            <div className="card" style={{ marginTop: "1.5rem", textAlign: "center", padding: "2rem" }}>
              <h3 style={{ marginBottom: "0.5rem" }}>No Shopify data yet</h3>
              <p style={{ color: "var(--text-muted)", marginBottom: "1rem" }}>
                Connect your Shopify store from Settings to start seeing your performance data.
              </p>
              <a href="/settings" className="btn btn-primary">
                Go to Settings
              </a>
            </div>
          )}
        </>
      )}

      <style jsx>{`
        .kpi-card-secondary {
          background: var(--bg-secondary);
        }
        .kpi-value-small {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--text-primary);
        }
        .stat-row {
          display: flex;
          justify-content: space-between;
          padding: 0.75rem 0;
          border-bottom: 1px solid var(--border-color);
        }
        .stat-row:last-child {
          border-bottom: none;
        }
        .badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 500;
        }
        .badge-info {
          background: #dbeafe;
          color: #1e40af;
        }
      `}</style>
    </div>
  );
}
