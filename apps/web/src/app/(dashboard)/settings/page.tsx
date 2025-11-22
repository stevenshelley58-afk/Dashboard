import { requireAccountContext } from "@/lib/auth";
import { getDbPool } from "@/lib/db";
import SyncStatusClient from "./SyncStatusClient";

interface ShopifyIntegrationRow {
  integration_id: string;
  status: string;
  shop_name: string | null;
  myshopify_domain: string | null;
}

interface ShopifyWebhookRow {
  webhook_id: string;
  topic: string;
  received_at: string;
  payload_json: unknown;
}

const SHOW_WEBHOOK_DEBUG =
  process.env.SHOW_SHOPIFY_WEBHOOK_DEBUG === "true" ||
  process.env.NODE_ENV !== "production";

async function getShopifyIntegration(
  accountId: string
): Promise<ShopifyIntegrationRow | null> {
  const pool = getDbPool();
  const result = await pool.query<ShopifyIntegrationRow>(
    `
      SELECT i.integration_id, i.status, s.shop_name, s.myshopify_domain
      FROM integrations i
      LEFT JOIN shops s ON s.shop_id = i.shop_id
      WHERE i.account_id = $1
        AND i.type = 'shopify'
      ORDER BY i.updated_at DESC NULLS LAST
      LIMIT 1
    `,
    [accountId]
  );

  return result.rows[0] ?? null;
}

async function getRecentWebhooks(
  integrationId: string
): Promise<ShopifyWebhookRow[]> {
  const pool = getDbPool();
  const result = await pool.query<ShopifyWebhookRow>(
    `
      SELECT webhook_id, topic, received_at, payload_json
      FROM shopify_webhooks_raw
      WHERE integration_id = $1
      ORDER BY received_at DESC
      LIMIT 10
    `,
    [integrationId]
  );

  return result.rows;
}

function formatDate(timestamp: string): string {
  return new Date(timestamp).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

function renderWebhookSnippet(payload: unknown): string {
  try {
    const serialized = JSON.stringify(payload);
    if (!serialized) {
      return "";
    }
    const snippet = serialized.slice(0, 120);
    return `${snippet}${serialized.length > 120 ? "…" : ""}`;
  } catch {
    return "[unserializable]";
  }
}

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { accountId } = await requireAccountContext();
  const integration = await getShopifyIntegration(accountId);
  const isConnected = integration?.status === "connected";
  const recentWebhooks =
    integration && SHOW_WEBHOOK_DEBUG
      ? await getRecentWebhooks(integration.integration_id)
      : [];

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "2rem",
        backgroundColor: "var(--background)",
        color: "var(--foreground)",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        maxWidth: "960px",
      }}
    >
      <SyncStatusClient />

      <section
        style={{
          border: "1px solid var(--foreground)",
          borderRadius: "0.75rem",
          padding: "1.5rem",
        }}
      >
        <h1 style={{ marginBottom: "0.75rem" }}>Shopify Connection</h1>
        {isConnected ? (
          <>
            <p style={{ marginBottom: "0.5rem" }}>
              <strong>Status:</strong> Connected
            </p>
            <p style={{ marginBottom: "0.5rem" }}>
              <strong>Store:</strong>{" "}
              {integration?.shop_name ?? "Unnamed store"} (
              {integration?.myshopify_domain ?? "unknown domain"})
            </p>
            <p style={{ marginBottom: "1rem" }}>
              Reinstalling will refresh the access token and webhook
              subscriptions.
            </p>
          </>
        ) : (
          <p style={{ marginBottom: "1rem" }}>
            No Shopify store is connected yet for this account.
          </p>
        )}

        <form
          action="/api/shopify/install"
          method="GET"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            maxWidth: "480px",
          }}
        >
          <label htmlFor="shop-input">
            Enter your Shopify shop domain (e.g. my-store.myshopify.com)
          </label>
          <input
            id="shop-input"
            type="text"
            name="shop"
            placeholder="my-store.myshopify.com"
            required
            style={{
              borderRadius: "0.5rem",
              border: "1px solid var(--foreground)",
              padding: "0.75rem",
              fontSize: "1rem",
            }}
          />
          <button
            type="submit"
            style={{
              borderRadius: "0.5rem",
              backgroundColor: "var(--foreground)",
              color: "var(--background)",
              padding: "0.75rem 1.25rem",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
            }}
          >
            {isConnected ? "Reinstall Shopify App" : "Connect Shopify Store"}
          </button>
        </form>
      </section>

      {SHOW_WEBHOOK_DEBUG && integration ? (
        <section
          style={{
            border: "1px solid var(--foreground)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "1rem",
            }}
          >
            <h2>Recent Shopify Webhooks</h2>
            <span
              style={{
                fontSize: "0.85rem",
                color: "var(--foreground)",
                opacity: 0.8,
              }}
            >
              (Dev-only debug view)
            </span>
          </div>
          {recentWebhooks.length === 0 ? (
            <p>No webhook deliveries recorded yet.</p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: "0.75rem",
              }}
            >
              {recentWebhooks.map((webhook) => (
                <div
                  key={webhook.webhook_id}
                  style={{
                    border: "1px solid rgba(255,255,255,0.2)",
                    borderRadius: "0.5rem",
                    padding: "0.75rem",
                  }}
                >
                  <p style={{ margin: 0 }}>
                    <strong>Topic:</strong> {webhook.topic}
                  </p>
                  <p style={{ margin: "0.25rem 0" }}>
                    <strong>Received:</strong> {formatDate(webhook.received_at)}
                  </p>
                  <p
                    style={{
                      fontFamily: "var(--font-geist-mono, monospace)",
                      fontSize: "0.9rem",
                      margin: 0,
                    }}
                  >
                    {renderWebhookSnippet(webhook.payload_json)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}


