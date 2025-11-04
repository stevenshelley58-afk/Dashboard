/** Edge Function: /functions/v1/sync - Enqueue ETL jobs */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  shop_id: string;
  job_type: 'HISTORICAL' | 'INCREMENTAL';
  platform: 'SHOPIFY' | 'META' | 'GA4' | 'KLAVIYO';
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get Supabase client (JWT verified automatically)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Parse request
    const body: SyncRequest = await req.json();

    // Validate request
    if (!body.shop_id || !body.job_type || !body.platform) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: shop_id, job_type, platform' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!['HISTORICAL', 'INCREMENTAL'].includes(body.job_type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid job_type. Must be HISTORICAL or INCREMENTAL' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!['SHOPIFY', 'META', 'GA4', 'KLAVIYO'].includes(body.platform)) {
      return new Response(
        JSON.stringify({ error: 'Invalid platform' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get authenticated user from JWT
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate caller has access to shop_id
    const { data: shopAccess, error: accessError } = await supabaseClient
      .from('user_shops')
      .select('shop_id, role')
      .eq('user_id', user.id)
      .eq('shop_id', body.shop_id)
      .single();

    if (accessError || !shopAccess) {
      return new Response(
        JSON.stringify({ error: 'Access denied: You do not have access to this shop' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify shop exists in core_warehouse.shops
    // Note: Supabase REST API requires schema prefix for non-public schemas
    const shopResponse = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/rest/v1/core_warehouse.shops?shop_id=eq.${body.shop_id}&select=shop_id`,
      {
        method: 'GET',
        headers: {
          'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}`,
        },
      }
    );

    if (!shopResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Shop lookup failed' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const shopData = await shopResponse.json();
    const shop = Array.isArray(shopData) && shopData.length > 0 ? shopData[0] : null;

    if (!shop) {
      return new Response(
        JSON.stringify({ error: 'Shop not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Insert QUEUED job using RPC function
    const { data, error } = await serviceRoleClient.rpc('insert_etl_run', {
      p_shop_id: body.shop_id,
      p_status: 'QUEUED',
      p_job_type: body.job_type,
      p_platform: body.platform,
    });

    if (error) {
      // Handle unique constraint violation (duplicate in-flight job)
      if (error.code === '23505' || error.message?.includes('unique')) {
        return new Response(
          JSON.stringify({ error: 'A job for this shop and platform is already in progress' }),
          {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      throw new Error(`Failed to create ETL run: ${error.message || 'Unknown error'}`);
    }

    if (!data) {
      throw new Error('Failed to create ETL run: No data returned');
    }

    // Return run_id (RPC returns the UUID directly)
    const runId = typeof data === 'string' ? data : data.id || data;
    
    return new Response(
      JSON.stringify({ run_id: runId }),
      {
        status: 202,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Sync function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

