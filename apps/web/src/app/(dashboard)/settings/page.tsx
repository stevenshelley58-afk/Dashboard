import SettingsClient from "./SettingsClient";
import { requireAccountId } from "@/lib/auth";
import { getDbPool } from "@/lib/db";

// Settings page shows real-time sync status, so we use a short revalidate
// but still fetch initial data server-side for faster first paint
export const revalidate = 30;

interface IntegrationRow {
  integration_id: string;
  type: "shopify" | "meta";
  status: string;
  created_at: string;
  updated_at: string;
  shop_name: string | null;
  myshopify_domain: string | null;
  ad_account_name: string | null;
  platform_ad_account_id: string | null;
}

interface SyncRunRow {
  sync_run_id: string;
  integration_id: string;
  job_type: string;
  status: string;
  trigger: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  rows_processed: number | null;
  created_at: string;
}

interface CursorRow {
  integration_id: string;
  job_type: string;
  cursor_key: string;
  cursor_value: string;
  updated_at: string;
}

interface DataStatsRow {
  integration_id: string;
  orders_count: string;
  latest_order_date: string | null;
  webhooks_count: string;
  latest_webhook: string | null;
}

async function fetchSettingsData() {
  const accountId = await requireAccountId();
  const pool = getDbPool();

  const integrationsResult = await pool.query<IntegrationRow>(
    `
      SELECT 
        i.integration_id,
        i.type,
        i.status,
        i.created_at::text,
        i.updated_at::text,
        s.shop_name,
        s.myshopify_domain,
        aa.display_name as ad_account_name,
        aa.platform_ad_account_id
      FROM integrations i
      LEFT JOIN shops s ON s.shop_id = i.shop_id
      LEFT JOIN ad_accounts aa ON aa.ad_account_id = i.ad_account_id
      WHERE i.account_id = $1
      ORDER BY i.created_at DESC
    `,
    [accountId]
  );

  const integrations = integrationsResult.rows;
  const integrationIds = integrations.map((i) => i.integration_id);

  if (integrationIds.length === 0) {
    return {
      accountId,
      integrations: [],
    };
  }

  const [syncRunsResult, cursorsResult, dataStatsResult, webhookStatsResult] = await Promise.all([
    pool.query<SyncRunRow>(
      `
        SELECT 
          sync_run_id,
          integration_id,
          job_type,
          status,
          trigger,
          started_at::text,
          finished_at::text as completed_at,
          error_message,
          (stats->>'rows_processed')::int as rows_processed,
          created_at::text
        FROM sync_runs
        WHERE integration_id = ANY($1)
        ORDER BY created_at DESC
        LIMIT 50
      `,
      [integrationIds]
    ),
    pool.query<CursorRow>(
      `
        SELECT 
          integration_id,
          job_type,
          cursor_key,
          cursor_value,
          updated_at::text
        FROM sync_cursors
        WHERE integration_id = ANY($1)
        ORDER BY updated_at DESC
      `,
      [integrationIds]
    ),
    pool.query<DataStatsRow>(
      `
        SELECT 
          integration_id,
          COUNT(*)::text as orders_count,
          MAX(order_created_at)::text as latest_order_date,
          '0' as webhooks_count,
          NULL as latest_webhook
        FROM shopify_orders_raw
        WHERE integration_id = ANY($1)
        GROUP BY integration_id
      `,
      [integrationIds]
    ),
    pool.query<{ integration_id: string; webhooks_count: string; latest_webhook: string | null }>(
      `
        SELECT 
          integration_id,
          COUNT(*)::text as webhooks_count,
          MAX(received_at)::text as latest_webhook
        FROM shopify_webhooks_raw
        WHERE integration_id = ANY($1)
        GROUP BY integration_id
      `,
      [integrationIds]
    ),
  ]);

  const integrationDetails = integrations.map((integration) => {
    const recentSyncs = syncRunsResult.rows.filter((s) => s.integration_id === integration.integration_id);
    const cursors = cursorsResult.rows.filter((c) => c.integration_id === integration.integration_id);
    const dataStats = dataStatsResult.rows.find((d) => d.integration_id === integration.integration_id);
    const webhookStats = webhookStatsResult.rows.find((w) => w.integration_id === integration.integration_id);

    return {
      integration: {
        integration_id: integration.integration_id,
        type: integration.type,
        status: integration.status,
        created_at: integration.created_at,
        updated_at: integration.updated_at,
        shop_name: integration.shop_name,
        myshopify_domain: integration.myshopify_domain,
        ad_account_name: integration.ad_account_name,
        platform_ad_account_id: integration.platform_ad_account_id,
      },
      recentSyncs,
      cursors,
      dataStats: {
        orders_count: parseInt(dataStats?.orders_count ?? "0", 10),
        latest_order_date: dataStats?.latest_order_date ?? null,
        webhooks_count: parseInt(webhookStats?.webhooks_count ?? "0", 10),
        latest_webhook: webhookStats?.latest_webhook ?? null,
      },
    };
  });

  return {
    accountId,
    integrations: integrationDetails,
  };
}

export default async function SettingsPage() {
  const initialData = await fetchSettingsData();
  return <SettingsClient initialData={initialData} />;
}
