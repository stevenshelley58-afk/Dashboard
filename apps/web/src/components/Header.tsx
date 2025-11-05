'use client';

/** Header component with navigation and auth status */
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

export function Header() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    }

    getUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 max-w-7xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-900">Data Pipeline Dashboard</h1>
            <nav className="hidden md:flex items-center gap-4">
              <a href="/" className="text-sm text-gray-600 hover:text-gray-900">
                Dashboard
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {loading ? (
              <div className="h-8 w-20 bg-gray-200 rounded animate-pulse" />
            ) : user ? (
              <div className="flex items-center gap-3">
                <div className="text-sm text-gray-600">
                  <span className="hidden sm:inline">Signed in as </span>
                  <span className="font-medium">{user.email}</span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="text-sm text-yellow-600">
                Not authenticated
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

