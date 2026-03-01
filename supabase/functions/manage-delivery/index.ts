import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limiter.ts";
import { withAuth } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// C2: Cryptographically secure 4-digit OTP
function generateOTP(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(1000 + (arr[0] % 9000));
}

// Hash OTP with SHA-256
async function hashOTP(otp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

async function verifyOTP(otp: string, hash: string): Promise<boolean> {
  const computed = await hashOTP(otp);
  // Constant-time comparison to prevent timing attacks (matches verifyHMAC pattern)
  const aDecoded = atob(computed);
  const bDecoded = atob(hash);
  const aBytes = new Uint8Array(aDecoded.length);
  const bBytes = new Uint8Array(bDecoded.length);
  for (let i = 0; i < aDecoded.length; i++) aBytes[i] = aDecoded.charCodeAt(i);
  for (let i = 0; i < bDecoded.length; i++) bBytes[i] = bDecoded.charCodeAt(i);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

// C3: HMAC-SHA256 verification with constant-time comparison
async function verifyHMAC(body: string, signature: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw", encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const expectedBytes = new Uint8Array(sig);
    // Decode incoming base64 signature to bytes
    const sigDecoded = atob(signature);
    const sigBytes = new Uint8Array(sigDecoded.length);
    for (let i = 0; i < sigDecoded.length; i++) {
      sigBytes[i] = sigDecoded.charCodeAt(i);
    }
    if (expectedBytes.length !== sigBytes.length) return false;
    // Constant-time comparison to prevent timing attacks
    let diff = 0;
    for (let i = 0; i < expectedBytes.length; i++) {
      diff |= expectedBytes[i] ^ sigBytes[i];
    }
    return diff === 0;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Service client for all operations (bypasses RLS)
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Webhook doesn't require user auth
    if (action === 'webhook') {
      return await handleWebhook(req, serviceClient);
    }

    // All other actions require auth (Phase 5: centralized)
    const authResult = await withAuth(req, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const { userId } = authResult;

    // Phase 2: Rate limiting for authenticated actions
    const { allowed } = await checkRateLimit(`delivery:${userId}`, 20, 60);
    if (!allowed) return rateLimitResponse(corsHeaders);

    // Phase 1 Step 3: Feature check before mutations
    if (['assign', 'update_status', 'complete'].includes(action || '')) {
      // Get user's society to check feature flag
      const { data: profile } = await serviceClient
        .from('profiles').select('society_id').eq('id', userId).single();
      if (profile?.society_id) {
        const { data: enabled } = await serviceClient.rpc(
          'is_feature_enabled_for_society',
          { _society_id: profile.society_id, _feature_key: 'delivery' }
        );
        if (enabled === false) return jsonResponse({ error: 'Delivery feature is disabled for your society' }, 403);
      }
    }

    switch (action) {
      case 'assign':
        return await handleAssign(req, serviceClient, userId);
      case 'update_status':
        return await handleUpdateStatus(req, serviceClient, userId);
      case 'complete':
        return await handleComplete(req, serviceClient, userId);
      case 'track':
        return await handleTrack(req, serviceClient, userId);
      case 'calculate_fee':
        return await handleCalculateFee(req, serviceClient, userId);
      default:
        return jsonResponse({ error: 'Invalid action' }, 400);
    }
  } catch (error) {
    console.error('manage-delivery error:', error);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});

// Assign a delivery partner to a pending assignment
async function handleAssign(req: Request, db: any, userId: string) {
  const body = await req.json();
  const { assignment_id, partner_id, rider_name, rider_phone } = body;

  if (!assignment_id) return jsonResponse({ error: 'assignment_id required' }, 400);

  const { data: assignment } = await db
    .from('delivery_assignments')
    .select('id, order_id, society_id, status')
    .eq('id', assignment_id)
    .single();

  if (!assignment) return jsonResponse({ error: 'Assignment not found' }, 404);
  if (assignment.status !== 'pending') return jsonResponse({ error: 'Assignment not in pending status' }, 400);

  const { error } = await db
    .from('delivery_assignments')
    .update({
      partner_id: partner_id || null,
      rider_name: rider_name || null,
      rider_phone: rider_phone || null,
      status: 'assigned',
      assigned_at: new Date().toISOString(),
    })
    .eq('id', assignment_id);

  if (error) return jsonResponse({ error: error.message }, 500);

  await db.from('delivery_tracking_logs').insert({
    assignment_id,
    status: 'assigned',
    note: `Assigned to ${rider_name || 'rider'}`,
    source: 'manual',
  });

  return jsonResponse({ success: true });
}

// Update delivery status (pickup, at_gate, etc.)
async function handleUpdateStatus(req: Request, db: any, userId: string) {
  const body = await req.json();
  const { assignment_id, status, note, location_lat, location_lng } = body;

  if (!assignment_id || !status) return jsonResponse({ error: 'assignment_id and status required' }, 400);

  const validStatuses = ['picked_up', 'at_gate', 'failed', 'cancelled'];
  if (!validStatuses.includes(status)) return jsonResponse({ error: `Invalid status: ${status}` }, 400);

  const { data: assignment } = await db
    .from('delivery_assignments')
    .select('id, order_id, society_id, status as current_status')
    .eq('id', assignment_id)
    .single();

  if (!assignment) return jsonResponse({ error: 'Assignment not found' }, 404);

  const updateData: Record<string, any> = { status };

  if (status === 'picked_up') {
    updateData.pickup_at = new Date().toISOString();
    const otp = generateOTP();
    updateData.otp_hash = await hashOTP(otp);
    updateData.otp_expires_at = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const { data: order } = await db.from('orders').select('buyer_id').eq('id', assignment.order_id).single();
    if (order) {
      await db.from('notification_queue').insert({
        user_id: order.buyer_id,
        title: '🔑 Delivery OTP',
        body: `Your delivery OTP is ${otp}. Share this with the delivery partner to confirm delivery.`,
        type: 'delivery',
        reference_path: `/orders/${assignment.order_id}`,
        payload: { orderId: assignment.order_id, deliveryStatus: 'picked_up' },
      });

      const { data: asgn } = await db
        .from('delivery_assignments')
        .select('rider_name, rider_phone, society_id')
        .eq('id', assignment_id)
        .single();

      const { data: buyer } = await db
        .from('profiles')
        .select('id, flat_number, name')
        .eq('id', order.buyer_id)
        .single();

      if (asgn && buyer) {
        const visitorOtp = String(Math.floor(100000 + Math.random() * 900000));
        await db.from('visitor_entries').insert({
          society_id: asgn.society_id,
          resident_id: buyer.id,
          visitor_name: asgn.rider_name || 'Delivery Rider',
          visitor_phone: asgn.rider_phone || null,
          visitor_type: 'delivery',
          flat_number: buyer.flat_number,
          purpose: `Order #${assignment.order_id.slice(0, 8)} delivery`,
          expected_date: new Date().toISOString().split('T')[0],
          status: 'expected',
          is_preapproved: true,
          otp_code: visitorOtp,
          otp_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        });

        await db.from('notification_queue').insert({
          user_id: buyer.id,
          title: '🏠 Delivery Rider Gate OTP',
          body: `Gate OTP for your delivery rider: ${visitorOtp}. Share this with the guard if needed.`,
          type: 'delivery',
          reference_path: `/orders/${assignment.order_id}`,
          payload: { orderId: assignment.order_id, gateOtp: visitorOtp },
        });
      }
    }

    await db.from('orders').update({ status: 'picked_up' }).eq('id', assignment.order_id);
  }

  if (status === 'failed') {
    updateData.failed_reason = note || 'Delivery failed';
    updateData.attempt_count = (assignment as any).attempt_count + 1;
    updateData.failure_owner = body.failure_owner || null;
    await db.from('orders').update({ status: 'returned' }).eq('id', assignment.order_id);
  }

  if (status === 'at_gate') {
    updateData.at_gate_at = new Date().toISOString();
    const { data: asgn } = await db
      .from('delivery_assignments')
      .select('rider_name, order_id, society_id')
      .eq('id', assignment_id)
      .single();

    if (asgn) {
      const { data: order } = await db.from('orders').select('buyer_id').eq('id', asgn.order_id).single();
      if (order) {
        await db.from('notification_queue').insert({
          user_id: order.buyer_id,
          title: '🏠 Delivery Rider at Gate',
          body: `${asgn.rider_name || 'Your delivery rider'} is at the society gate. Please share your delivery OTP to confirm.`,
          type: 'delivery',
          reference_path: `/orders/${asgn.order_id}`,
          payload: { orderId: asgn.order_id, deliveryStatus: 'at_gate' },
        });
      }
    }
  }

  const { error } = await db
    .from('delivery_assignments')
    .update(updateData)
    .eq('id', assignment_id);

  if (error) return jsonResponse({ error: error.message }, 500);

  await db.from('delivery_tracking_logs').insert({
    assignment_id,
    status,
    note: note || null,
    location_lat: location_lat || null,
    location_lng: location_lng || null,
    source: 'manual',
  });

  return jsonResponse({ success: true });
}

// Complete delivery with OTP verification
async function handleComplete(req: Request, db: any, userId: string) {
  const body = await req.json();
  const { assignment_id, otp } = body;

  if (!assignment_id || !otp) return jsonResponse({ error: 'assignment_id and otp required' }, 400);

  const { data: assignment } = await db
    .from('delivery_assignments')
    .select('id, order_id, otp_hash, otp_expires_at, status, otp_attempt_count, max_otp_attempts')
    .eq('id', assignment_id)
    .single();

  if (!assignment) return jsonResponse({ error: 'Assignment not found' }, 404);
  if (!['picked_up', 'at_gate'].includes(assignment.status)) {
    return jsonResponse({ error: 'Assignment not in deliverable status' }, 400);
  }

  // OTP lockout check
  if (assignment.otp_attempt_count >= assignment.max_otp_attempts) {
    return jsonResponse({ error: 'OTP attempts exhausted. Delivery locked.' }, 423);
  }

  if (!assignment.otp_hash) return jsonResponse({ error: 'No OTP set for this delivery' }, 400);

  if (assignment.otp_expires_at && new Date(assignment.otp_expires_at) < new Date()) {
    return jsonResponse({ error: 'OTP has expired' }, 400);
  }

  // Increment attempt count before verification
  await db
    .from('delivery_assignments')
    .update({ otp_attempt_count: assignment.otp_attempt_count + 1 })
    .eq('id', assignment_id);

  const isValid = await verifyOTP(otp, assignment.otp_hash);
  if (!isValid) return jsonResponse({ error: 'Invalid OTP' }, 400);

  const { error } = await db
    .from('delivery_assignments')
    .update({
      status: 'delivered',
      delivered_at: new Date().toISOString(),
      otp_hash: null,
    })
    .eq('id', assignment_id);

  if (error) return jsonResponse({ error: error.message }, 500);

  await db.from('orders').update({ status: 'delivered' }).eq('id', assignment.order_id);

  await db.from('delivery_tracking_logs').insert({
    assignment_id,
    status: 'delivered',
    note: 'Delivery confirmed via OTP',
    source: 'system',
  });

  return jsonResponse({ success: true });
}

// Track delivery status
async function handleTrack(_req: Request, db: any, userId: string) {
  const url = new URL(_req.url);
  const orderId = url.searchParams.get('order_id');

  if (!orderId) return jsonResponse({ error: 'order_id required' }, 400);

  const { data: assignment } = await db
    .from('delivery_assignments')
    .select('id, status, rider_name, rider_phone, rider_photo_url, pickup_at, delivered_at, failed_reason, attempt_count, created_at')
    .eq('order_id', orderId)
    .single();

  if (!assignment) return jsonResponse({ error: 'No delivery assignment found' }, 404);

  const { data: logs } = await db
    .from('delivery_tracking_logs')
    .select('status, note, location_lat, location_lng, source, created_at')
    .eq('assignment_id', assignment.id)
    .order('created_at', { ascending: true });

  return jsonResponse({ assignment, tracking_logs: logs || [] });
}

// Phase 3: Handle 3PL webhooks with signature verification
async function handleWebhook(req: Request, db: any) {
  // Rate limit webhooks: 60/min per IP
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const { allowed } = await checkRateLimit(`webhook:${clientIp}`, 60, 60);
  if (!allowed) return rateLimitResponse(corsHeaders);

  const rawBody = await req.text();
  const signature = req.headers.get('x-webhook-signature');

  // Get 3PL webhook secret from system_settings
  const { data: setting } = await db
    .from('system_settings')
    .select('value')
    .eq('key', '3pl_webhook_secret')
    .maybeSingle();

  if (setting?.value) {
    if (!signature) {
      return jsonResponse({ error: 'Missing webhook signature' }, 401);
    }
    const isValid = await verifyHMAC(rawBody, signature, setting.value);
    if (!isValid) {
      // Log rejected webhook
      await db.from('audit_log').insert({
        action: 'webhook_signature_invalid',
        target_type: 'delivery_webhook',
        metadata: { ip: clientIp },
      }).then(() => {}, () => {});
      return jsonResponse({ error: 'Invalid webhook signature' }, 401);
    }
  }
  // If no secret configured, allow (backward compat during setup)

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { external_tracking_id, status, rider_name, rider_phone, location_lat, location_lng } = body;

  if (!external_tracking_id || !status) {
    return jsonResponse({ error: 'external_tracking_id and status required' }, 400);
  }

  const { data: assignment } = await db
    .from('delivery_assignments')
    .select('id, order_id')
    .eq('external_tracking_id', external_tracking_id)
    .single();

  if (!assignment) return jsonResponse({ error: 'Assignment not found' }, 404);

  const updateData: Record<string, any> = {};
  if (rider_name) updateData.rider_name = rider_name;
  if (rider_phone) updateData.rider_phone = rider_phone;

  const statusMap: Record<string, string> = {
    'assigned': 'assigned',
    'picked_up': 'picked_up',
    'in_transit': 'picked_up',
    'arrived': 'at_gate',
    'delivered': 'delivered',
    'failed': 'failed',
    'cancelled': 'cancelled',
  };

  const internalStatus = statusMap[status];
  if (internalStatus) {
    updateData.status = internalStatus;
    if (internalStatus === 'picked_up') updateData.pickup_at = new Date().toISOString();
    if (internalStatus === 'delivered') updateData.delivered_at = new Date().toISOString();
  }

  if (Object.keys(updateData).length > 0) {
    await db.from('delivery_assignments').update(updateData).eq('id', assignment.id);
  }

  await db.from('delivery_tracking_logs').insert({
    assignment_id: assignment.id,
    status: internalStatus || status,
    location_lat: location_lat || null,
    location_lng: location_lng || null,
    note: `3PL status: ${status}`,
    source: '3pl_webhook',
  });

  return jsonResponse({ success: true });
}

// Calculate delivery fee based on society config
async function handleCalculateFee(req: Request, db: any, userId: string) {
  const url = new URL(req.url);
  const orderValue = parseFloat(url.searchParams.get('order_value') || '0');

  const { data: settingsRows } = await db
    .from('system_settings')
    .select('key, value')
    .in('key', ['base_delivery_fee', 'free_delivery_threshold']);

  const settingsMap: Record<string, string> = {};
  for (const row of settingsRows || []) {
    if (row.key && row.value) settingsMap[row.key] = row.value;
  }

  const baseFee = parseInt(settingsMap.base_delivery_fee || '20', 10) || 20;
  const freeThreshold = parseInt(settingsMap.free_delivery_threshold || '500', 10) || 500;

  if (orderValue >= freeThreshold) {
    return jsonResponse({ delivery_fee: 0, partner_payout: 0, platform_margin: 0, free_delivery: true });
  }

  const deliveryFee = baseFee;
  const partnerPayout = Math.round(deliveryFee * 0.7);
  const platformMargin = deliveryFee - partnerPayout;

  return jsonResponse({ delivery_fee: deliveryFee, partner_payout: partnerPayout, platform_margin: platformMargin, free_delivery: false });
}
