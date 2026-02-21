import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the requesting user
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: authUser }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !authUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = authUser.id;

    // Use service role to delete the auth user
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Delete app data first (profiles, roles, etc. cascade from auth.users via FK)
    // But we clean up explicitly for tables without cascade
    const cleanupTables = [
      { table: 'cart_items', column: 'user_id' },
      { table: 'device_tokens', column: 'user_id' },
      { table: 'favorites', column: 'user_id' },
      { table: 'reviews', column: 'buyer_id' },
      { table: 'warnings', column: 'user_id' },
      { table: 'reports', column: 'reporter_id' },
    ];

    for (const { table, column } of cleanupTables) {
      await supabaseAdmin.from(table).delete().eq(column, userId);
    }

    // Clean up seller data if exists
    const { data: sellerProfile } = await supabaseAdmin
      .from('seller_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (sellerProfile) {
      await supabaseAdmin.from('products').delete().eq('seller_id', sellerProfile.id);
      await supabaseAdmin.from('reviews').delete().eq('seller_id', sellerProfile.id);
      await supabaseAdmin.from('favorites').delete().eq('seller_id', sellerProfile.id);
      await supabaseAdmin.from('seller_profiles').delete().eq('id', sellerProfile.id);
    }

    // Delete user roles and profile
    await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);
    await supabaseAdmin.from('profiles').delete().eq('id', userId);

    // Delete the auth.users record
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error('Failed to delete auth user:', deleteError);
      return new Response(JSON.stringify({ error: 'Failed to delete account' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Delete account error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
