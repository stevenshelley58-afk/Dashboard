import type { Pool, PoolClient } from "pg";

import type { JobType } from "../job-types.js";
import type { SyncRunRecord } from "../types/sync-run.js";
import { rebuildDailySummary } from "./daily-summary.js";
import { sleep } from "../utils/time.js";

const META_API_VERSION = process.env.META_API_VERSION ?? "v19.0";
const META_API_BASE_URL = process.env.META_API_BASE_URL ?? "https://graph.facebook.com";
const META_STUB_MODE = process.env.META_STUB_MODE === "1";
const META_ACCESS_TOKEN_KEY = "meta_access_token";
const META_CURSOR_KEY = "meta_last_window_end";
const META_CURSOR_JOB_TYPE: JobType = "meta_fresh";
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const META_FETCH_FIELDS = [
  "ad_id",
  "adset_id",
  "campaign_id",
  "date_start",
  "date_stop",
  "spend",
  "impressions",
  "clicks",
  "actions",
  "action_values",
  "ad_effective_status",
];
const META_FILTER_PAYLOAD = JSON.stringify([
  { field: "ad.effective_status", operator: "IN", value: ["ACTIVE", "PAUSED"] },
]);
const MAX_BACKOFF_ATTEMPTS = 5;
const INITIAL_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 60_000;

interface JobResult {
  stats?: Record<string, unknown>;
}

interface MetaIntegrationDetails {
  integrationId: string;
  accountId: string;
  adAccountId: string;
  platformAdAccountId: string;
  accessToken: string;
  attributionWindowDays: number;
  timezone: string | null;
  displayName: string | null;
}

interface MetaInsightsAction {
  action_type?: string;
  value?: string | number | null;
}

interface MetaInsightsApiRow {
  ad_id?: string;
  adset_id?: string;
  campaign_id?: string;
  date_start?: string;
  date_stop?: string;
  spend?: string | number | null;
  impressions?: string | number | null;
  clicks?: string | number | null;
  actions?: MetaInsightsAction[] | null;
  action_values?: MetaInsightsAction[] | null;
  ad_effective_status?: string | null;
}

interface MetaInsightsApiResponse {
  data?: MetaInsightsApiRow[];
  paging?: { next?: string };
  error?: { message?: string };
}

interface NormalizedMetaInsight {
  date: string;
  adId: string;
  adsetId: string | null;
  campaignId: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  purchaseValue: number;
  effectiveStatus: string | null;
  raw: MetaInsightsApiRow;
}

interface FetchDayResult {
  rows: NormalizedMetaInsight[];
  apiCalls: number;
  stubbed: boolean;
  rateLimitEvents: number;
}

interface FetchWindowResult {
  rows: NormalizedMetaInsight[];
  dates: string[];
  apiCalls: number;
  stubbedDays: number;
  rateLimitEvents: number;
  windowStart: string | null;
  windowEnd: string | null;
}

