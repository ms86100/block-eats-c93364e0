import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Simple HMAC-like signing using Web Crypto API
async function signToken(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function verifySignature(payload: string, signature: string, secret: string): Promise<boolean> {
  const expected = await signToken(payload, secret);
  return expected === signature;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userId = claimsData.claims.sub;
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'generate';

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const signingSecret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!.substring(0, 32);

    if (action === 'generate') {
      // Get user profile
      const { data: profile, error: profileError } = await serviceClient
        .from('profiles')
        .select('id, name, society_id, flat_number, block, verification_status, avatar_url')
        .eq('id', userId)
        .single();

      if (profileError || !profile || profile.verification_status !== 'approved') {
        return new Response(JSON.stringify({ error: 'Not a verified resident' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (!profile.society_id) {
        return new Response(JSON.stringify({ error: 'Not assigned to a society' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const now = Math.floor(Date.now() / 1000);
      const expiresAt = now + 60; // 60 seconds

      const payload = JSON.stringify({
        uid: profile.id,
        sid: profile.society_id,
        name: profile.name,
        flat: profile.flat_number,
        block: profile.block,
        avatar: profile.avatar_url,
        iat: now,
        exp: expiresAt,
      });

      const signature = await signToken(payload, signingSecret);
      const gateToken = btoa(payload) + '.' + signature;

      return new Response(JSON.stringify({
        token: gateToken,
        expires_at: expiresAt,
        resident: {
          name: profile.name,
          flat_number: profile.flat_number,
          block: profile.block,
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } else if (action === 'validate') {
      const body = await req.json();
      const gateToken = body.token;

      if (!gateToken || !gateToken.includes('.')) {
        return new Response(JSON.stringify({ valid: false, error: 'Invalid token format' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const [payloadB64, signature] = gateToken.split('.');
      let payload: any;
      try {
        payload = JSON.parse(atob(payloadB64));
      } catch {
        return new Response(JSON.stringify({ valid: false, error: 'Corrupted token' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Verify signature
      const isValid = await verifySignature(JSON.stringify(payload), signature, signingSecret);
      if (!isValid) {
        return new Response(JSON.stringify({ valid: false, error: 'Invalid signature' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Check expiry
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        return new Response(JSON.stringify({ valid: false, error: 'Token expired', expired: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Verify security officer belongs to same society
      const { data: securityCheck } = await serviceClient
        .from('security_staff')
        .select('id')
        .eq('user_id', userId)
        .eq('society_id', payload.sid)
        .eq('is_active', true)
        .is('deactivated_at', null)
        .maybeSingle();

      // Also allow society admins
      const isOfficer = !!securityCheck;
      const { data: adminCheck } = await serviceClient.rpc('is_society_admin', { _user_id: userId, _society_id: payload.sid });
      
      if (!isOfficer && !adminCheck) {
        return new Response(JSON.stringify({ valid: false, error: 'Not authorized for this society' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Log the gate entry
      await serviceClient.from('gate_entries').insert({
        user_id: payload.uid,
        society_id: payload.sid,
        entry_type: 'qr_verified',
        verified_by: userId,
        flat_number: payload.flat,
        resident_name: payload.name,
        confirmation_status: 'not_required',
      });

      return new Response(JSON.stringify({
        valid: true,
        resident: {
          name: payload.name,
          flat_number: payload.flat,
          block: payload.block,
          avatar_url: payload.avatar,
          user_id: payload.uid,
        },
        society_id: payload.sid,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } else {
      return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (error) {
    console.error('Gate token error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
