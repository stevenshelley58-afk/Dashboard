/** Sync status card component - server component wrapper for realtime client component */
import { createClient } from '@/lib/supabase/server';
import { RunStatus } from '@/lib/config';
import { RealtimeSyncStatus } from './RealtimeSyncStatus';

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

export async function SyncStatusCard() {
  const supabase = createClient();
  
  const { data: syncs, error } = await supabase
    .schema('reporting')
    .from('sync_status')
    .select('*')
    .limit(10)
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error loading sync status: {error.message}</p>
      </div>
    );
  }

  // Pass initial data to client component for real-time updates
  return <RealtimeSyncStatus initialSyncs={(syncs || []) as SyncStatus[]} />;
}