interface RateLimitContext {
  pool: Pool;
  runId: string;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function utcToday(): Date {
  return startOfUtcDay(new Date());
}

function utcYesterday(): Date {
  const today = utcToday();
  today.setUTCDate(today.getUTCDate() - 1);
  return today;
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function enumerateDateStrings(from: Date, to: Date): string[] {
  const dates: string[] = [];
  const cursor = startOfUtcDay(from);
  const end = startOfUtcDay(to);
  while (cursor.getTime() <= end.getTime()) {
    dates.push(formatDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function parseNumber(value: string | number | null | undefined, fallback = 0): number {
  if (value === null || value === undefined) {
    return fallback;
  }
  const numeric = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

const PURCHASE_ACTION_TYPES = new Set([
  "offsite_conversion.fb_pixel_purchase",
  "onsite_conversion.purchase",
  "purchase",
  "subscribe_and_save_purchase",
]);

function extractPurchaseStats(row: MetaInsightsApiRow): { count: number; value: number } {
  let count = 0;
  let value = 0;

  if (Array.isArray(row.actions)) {
    for (const action of row.actions) {
      if (action?.action_type && PURCHASE_ACTION_TYPES.has(action.action_type)) {
        count += parseNumber(action.value, 0);
      }
    }
  }

  if (Array.isArray(row.action_values)) {
    for (const action of row.action_values) {
      if (action?.action_type && PURCHASE_ACTION_TYPES.has(action.action_type)) {
        value += parseNumber(action.value, 0);
      }
    }
  }

  return { count, value };
}

function normalizePlatformAdAccountId(value: string): string {
  if (value.startsWith("act_")) {
    return value;
  }
  return value ? `act_${value.replace(/^act_/, "")}` : value;
}

function normalizeMetaInsight(row: MetaInsightsApiRow, fallbackDate: string): NormalizedMetaInsight | null {
  if (!row.ad_id) {
    return null;
  }

  const date = row.date_start ?? row.date_stop ?? fallbackDate;
  const purchases = extractPurchaseStats(row);

  return {
    date,
    adId: row.ad_id,
    adsetId: row.adset_id ?? null,
    campaignId: row.campaign_id ?? null,
    spend: parseNumber(row.spend),
    impressions: parseNumber(row.impressions),
    clicks: parseNumber(row.clicks),
    purchases: Math.round(purchases.count),
    purchaseValue: purchases.value,
    effectiveStatus: row.ad_effective_status ?? null,
    raw: row,
  };
}

function buildStubInsights(date: string, integration: MetaIntegrationDetails): NormalizedMetaInsight[] {
  const seed = hashString(`${integration.integrationId}:${date}`);
  const rowCount = (seed % 2) + 1;
  const rows: NormalizedMetaInsight[] = [];

  for (let index = 0; index < rowCount; index += 1) {
    const rowSeed = hashString(`${seed}:${index}`);
    const spend = ((rowSeed % 5000) / 100) + 12;
    const purchases = Math.max(0, (rowSeed % 4) - 1);
    rows.push({
      date,
      adId: `stub_ad_${index}_${date}`,
      adsetId: `stub_adset_${index}`,
      campaignId: `stub_campaign_${index}`,
      spend,
      impressions: 800 + (rowSeed % 600),
      clicks: 40 + (rowSeed % 35),
      purchases,
      purchaseValue: purchases * (spend * 1.8),
      effectiveStatus: index % 2 === 0 ? "ACTIVE" : "PAUSED",
      raw: {
        ad_id: `stub_ad_${index}_${date}`,
        adset_id: `stub_adset_${index}`,
        campaign_id: `stub_campaign_${index}`,
        date_start: date,
        date_stop: date,
        spend,
        impressions: 800 + (rowSeed % 600),
        clicks: 40 + (rowSeed % 35),
        actions: [
          {
            action_type: "offsite_conversion.fb_pixel_purchase",
            value: purchases,
          },
        ],
        action_values: [
          {
            action_type: "offsite_conversion.fb_pixel_purchase",
            value: purchases * (spend * 1.8),
          },
        ],
        ad_effective_status: index % 2 === 0 ? "ACTIVE" : "PAUSED",
      },
    });
  }

  return rows;
}

async function updateRateLimitState(
  context: RateLimitContext,
  params: { active: boolean; resetAt?: Date | null }
): Promise<void> {
  await context.pool.query(
    `
      UPDATE sync_runs
      SET rate_limited = $2,
          rate_limit_reset_at = $3
      WHERE sync_run_id = $1
    `,
    [context.runId, params.active ? true : false, params.active ? params.resetAt ?? null : null]
  );
}

async function fetchWithBackoff(
  url: string,
  context: RateLimitContext
): Promise<{ response: Response; rateLimitEvents: number }> {
  let attempt = 0;
  let waitMs = INITIAL_BACKOFF_MS;
  let rateLimitEvents = 0;

  for (;;) {
    const response = await fetch(url);

    if (response.status !== 429 && response.status !== 613) {
      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `Meta API request failed (${response.status}): ${body.slice(0, 500)}`
        );
      }

      if (rateLimitEvents > 0) {
        await updateRateLimitState(context, { active: false });
      }

      return { response, rateLimitEvents };
    }

    rateLimitEvents += 1;
    attempt += 1;

    const cappedDelay = Math.min(waitMs, MAX_BACKOFF_MS);
    await updateRateLimitState(context, {
      active: true,
      resetAt: new Date(Date.now() + cappedDelay),
    });
    await sleep(cappedDelay);

    if (attempt >= MAX_BACKOFF_ATTEMPTS) {
      throw new Error("Meta API rate limit persisted after multiple attempts.");
    }

    waitMs *= 2;
  }
}

function buildInsightsUrl(
  integration: MetaIntegrationDetails,
  date: string,
  pagingUrl?: string
): string {
  if (pagingUrl) {
    return pagingUrl;
  }

  if (!integration.accessToken && !META_STUB_MODE) {
    throw new Error("Meta access token is required when META_STUB_MODE is disabled.");
  }

  const base = new URL(
    `${META_API_BASE_URL}/${META_API_VERSION}/${integration.platformAdAccountId}/insights`
  );

  base.searchParams.set("level", "ad");
  base.searchParams.set("time_increment", "1");
  base.searchParams.set("limit", "500");
  base.searchParams.set("fields", META_FETCH_FIELDS.join(","));
  base.searchParams.set("filtering", META_FILTER_PAYLOAD);
  base.searchParams.set("time_range[since]", date);
  base.searchParams.set("time_range[until]", date);
  base.searchParams.set("access_token", integration.accessToken);

  return base.toString();
}

async function fetchInsightsForDate(
  integration: MetaIntegrationDetails,
  date: string,
  context: RateLimitContext
): Promise<FetchDayResult> {
  if (META_STUB_MODE) {
    return {
      rows: buildStubInsights(date, integration),
      apiCalls: 0,
      stubbed: true,
      rateLimitEvents: 0,
    };
  }

  const rows: NormalizedMetaInsight[] = [];
  let apiCalls = 0;
  let nextUrl: string | undefined;
  let rateLimitEvents = 0;

  while (true) {
    const targetUrl = buildInsightsUrl(integration, date, nextUrl);
    const { response, rateLimitEvents: attemptEvents } = await fetchWithBackoff(
      targetUrl,
      context
    );
    rateLimitEvents += attemptEvents;
    apiCalls += 1;

    const body = (await response.json()) as MetaInsightsApiResponse;
    if (!body.data || body.data.length === 0) {
      break;
    }

    for (const row of body.data) {
      const normalized = normalizeMetaInsight(row, date);
      if (normalized) {
        rows.push(normalized);
      }
    }

    if (!body.paging?.next) {
      break;
    }
    nextUrl = body.paging.next;
  }

  return { rows, apiCalls, stubbed: false, rateLimitEvents };
}

async function fetchInsightsWindow(
  integration: MetaIntegrationDetails,
  dates: string[],
  context: RateLimitContext
): Promise<FetchWindowResult> {
  const aggregated: NormalizedMetaInsight[] = [];
  let apiCalls = 0;
  let stubbedDays = 0;
  let rateLimitEvents = 0;

  for (const date of dates) {
    const dayResult = await fetchInsightsForDate(integration, date, context);
    aggregated.push(...dayResult.rows);
    apiCalls += dayResult.apiCalls;
    rateLimitEvents += dayResult.rateLimitEvents;
    if (dayResult.stubbed) {
      stubbedDays += 1;
    }
  }

  return {
    rows: aggregated,
    dates,
    apiCalls,
    stubbedDays,
    rateLimitEvents,
    windowStart: dates[0] ?? null,
    windowEnd: dates[dates.length - 1] ?? null,
  };
}

async function withTransaction<T>(
  pool: Pool,
  cb: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await cb(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function loadMetaIntegration(pool: Pool, integrationId: string): Promise<MetaIntegrationDetails> {
  const integrationResult = await pool.query<{
    integration_id: string;
    account_id: string;
    ad_account_id: string | null;
    platform_ad_account_id: string | null;
    attribution_window_days: number | null;
    timezone: string | null;
    display_name: string | null;
  }>(
    `
      SELECT 
        i.integration_id,
        i.account_id,
        i.ad_account_id,
        a.platform_ad_account_id,
        a.attribution_window_days,
        a.timezone,
        a.display_name
      FROM integrations i
      INNER JOIN ad_accounts a ON a.ad_account_id = i.ad_account_id
      WHERE i.integration_id = $1
        AND i.type = 'meta'
      LIMIT 1
    `,
    [integrationId]
  );

  if (integrationResult.rowCount === 0) {
    throw new Error(`Meta integration ${integrationId} not found.`);
  }

  const row = integrationResult.rows[0];
  if (!row.ad_account_id || !row.platform_ad_account_id) {
    throw new Error(`Meta integration ${integrationId} is missing an ad account.`);
  }

  const tokenResult = await pool.query<{ value_encrypted: string }>(
    `
      SELECT value_encrypted
      FROM integration_secrets
      WHERE integration_id = $1
        AND key = $2
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 1
    `,
    [integrationId, META_ACCESS_TOKEN_KEY]
  );

  if (tokenResult.rowCount === 0 && !META_STUB_MODE) {
    throw new Error(`Integration ${integrationId} is missing a Meta access token.`);
  }

  return {
    integrationId,
    accountId: row.account_id,
    adAccountId: row.ad_account_id,
    platformAdAccountId: normalizePlatformAdAccountId(row.platform_ad_account_id),
    accessToken: tokenResult.rows[0]?.value_encrypted ?? "",
    attributionWindowDays: Math.max(1, row.attribution_window_days ?? 7),
    timezone: row.timezone,
    displayName: row.display_name,
  };
}

function buildValuesPlaceholders(rowCount: number, columns: number): string {
  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const offset = rowIndex * columns;
    const placeholders = Array.from(
      { length: columns },
      (_, columnIndex) => `$${offset + columnIndex + 1}`
    );
    return `(${placeholders.join(", ")})`;
  }).join(", ");
}

async function upsertMetaInsightsRaw(
  client: PoolClient,
  integration: MetaIntegrationDetails,
  rows: NormalizedMetaInsight[]
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const columns = 7;
  const values: unknown[] = [];
  const placeholders = buildValuesPlaceholders(rows.length, columns);

  rows.forEach((row) => {
    values.push(
      integration.integrationId,
      integration.platformAdAccountId,
      row.adId,
      row.date,
      row.effectiveStatus,
      JSON.stringify(row.raw),
      "ad"
    );
  });

  await client.query(
    `
      INSERT INTO meta_insights_raw (
        integration_id,
        platform_ad_account_id,
        ad_id,
        date,
        ad_effective_status,
        raw_payload,
        level
      )
      VALUES ${placeholders}
      ON CONFLICT (integration_id, ad_id, date, level)
      DO UPDATE SET
        ad_effective_status = EXCLUDED.ad_effective_status,
        raw_payload = EXCLUDED.raw_payload,
        last_synced_at = NOW()
    `,
    values
  );
}

async function replaceFactMetaDaily(
  client: PoolClient,
  integration: MetaIntegrationDetails,
  rows: NormalizedMetaInsight[]
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const dates = Array.from(new Set(rows.map((row) => row.date))).sort();

  await client.query(
    `
      DELETE FROM fact_meta_daily
      WHERE integration_id = $1
        AND ad_account_id = $2
        AND date = ANY($3::date[])
    `,
    [integration.integrationId, integration.adAccountId, dates]
  );

  const columns = 12;
  const values: unknown[] = [];
  const placeholders = buildValuesPlaceholders(rows.length, columns);

  rows.forEach((row) => {
    values.push(
      integration.integrationId,
      integration.adAccountId,
      integration.accountId,
      row.date,
      row.campaignId,
      row.adsetId,
      row.adId,
      row.spend,
      row.impressions,
      row.clicks,
      row.purchases,
      row.purchaseValue
    );
  });

  await client.query(
    `
      INSERT INTO fact_meta_daily (
        integration_id,
        ad_account_id,
        account_id,
        date,
        campaign_id,
        adset_id,
        ad_id,
        spend,
        impressions,
        clicks,
        purchases,
        purchase_value
      )
      VALUES ${placeholders}
    `,
    values
  );
}

async function rebuildDailyMetaMetrics(
  client: PoolClient,
  integration: MetaIntegrationDetails,
  dates: string[]
): Promise<void> {
  if (dates.length === 0) {
    return;
  }

  await client.query(
    `
      DELETE FROM daily_meta_metrics
      WHERE ad_account_id = $1
        AND date = ANY($2::date[])
    `,
    [integration.adAccountId, dates]
  );

  await client.query(
    `
      INSERT INTO daily_meta_metrics (
        ad_account_id,
        account_id,
        date,
        spend,
        purchases,
        purchase_value,
        roas
      )
      SELECT
        $1::uuid AS ad_account_id,
        $2::uuid AS account_id,
        date,
        SUM(spend) AS spend,
        SUM(purchases) AS purchases,
        SUM(purchase_value) AS purchase_value,
        CASE
          WHEN SUM(spend) > 0 THEN SUM(purchase_value) / SUM(spend)
          ELSE NULL
        END AS roas
      FROM fact_meta_daily
      WHERE ad_account_id = $1
        AND account_id = $2
        AND date = ANY($3::date[])
      GROUP BY date
    `,
    [integration.adAccountId, integration.accountId, dates]
  );
}

function uniqueDates(rows: NormalizedMetaInsight[]): string[] {
  const dates = new Set<string>();
  rows.forEach((row) => dates.add(row.date));
  return Array.from(dates.values()).sort();
}

async function persistInsightsAndAggregates(
  pool: Pool,
  integration: MetaIntegrationDetails,
  rows: NormalizedMetaInsight[],
  options?: {
    cursorUpdate?: (client: PoolClient) => Promise<boolean | void>;
  }
): Promise<{ persisted: number; dates: string[]; cursorChanged: boolean }> {
  if (rows.length === 0 && !options?.cursorUpdate) {
    return { persisted: 0, dates: [], cursorChanged: false };
  }

  const dates = uniqueDates(rows);
  let cursorChanged = false;

  await withTransaction(pool, async (client) => {
    if (rows.length > 0) {
      await upsertMetaInsightsRaw(client, integration, rows);
      await replaceFactMetaDaily(client, integration, rows);
      await rebuildDailyMetaMetrics(client, integration, dates);
      await rebuildDailySummary(client, integration.accountId, dates);
    }

    if (options?.cursorUpdate) {
      const result = await options.cursorUpdate(client);
      cursorChanged = Boolean(result);
    }
  });

  return { persisted: rows.length, dates, cursorChanged };
}

async function setCursorIfMissing(
  client: PoolClient,
  integrationId: string,
  cursorValue: string
): Promise<boolean> {
  const result = await client.query(
    `
      INSERT INTO sync_cursors (integration_id, job_type, cursor_key, cursor_value, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (integration_id, job_type, cursor_key)
      DO NOTHING
      RETURNING cursor_value
    `,
    [integrationId, META_CURSOR_JOB_TYPE, META_CURSOR_KEY, cursorValue]
  );
  return (result.rowCount ?? 0) > 0;
}

async function setCursorValue(
  client: PoolClient,
  integrationId: string,
  cursorValue: string
): Promise<boolean> {
  const result = await client.query(
    `
      INSERT INTO sync_cursors (integration_id, job_type, cursor_key, cursor_value, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (integration_id, job_type, cursor_key)
      DO UPDATE SET
        cursor_value = EXCLUDED.cursor_value,
        updated_at = NOW()
      WHERE sync_cursors.cursor_value IS DISTINCT FROM EXCLUDED.cursor_value
      RETURNING cursor_value
    `,
    [integrationId, META_CURSOR_JOB_TYPE, META_CURSOR_KEY, cursorValue]
  );
  return (result.rowCount ?? 0) > 0;
}

async function getCursorValue(pool: Pool, integrationId: string): Promise<string | null> {
  const result = await pool.query<{ cursor_value: string }>(
    `
      SELECT cursor_value
      FROM sync_cursors
      WHERE integration_id = $1
        AND job_type = $2
        AND cursor_key = $3
      LIMIT 1
    `,
    [integrationId, META_CURSOR_JOB_TYPE, META_CURSOR_KEY]
  );
  return result.rows[0]?.cursor_value ?? null;
}

function resolveFillWindow(): { dates: string[]; startIso: string | null; endIso: string | null } {
  const windowEnd = utcYesterday();
  const windowStart = addUtcDays(windowEnd, -6);
  const dates = enumerateDateStrings(windowStart, windowEnd);
  return {
    dates,
    startIso: dates[0] ?? null,
    endIso: dates[dates.length - 1] ?? null,
  };
}

function resolveFreshWindow(attributionWindowDays: number): {
  dates: string[];
  startIso: string | null;
  endIso: string | null;
} {
  const windowEnd = utcYesterday();
  const windowStart = addUtcDays(windowEnd, -(attributionWindowDays - 1));
  const dates = enumerateDateStrings(windowStart, windowEnd);
  return {
    dates,
    startIso: dates[0] ?? null,
    endIso: dates[dates.length - 1] ?? null,
  };
}

export async function runMetaSevenDayFillJob(
  run: SyncRunRecord,
  pool: Pool
): Promise<JobResult> {
  const integration = await loadMetaIntegration(pool, run.integration_id);
  const window = resolveFillWindow();

  if (window.dates.length === 0) {
    return {
      stats: {
        jobType: "meta_7d_fill",
        integrationId: integration.integrationId,
        adAccountId: integration.adAccountId,
        datesRequested: [],
        fetchedRows: 0,
        persistedRows: 0,
        metaApiCalls: 0,
      },
    };
  }

  const fetchResult = await fetchInsightsWindow(integration, window.dates, {
    pool,
    runId: run.sync_run_id,
  });

  const persistResult = await persistInsightsAndAggregates(pool, integration, fetchResult.rows, {
    cursorUpdate:
      window.endIso === null
        ? undefined
        : (client) => setCursorIfMissing(client, integration.integrationId, window.endIso!),
  });

  return {
    stats: {
      jobType: "meta_7d_fill",
      integrationId: integration.integrationId,
      adAccountId: integration.adAccountId,
      datesRequested: window.dates,
      fetchedRows: fetchResult.rows.length,
      persistedRows: persistResult.persisted,
      metaApiCalls: fetchResult.apiCalls,
      stubbedDays: fetchResult.stubbedDays,
      rateLimitEvents: fetchResult.rateLimitEvents,
      windowStart: window.startIso,
      windowEnd: window.endIso,
      cursorInitialized: persistResult.cursorChanged,
      stubModeEnabled: META_STUB_MODE,
    },
  };
}

export async function runMetaFreshJob(run: SyncRunRecord, pool: Pool): Promise<JobResult> {
  const integration = await loadMetaIntegration(pool, run.integration_id);
  const window = resolveFreshWindow(integration.attributionWindowDays);

  if (window.dates.length === 0) {
    return {
      stats: {
        jobType: "meta_fresh",
        integrationId: integration.integrationId,
        adAccountId: integration.adAccountId,
        datesRequested: [],
        fetchedRows: 0,
        persistedRows: 0,
        metaApiCalls: 0,
      },
    };
  }

  const previousCursor = await getCursorValue(pool, integration.integrationId);
  const fetchResult = await fetchInsightsWindow(integration, window.dates, {
    pool,
    runId: run.sync_run_id,
  });

  const targetCursor = window.endIso ?? previousCursor ?? null;

  const persistResult = await persistInsightsAndAggregates(pool, integration, fetchResult.rows, {
    cursorUpdate:
      targetCursor === null
        ? undefined
        : (client) => setCursorValue(client, integration.integrationId, targetCursor),
  });

  return {
    stats: {
      jobType: "meta_fresh",
      integrationId: integration.integrationId,
      adAccountId: integration.adAccountId,
      datesRequested: window.dates,
      fetchedRows: fetchResult.rows.length,
      persistedRows: persistResult.persisted,
      metaApiCalls: fetchResult.apiCalls,
      stubbedDays: fetchResult.stubbedDays,
      rateLimitEvents: fetchResult.rateLimitEvents,
      windowStart: window.startIso,
      windowEnd: window.endIso,
      cursorPrevious: previousCursor,
      cursorNext: targetCursor,
      cursorAdvanced: persistResult.cursorChanged,
      stubModeEnabled: META_STUB_MODE,
    },
  };
}


