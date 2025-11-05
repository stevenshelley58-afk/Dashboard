'use client';

/** Shop selector component - fetches user-accessible shops */
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Shop {
  shop_id: string;
  shop_name: string | null;
  shop_domain: string | null;
  role: string;
}

interface ShopSelectorProps {
  value: string;
  onChange: (shopId: string) => void;
  required?: boolean;
  disabled?: boolean;
}

export function ShopSelector({ value, onChange, required = false, disabled = false }: ShopSelectorProps) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchShops() {
      try {
        const supabase = createClient();
        
        // Get user's accessible shops from user_shops table
        const { data: userShops, error: userShopsError } = await supabase
          .schema('app_dashboard')
          .from('user_shops')
          .select('shop_id, role');

        if (userShopsError) {
          throw userShopsError;
        }

        if (!userShops || userShops.length === 0) {
          setShops([]);
          setLoading(false);
          return;
        }

        // Get shop details from core_warehouse.shops
        const shopIds = userShops.map(us => us.shop_id);
        const { data: shopDetails, error: shopDetailsError } = await supabase
          .schema('core_warehouse')
          .from('shops')
          .select('shop_id, shop_name, shop_domain')
          .in('shop_id', shopIds);

        if (shopDetailsError) {
          throw shopDetailsError;
        }

        // Combine user_shops with shop details
        const shopsWithDetails = (shopDetails || []).map(shop => {
          const userShop = userShops.find(us => us.shop_id === shop.shop_id);
          return {
            shop_id: shop.shop_id,
            shop_name: shop.shop_name,
            shop_domain: shop.shop_domain,
            role: userShop?.role || 'viewer',
          };
        });

        setShops(shopsWithDetails);
      } catch (err) {
        console.error('Error fetching shops:', err);
        setError(err instanceof Error ? err.message : 'Failed to load shops');
      } finally {
        setLoading(false);
      }
    }

    fetchShops();
  }, []);

  if (loading) {
    return (
      <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 animate-pulse">
        <span className="text-gray-400">Loading shops...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full px-3 py-2 border border-red-300 rounded-md bg-red-50">
        <span className="text-red-800 text-sm">Error: {error}</span>
      </div>
    );
  }

  if (shops.length === 0) {
    return (
      <div className="space-y-2">
        <div className="w-full px-3 py-2 border border-yellow-300 rounded-md bg-yellow-50">
          <span className="text-yellow-800 text-sm">
            No shops available. You can enter a shop ID manually:
          </span>
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={disabled}
          placeholder="Enter shop ID (e.g., sh_123abc)"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      disabled={disabled}
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
    >
      <option value="">Select a shop...</option>
      {shops.map((shop) => (
        <option key={shop.shop_id} value={shop.shop_id}>
          {shop.shop_name || shop.shop_domain || shop.shop_id} {shop.role !== 'viewer' && `(${shop.role})`}
        </option>
      ))}
    </select>
  );
}

