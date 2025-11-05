'use client';

/** Real-time sync status component using Supabase subscriptions */
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { RunStatus } from '@/lib/config';

interface SyncStatus {
  run_id: string;
  shop_id: string;
  shop_name: string | null;
  status: RunStatus;
  job_type: string;
  platform: string;
  records_synced: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error: { code?: string; message?: string } | null;
}

interface RealtimeSyncStatusProps {
  initialSyncs: SyncStatus[];
}

export function RealtimeSyncStatus({ initialSyncs }: RealtimeSyncStatusProps) {
  const [syncs, setSyncs] = useState<SyncStatus[]>(initialSyncs);

  useEffect(() => {
    const supabase = createClient();

    // Subscribe to changes in the reporting.sync_status view
    // Note: Supabase realtime works on tables, not views
    // For views, we need to subscribe to the underlying table (core_warehouse.etl_runs)
    const channel = supabase
      .channel('sync-status-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'core_warehouse',
          table: 'etl_runs',
        },
        async (_payload) => {
          // When an etl_run changes, refetch the sync_status view
          const { data: updatedSyncs } = await supabase
            .schema('reporting')
            .from('sync_status')
            .select('*')
            .limit(10)
            .order('created_at', { ascending: false });

          if (updatedSyncs) {
            setSyncs(updatedSyncs as SyncStatus[]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getStatusColor = (status: RunStatus) => {
    switch (status) {
      case RunStatus.SUCCEEDED:
        return 'bg-green-100 text-green-800 border-green-200';
      case RunStatus.FAILED:
        return 'bg-red-100 text-red-800 border-red-200';
      case RunStatus.IN_PROGRESS:
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case RunStatus.QUEUED:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case RunStatus.PARTIAL:
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (!syncs || syncs.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <p className="text-gray-600">No syncs yet. Trigger a sync to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {syncs.map((sync: SyncStatus) => (
        <div
          key={sync.run_id}
          className={`border rounded-lg p-4 ${getStatusColor(sync.status)} transition-all duration-200`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold">{sync.shop_name || sync.shop_id}</span>
                <span className="text-sm opacity-75">•</span>
                <span className="text-sm font-medium">{sync.platform}</span>
                <span className="text-sm opacity-75">•</span>
                <span className="text-sm">{sync.job_type}</span>
                {sync.status === RunStatus.IN_PROGRESS && (
                  <span className="ml-2 inline-block h-2 w-2 bg-blue-600 rounded-full animate-pulse" />
                )}
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="font-medium">Status: {sync.status}</span>
                {sync.records_synced !== null && (
                  <span>Records: {sync.records_synced.toLocaleString()}</span>
                )}
                <span className="text-xs opacity-75">
                  {new Date(sync.created_at).toLocaleString()}
                </span>
              </div>
              {sync.error && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs">
                  <p className="font-semibold text-red-900">Error:</p>
                  <p className="text-red-800">
                    {sync.error.code || 'UNKNOWN'}: {sync.error.message || JSON.stringify(sync.error)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

