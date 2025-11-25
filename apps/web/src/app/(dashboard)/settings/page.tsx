import { requireAccountContext } from "@/lib/auth";
import { getDbPool } from "@/lib/db";
import SyncStatusClient from "./SyncStatusClient";

export const dynamic = "force-dynamic";

interface ShopifyIntegrationRow {
  integration_id: string;
  status: string;
  shop_name: string | null;
  myshopify_domain: string | null;
}

interface MetaIntegrationRow {
  integration_id: string;
  status: string;
  ad_account_name: string | null;
}

async function getShopifyIntegration(accountId: string): Promise<ShopifyIntegrationRow | null> {
  const pool = getDbPool();
  const result = await pool.query<ShopifyIntegrationRow>(
    `
      SELECT i.integration_id, i.status, s.shop_name, s.myshopify_domain
      FROM integrations i
      LEFT JOIN shops s ON s.shop_id = i.shop_id
      WHERE i.account_id = $1 AND i.type = 'shopify'
      ORDER BY i.updated_at DESC NULLS LAST
      LIMIT 1
    `,
    [accountId]
  );
  return result.rows[0] ?? null;
}

async function getMetaIntegration(accountId: string): Promise<MetaIntegrationRow | null> {
  const pool = getDbPool();
  const result = await pool.query<MetaIntegrationRow>(
    `
      SELECT i.integration_id, i.status, aa.ad_account_name
      FROM integrations i
      LEFT JOIN ad_accounts aa ON aa.ad_account_id = i.ad_account_id
      WHERE i.account_id = $1 AND i.type = 'meta'
      ORDER BY i.updated_at DESC NULLS LAST
      LIMIT 1
    `,
    [accountId]
  );
  return result.rows[0] ?? null;
}

export default async function SettingsPage() {
  const { accountId } = await requireAccountContext();
  const shopifyIntegration = await getShopifyIntegration(accountId);
  const metaIntegration = await getMetaIntegration(accountId);
  
  const isShopifyConnected = shopifyIntegration?.status === "connected";
  const isMetaConnected = metaIntegration?.status === "connected";

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-title-section">
          <h1>Settings</h1>
          <p>Manage your integrations and sync status.</p>
        </div>
      </div>

      {/* Sync Status */}
      <SyncStatusClient />

      {/* Integrations */}
      <div style={{ marginTop: "1.5rem" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: "600", marginBottom: "1rem" }}>Integrations</h2>

        {/* Shopify Connection */}
        <div className="connection-card">
          <div className="connection-header">
            <div className="connection-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            </div>
            <div className="connection-info">
              <h3>Shopify</h3>
              <p>Connect your Shopify store to sync orders and products.</p>
            </div>
            <span className={`status-badge ${isShopifyConnected ? "status-connected" : "status-disconnected"}`}>
              {isShopifyConnected ? "Connected" : "Not Connected"}
            </span>
          </div>

          {isShopifyConnected && shopifyIntegration && (
            <div style={{ 
              background: "var(--background)", 
              borderRadius: "0.5rem", 
              padding: "1rem", 
              marginBottom: "1rem",
              fontSize: "0.875rem"
            }}>
              <p><strong>Store:</strong> {shopifyIntegration.shop_name ?? "Unnamed store"}</p>
              <p style={{ marginTop: "0.25rem", color: "var(--text-muted)" }}>
                {shopifyIntegration.myshopify_domain ?? "unknown domain"}
              </p>
            </div>
          )}

          <form
            action="/api/shopify/install"
            method="GET"
            style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
          >
            <label className="label" htmlFor="shop-input">
              Shopify store domain
            </label>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <input
                id="shop-input"
                type="text"
                name="shop"
                placeholder="my-store.myshopify.com"
                required
                className="input"
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btn-primary">
                {isShopifyConnected ? "Reconnect" : "Connect"}
              </button>
            </div>
          </form>
        </div>

        {/* Meta Connection */}
        <div className="connection-card">
          <div className="connection-header">
            <div className="connection-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
              </svg>
            </div>
            <div className="connection-info">
              <h3>Meta (Facebook/Instagram)</h3>
              <p>Connect your Meta ad account to sync advertising data.</p>
            </div>
            <span className={`status-badge ${isMetaConnected ? "status-connected" : "status-disconnected"}`}>
              {isMetaConnected ? "Connected" : "Not Connected"}
            </span>
          </div>

          {isMetaConnected && metaIntegration && (
            <div style={{ 
              background: "var(--background)", 
              borderRadius: "0.5rem", 
              padding: "1rem", 
              marginBottom: "1rem",
              fontSize: "0.875rem"
            }}>
              <p><strong>Ad Account:</strong> {metaIntegration.ad_account_name ?? "Connected"}</p>
            </div>
          )}

          <div className="alert alert-info">
            <strong>Coming Soon:</strong> Meta ad account integration is under development. 
            You&apos;ll be able to connect your Facebook and Instagram ad accounts to see blended ROAS and MER metrics.
          </div>
        </div>
      </div>

      {/* Account Info */}
      <div className="card" style={{ marginTop: "1.5rem" }}>
        <div className="card-header">
          <h3 className="card-title">Account Information</h3>
        </div>
        <div style={{ fontSize: "0.875rem" }}>
          <p><strong>Account ID:</strong> <code style={{ 
            background: "var(--background)", 
            padding: "0.125rem 0.375rem", 
            borderRadius: "0.25rem",
            fontSize: "0.8125rem"
          }}>{accountId}</code></p>
        </div>
      </div>
    </div>
  );
}
