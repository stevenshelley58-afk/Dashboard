import { getDbPool } from "@/lib/db";
import type {
  MetaAdAccountSummary,
  MetaDashboardResponse,
  MetaDashboardSummary,
  MetaTimeseriesPoint,
} from "@/types/meta-dashboard";

const DEFAULT_WINDOW_DAYS = 7;
const MAX_WINDOW_DAYS = 60;

function startOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function parseDateParam(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : startOfDayUtc(new Date(parsed));
}

function clampRange(from: Date, to: Date): { from: Date; to: Date } {
  if (from > to) {
    throw new Error("`from` date must be before or equal to `to` date.");
  }

  const maxLookback = new Date(to);
  maxLookback.setUTCDate(maxLookback.getUTCDate() - (MAX_WINDOW_DAYS - 1));

  if (from < maxLookback) {
    return { from: maxLookback, to };
  }

  return { from, to };
}

export function parseMetaRange(
  fromParam: string | null,
  toParam: string | null
): MetaDashboardResponse["range"] {
  const today = startOfDayUtc(new Date());

  const resolvedTo = parseDateParam(toParam) ?? today;
  const resolvedFrom =
    parseDateParam(fromParam) ??
    (() => {
      const fallback = new Date(resolvedTo);
      fallback.setUTCDate(fallback.getUTCDate() - (DEFAULT_WINDOW_DAYS - 1));
      return fallback;
    })();

  const { from, to } = clampRange(resolvedFrom, resolvedTo);
  return { from: formatDate(from), to: formatDate(to) };
}

function toNumber(value: string | number | null | undefined, fallback = 0): number {
  if (value === null || value === undefined) {
    return fallback;
  }
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export async function resolveMetaAdAccount(
  accountId: string,
  requestedAdAccountId: string | null
): Promise<MetaAdAccountSummary> {
  const pool = getDbPool();

  if (requestedAdAccountId) {
    const specific = await pool.query<MetaAdAccountSummary>(
      `
        SELECT a.ad_account_id,
               a.display_name,
               a.platform_ad_account_id,
               a.currency,
               a.timezone
        FROM ad_accounts a
        INNER JOIN integrations i ON i.ad_account_id = a.ad_account_id
        WHERE a.ad_account_id = $2
          AND i.account_id = $1
          AND i.type = 'meta'
        ORDER BY i.updated_at DESC NULLS LAST
        LIMIT 1
      `,
      [accountId, requestedAdAccountId]
    );

    if (specific.rowCount === 0) {
      throw new Error("Meta ad account not found for this account.");
    }

    return specific.rows[0];
  }

  const fallback = await pool.query<MetaAdAccountSummary>(
    `
      SELECT a.ad_account_id,
             a.display_name,
             a.platform_ad_account_id,
             a.currency,
             a.timezone
      FROM integrations i
      INNER JOIN ad_accounts a ON a.ad_account_id = i.ad_account_id
      WHERE i.account_id = $1
        AND i.type = 'meta'
      ORDER BY 
        CASE WHEN i.status IN ('active', 'connected') THEN 0 ELSE 1 END,
        i.updated_at DESC NULLS LAST
      LIMIT 1
    `,
    [accountId]
  );

  if (fallback.rowCount === 0) {
    throw new Error("No Meta integration found for this account.");
  }

  return fallback.rows[0];
}

export async function fetchMetaDailyMetrics(params: {
  accountId: string;
  adAccountId: string;
  from: string;
  to: string;
}): Promise<MetaTimeseriesPoint[]> {
  const pool = getDbPool();
  const result = await pool.query(
    `
      SELECT date::date AS date,
             spend,
             purchases,
             purchase_value,
             roas
      FROM daily_meta_metrics
      WHERE account_id = $1
        AND ad_account_id = $2
        AND date BETWEEN $3::date AND $4::date
      ORDER BY date ASC
    `,
    [params.accountId, params.adAccountId, params.from, params.to]
  );

  return result.rows.map((row) => ({
    date: row.date,
    spend: toNumber(row.spend),
    purchases: toNumber(row.purchases),
    purchase_value: toNumber(row.purchase_value),
    roas: row.roas === null ? null : toNumber(row.roas),
  }));
}

export function buildMetaSummary(series: MetaTimeseriesPoint[]): MetaDashboardSummary {
  const totals = series.reduce(
    (acc, row) => {
      acc.spend += row.spend;
      acc.purchases += row.purchases;
      acc.purchase_value += row.purchase_value;
      return acc;
    },
    { spend: 0, purchases: 0, purchase_value: 0 }
  );

  const roas =
    totals.spend > 0
      ? totals.purchase_value / totals.spend
      : series.length > 0
        ? series[series.length - 1].roas ?? 0
        : 0;

  return { ...totals, roas };
}



