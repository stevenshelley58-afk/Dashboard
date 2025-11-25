"use client";

import { useEffect, useState } from "react";

interface IntegrationStatus {
  integration_id: string;
  type: string;
  status: string;
  last_successful_sync: string | null;
  last_attempted_sync: string | null;
  data_fresh_to: string | null;
}

interface SyncStatusResponse {
  integrations: IntegrationStatus[];
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getStatusColor(status: string): string {
  switch (status) {
    case "connected":
    case "active":
      return "status-connected";
    case "error":
    case "failed":
      return "status-disconnected";
    default:
      return "status-pending";
  }
}

export default function SyncStatusClient() {
  const [data, setData] = useState<SyncStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/settings/sync-status");
      if (!res.ok) throw new Error("Failed to fetch sync status");
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const triggerSync = async (integrationId: string, jobType: string) => {
    setSyncing(integrationId);
    setError(null);

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

      // Refresh status after triggering
      setTimeout(fetchStatus, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(null);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Sync Status</h3>
        </div>
        <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (!data?.integrations || data.integrations.length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Sync Status</h3>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </div>
          <p className="empty-state-title">No integrations connected</p>
          <p className="empty-state-text">Connect Shopify or Meta below to start syncing your data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Sync Status</h3>
        <span className="card-subtitle">Monitor your data synchronization</span>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {data.integrations.map((integration) => (
          <div
            key={integration.integration_id}
            style={{
              border: "1px solid var(--border-color)",
              borderRadius: "0.5rem",
              padding: "1rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <strong style={{ textTransform: "capitalize" }}>{integration.type}</strong>
                  <span className={`status-badge ${getStatusColor(integration.status)}`}>
                    {integration.status}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => triggerSync(
                    integration.integration_id,
                    integration.type === "shopify" ? "shopify_fresh" : "meta_fresh"
                  )}
                  disabled={syncing === integration.integration_id}
                  style={{ fontSize: "0.8125rem", padding: "0.375rem 0.75rem" }}
                >
                  {syncing === integration.integration_id ? (
                    <>
                      <div className="spinner" style={{ width: "14px", height: "14px" }} />
                      Syncing...
                    </>
                  ) : (
                    "Sync Now"
                  )}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => triggerSync(
                    integration.integration_id,
                    integration.type === "shopify" ? "shopify_7d_fill" : "meta_7d_fill"
                  )}
                  disabled={syncing === integration.integration_id}
                  style={{ fontSize: "0.8125rem", padding: "0.375rem 0.75rem" }}
                >
                  Backfill 7 Days
                </button>
              </div>
            </div>

            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(3, 1fr)", 
              gap: "1rem",
              fontSize: "0.8125rem",
              color: "var(--text-muted)"
            }}>
              <div>
                <div style={{ fontWeight: "500", color: "var(--foreground)", marginBottom: "0.125rem" }}>
                  Last Successful
                </div>
                {formatDate(integration.last_successful_sync)}
              </div>
              <div>
                <div style={{ fontWeight: "500", color: "var(--foreground)", marginBottom: "0.125rem" }}>
                  Last Attempted
                </div>
                {formatDate(integration.last_attempted_sync)}
              </div>
              <div>
                <div style={{ fontWeight: "500", color: "var(--foreground)", marginBottom: "0.125rem" }}>
                  Data Fresh To
                </div>
                {integration.data_fresh_to ? formatDate(integration.data_fresh_to) : "No data yet"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
