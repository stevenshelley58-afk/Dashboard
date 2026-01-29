import { getDbPool } from "@/lib/db";

/**
 * Reconciliation checks to verify data consistency
 * These functions help ensure that aggregated data matches source data
 */

export interface ReconciliationResult {
  passed: boolean;
  discrepancies: Array<{
    metric: string;
    expected: number;
    actual: number;
    difference: number;
    differencePct: number;
  }>;
}

/**
 * Verify that daily_summary aggregates match source fact tables
 */
export async function reconcileDailySummary(
  accountId: string,
  dateFrom: string,
  dateTo: string
): Promise<ReconciliationResult> {
  const pool = getDbPool();
  const discrepancies: ReconciliationResult["discrepancies"] = [];

  // Check revenue: daily_summary vs fact_shopify_orders
  const revenueCheck = await pool.query<{
    summary_revenue: number | null;
    fact_revenue: number | null;
  }>(
    `
      WITH summary AS (
        SELECT SUM(revenue_net) AS summary_revenue
        FROM daily_summary
        WHERE account_id = $1
          AND date BETWEEN $2::date AND $3::date
      ),
      fact AS (
        SELECT SUM(total_price - refund_amount) AS fact_revenue
        FROM fact_shopify_orders
        WHERE account_id = $1
          AND order_date BETWEEN $2::date AND $3::date
      )
      SELECT 
        s.summary_revenue,
        f.fact_revenue
      FROM summary s
      CROSS JOIN fact f
    `,
    [accountId, dateFrom, dateTo]
  );

  if ((revenueCheck.rowCount ?? 0) > 0) {
    const row = revenueCheck.rows[0];
    const summary = row.summary_revenue ?? 0;
    const fact = row.fact_revenue ?? 0;
    const diff = Math.abs(summary - fact);
    const diffPct = fact > 0 ? (diff / fact) * 100 : 0;

    // Allow 0.1% tolerance for rounding differences
    if (diffPct > 0.1) {
      discrepancies.push({
        metric: "revenue_net",
        expected: fact,
        actual: summary,
        difference: diff,
        differencePct: diffPct,
      });
    }
  }

  // Check Meta spend: daily_summary vs fact_meta_daily
  const spendCheck = await pool.query<{
    summary_spend: number | null;
    fact_spend: number | null;
  }>(
    `
      WITH summary AS (
        SELECT SUM(meta_spend) AS summary_spend
        FROM daily_summary
        WHERE account_id = $1
          AND date BETWEEN $2::date AND $3::date
      ),
      fact AS (
        SELECT SUM(spend) AS fact_spend
        FROM fact_meta_daily
        WHERE account_id = $1
          AND date BETWEEN $2::date AND $3::date
      )
      SELECT 
        s.summary_spend,
        f.fact_spend
      FROM summary s
      CROSS JOIN fact f
    `,
    [accountId, dateFrom, dateTo]
  );

  if ((spendCheck.rowCount ?? 0) > 0) {
    const row = spendCheck.rows[0];
    const summary = row.summary_spend ?? 0;
    const fact = row.fact_spend ?? 0;
    const diff = Math.abs(summary - fact);
    const diffPct = fact > 0 ? (diff / fact) * 100 : 0;

    if (diffPct > 0.1) {
      discrepancies.push({
        metric: "meta_spend",
        expected: fact,
        actual: summary,
        difference: diff,
        differencePct: diffPct,
      });
    }
  }

  return {
    passed: discrepancies.length === 0,
    discrepancies,
  };
}

