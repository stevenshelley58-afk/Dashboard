/** Dashboard home page */
import { createClient } from '@/lib/supabase/server';

export default async function HomePage() {
  const supabase = createClient();
  
  // Fetch sync status
  const { data: syncStatus } = await supabase
    .from('sync_status')
    .select('*')
    .limit(10)
    .order('created_at', { ascending: false });

  return (
    <main className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
      
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Recent Syncs</h2>
        {syncStatus && syncStatus.length > 0 ? (
          <div className="space-y-2">
            {syncStatus.map((sync) => (
              <div key={sync.run_id} className="border p-4 rounded">
                <p>Shop: {sync.shop_id}</p>
                <p>Platform: {sync.platform}</p>
                <p>Status: {sync.status}</p>
                <p>Records: {sync.records_synced || 0}</p>
              </div>
            ))}
          </div>
        ) : (
          <p>No syncs yet</p>
        )}
      </section>
    </main>
  );
}

