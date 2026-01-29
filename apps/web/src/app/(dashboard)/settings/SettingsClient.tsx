"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Integration {
  integration_id: string;
  type: "shopify" | "meta";
  status: string;
  created_at: string;
  updated_at: string;
  shop_name?: string | null;
  myshopify_domain?: string | null;
  ad_account_name?: string | null;
  platform_ad_account_id?: string | null;
}

interface SyncRun {
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

interface SyncCursor {
  job_type: string;
  cursor_key: string;
  cursor_value: string;
  updated_at: string;
}

interface DataStats {
  orders_count: number;
  latest_order_date: string | null;
  webhooks_count: number;
  latest_webhook: string | null;
}

interface IntegrationDetail {
  integration: Integration;
  recentSyncs: SyncRun[];
  cursors: SyncCursor[];
  dataStats: DataStats;
}

interface SettingsData {
  accountId: string;
  integrations: IntegrationDetail[];
}

interface SettingsClientProps {
  initialData: SettingsData;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  return formatDate(dateStr);
}

function StatusBadge({ status }: { status: string }) {
  const getVariant = () => {
    switch (status.toLowerCase()) {
      case "connected":
      case "completed":
      case "success":
      case "active":
        return "success" as const;
      case "error":
      case "failed":
      case "disconnected":
        return "error" as const;
      case "running":
      case "queued":
        return "warning" as const;
      default:
        return "warning" as const;
    }
  };
  
  const displayStatus = status === "success" ? "completed" : status;
  
  return (
    <Badge variant={getVariant()}>
      {displayStatus}
    </Badge>
  );
}

function IntegrationCard({ detail, onSync, syncing }: { 
  detail: IntegrationDetail; 
  onSync: (integrationId: string, jobType: string) => void;
  syncing: string | null;
}) {
  const { integration, recentSyncs, cursors, dataStats } = detail;
  const isShopify = integration.type === "shopify";
  const [expanded, setExpanded] = useState(false);
  
  const lastSuccessfulSync = recentSyncs.find(s => s.status === "success" || s.status === "completed");
  const lastFailedSync = recentSyncs.find(s => s.status === "failed" || s.status === "error");
  
  return (
    <Card className="mb-4">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex gap-4 items-center">
            <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
            {isShopify ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
              </svg>
            )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">
                  {isShopify ? "Shopify" : "Meta Ads"}
                </CardTitle>
                <StatusBadge status={integration.status} />
              </div>
              <CardDescription className="mt-1">
                {isShopify 
                  ? (integration.shop_name || integration.myshopify_domain || "Not connected")
                  : (integration.ad_account_name || integration.platform_ad_account_id || "Not connected")
                }
              </CardDescription>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSync(integration.integration_id, isShopify ? "shopify_fresh" : "meta_fresh")}
              disabled={syncing === integration.integration_id}
            >
              {syncing === integration.integration_id ? "Syncing..." : "Sync Now"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "Hide Details" : "Show Details"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>

        {/* Quick Stats */}
        <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg ${expanded ? "mb-4" : ""}`}>
          <div>
            <div className="text-xs text-muted-foreground uppercase">Last Sync</div>
            <div className="font-semibold mt-1">
              {formatRelativeTime(lastSuccessfulSync?.completed_at)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase">Data Through</div>
            <div className="font-semibold mt-1">
              {isShopify 
                ? (dataStats.latest_order_date ? formatDate(dataStats.latest_order_date) : "No data")
                : "N/A"
              }
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase">
              {isShopify ? "Orders Synced" : "Days Synced"}
            </div>
            <div className="font-semibold mt-1">
              {isShopify ? dataStats.orders_count.toLocaleString() : "0"}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase">
              {isShopify ? "Webhooks Received" : "API Calls"}
            </div>
            <div className="font-semibold mt-1">
              {isShopify ? dataStats.webhooks_count.toLocaleString() : "0"}
            </div>
          </div>
        </div>

      {/* Expanded Details */}
      {expanded && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Recent Sync History */}
          <div>
            <h4 style={{ fontSize: "0.9375rem", marginBottom: "0.75rem" }}>Recent Sync History</h4>
            {recentSyncs.length > 0 ? (
              <div style={{ border: "1px solid var(--border-color)", borderRadius: "0.5rem", overflow: "hidden" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Job Type</th>
                      <th>Status</th>
                      <th>Trigger</th>
                      <th>Started</th>
                      <th>Rows</th>
                      <th>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSyncs.slice(0, 5).map((sync) => (
                      <tr key={sync.sync_run_id}>
                        <td><code style={{ fontSize: "0.75rem" }}>{sync.job_type}</code></td>
                        <td><StatusBadge status={sync.status} /></td>
                        <td style={{ fontSize: "0.8125rem" }}>{sync.trigger}</td>
                        <td style={{ fontSize: "0.8125rem" }}>{formatRelativeTime(sync.started_at || sync.created_at)}</td>
                        <td style={{ fontSize: "0.8125rem" }}>{sync.rows_processed ?? "-"}</td>
                        <td style={{ fontSize: "0.75rem", color: "var(--error)", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {sync.error_message || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>No sync history yet</p>
            )}
          </div>

          {/* Sync Cursors */}
          {cursors.length > 0 && (
            <div>
              <h4 style={{ fontSize: "0.9375rem", marginBottom: "0.75rem" }}>Sync Cursors (Internal State)</h4>
              <div style={{ 
                background: "var(--background)", 
                borderRadius: "0.5rem", 
                padding: "0.75rem",
                fontFamily: "monospace",
                fontSize: "0.75rem"
              }}>
                {cursors.map((cursor, i) => (
                  <div key={i} style={{ marginBottom: i < cursors.length - 1 ? "0.5rem" : 0 }}>
                    <span style={{ color: "var(--text-muted)" }}>{cursor.job_type}.</span>
                    <span style={{ color: "var(--primary)" }}>{cursor.cursor_key}</span>
                    <span style={{ color: "var(--text-muted)" }}> = </span>
                    <span>{cursor.cursor_value}</span>
                    <span style={{ color: "var(--text-light)", marginLeft: "0.5rem" }}>
                      (updated {formatRelativeTime(cursor.updated_at)})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() => onSync(integration.integration_id, isShopify ? "shopify_7d_fill" : "meta_7d_fill")}
              disabled={syncing === integration.integration_id}
            >
              Backfill Last 7 Days
            </Button>
            {isShopify && integration.status === "connected" && (
              <Button variant="outline" asChild>
                <a href={`/api/shopify/install?shop=${integration.myshopify_domain}`}>
                  Reinstall Webhooks
                </a>
              </Button>
            )}
          </div>
        </div>
      )}
      </CardContent>
    </Card>
  );
}

function ConnectShopifyCard() {
  const [shop, setShop] = useState("");
  
  return (
    <Card className="mb-4">
      <CardHeader>
        <div className="flex gap-4 items-center">
          <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <div>
            <CardTitle>Connect Shopify Store</CardTitle>
            <CardDescription>
              Sync orders, products, and customers from your Shopify store.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form
          action="/api/shopify/install"
          method="GET"
          className="flex gap-3"
        >
          <input
            type="text"
            name="shop"
            value={shop}
            onChange={(e) => setShop(e.target.value)}
            placeholder="your-store.myshopify.com"
            required
            className="flex-1 px-3 py-2 border border-input bg-background rounded-md text-sm"
          />
          <Button type="submit">
            Connect Store
          </Button>
        </form>
        
        <div className="mt-4 text-sm text-muted-foreground">
          <strong>What gets synced:</strong>
          <ul className="mt-2 ml-5 list-disc">
            <li>Orders and order line items</li>
            <li>Customers and customer data</li>
            <li>Products and inventory</li>
            <li>Real-time webhooks for new orders</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function ConnectMetaCard() {
  return (
    <Card className="mb-4">
      <CardHeader>
        <div className="flex gap-4 items-center">
          <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
            </svg>
          </div>
          <div>
            <CardTitle>Connect Meta Ads</CardTitle>
            <CardDescription>
              Sync Facebook and Instagram advertising data.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg mb-4">
          <strong className="text-sm">Coming Soon:</strong> Meta Ads integration is under development. 
          Enter your API credentials below to enable when ready.
        </div>
        
        <div className="bg-muted rounded-lg p-4 text-sm">
          <p className="mb-3 font-medium">Required API Credentials:</p>
          <div className="grid gap-2">
            <div>
              <label className="text-sm font-medium">Meta App ID</label>
              <input type="text" className="w-full mt-1 px-3 py-2 border border-input bg-background rounded-md text-sm" placeholder="Your Meta App ID" disabled />
            </div>
            <div>
              <label className="text-sm font-medium">Meta App Secret</label>
              <input type="password" className="w-full mt-1 px-3 py-2 border border-input bg-background rounded-md text-sm" placeholder="Your Meta App Secret" disabled />
            </div>
            <div>
              <label className="text-sm font-medium">Ad Account ID</label>
              <input type="text" className="w-full mt-1 px-3 py-2 border border-input bg-background rounded-md text-sm" placeholder="act_123456789" disabled />
            </div>
          </div>
          <Button disabled className="mt-4">
            Connect Meta Ads (Coming Soon)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SettingsClient({ initialData }: SettingsClientProps) {
  const [data, setData] = useState<SettingsData>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/integrations");
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to load settings");
      }
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Auto-refresh every 3 seconds if there are running/queued jobs
    const interval = setInterval(() => {
      if (data?.integrations.some(i => 
        i.recentSyncs.some(s => s.status === "queued" || s.status === "running")
      )) {
        fetchData();
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [fetchData, data]);

  const handleSync = async (integrationId: string, jobType: string) => {
    setSyncing(integrationId);
    setSyncMessage(null);
    
    try {
      const res = await fetch("/api/settings/manual-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integration_id: integrationId, job_type: jobType }),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to trigger sync");
      }
      
      const result = await res.json();
      setSyncMessage(`Sync job queued: ${result.sync_run_id || jobType}`);
      
      // Refresh data after a short delay
      setTimeout(fetchData, 2000);
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(null);
    }
  };

  const shopifyIntegrations = data?.integrations.filter(i => i.integration.type === "shopify") ?? [];
  const metaIntegrations = data?.integrations.filter(i => i.integration.type === "meta") ?? [];
  const hasShopify = shopifyIntegrations.length > 0;
  const hasMeta = metaIntegrations.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings & Integrations</h1>
          <p className="text-muted-foreground mt-1">
            Manage your connected platforms, API keys, and sync status.
          </p>
        </div>
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh Status"}
        </Button>
      </div>

      {/* Error Banner */}
      {error && (
        <Card className="mb-4 border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <strong className="text-destructive">Error:</strong> {error}
              </div>
              <Button variant="outline" size="sm" onClick={fetchData}>
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sync Message */}
      {syncMessage && (
        <Card className={`mb-4 ${syncMessage.includes("failed") || syncMessage.includes("Error") ? "border-destructive" : "border-green-500"}`}>
          <CardContent className="pt-6">
            {syncMessage}
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Content */}
      {!loading && (
        <>
          {/* Connected Integrations */}
          {(hasShopify || hasMeta) && (
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">
                Connected Integrations
              </h2>
              
              {shopifyIntegrations.map((detail) => (
                <IntegrationCard 
                  key={detail.integration.integration_id} 
                  detail={detail} 
                  onSync={handleSync}
                  syncing={syncing}
                />
              ))}
              
              {metaIntegrations.map((detail) => (
                <IntegrationCard 
                  key={detail.integration.integration_id} 
                  detail={detail} 
                  onSync={handleSync}
                  syncing={syncing}
                />
              ))}
            </section>
          )}

          {/* Add New Integrations */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">
              {hasShopify || hasMeta ? "Add More Integrations" : "Connect Your Platforms"}
            </h2>
            
            {!hasShopify && <ConnectShopifyCard />}
            {!hasMeta && <ConnectMetaCard />}
            
            {hasShopify && !hasMeta && (
              <ConnectMetaCard />
            )}
          </section>

          {/* Account Info */}
          <section className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Account Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Account ID: </span>
                    <code className="bg-muted px-2 py-1 rounded text-xs">
                      {data?.accountId || "Loading..."}
                    </code>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Integrations: </span>
                    <span>{data?.integrations.length ?? 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Help Section */}
          <section className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Need Help?</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground space-y-3">
                  <p>
                    <strong>Sync not working?</strong> Try clicking "Backfill Last 7 Days" to re-sync historical data.
                  </p>
                  <p>
                    <strong>Missing webhooks?</strong> Click "Reinstall Webhooks" to re-register webhook subscriptions with Shopify.
                  </p>
                  <p>
                    <strong>Data looks wrong?</strong> Check the sync history above for any error messages.
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}

