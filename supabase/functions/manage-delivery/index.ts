import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// Simple OTP generation (4-digit)
function generateOTP(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// Hash OTP with SHA-256 (no bcrypt needed for 4-digit numeric)
async function hashOTP(otp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

async function verifyOTP(otp: string, hash: string): Promise<boolean> {
  const computed = await hashOTP(otp);
  return computed === hash;
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

    // All other actions require auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    const userId = claimsData.claims.sub as string;

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

  // Verify user is admin or society admin
  const { data: assignment } = await db
    .from('delivery_assignments')
    .select('id, order_id, society_id, status')
    .eq('id', assignment_id)
    .single();

  if (!assignment) return jsonResponse({ error: 'Assignment not found' }, 404);
  if (assignment.status !== 'pending') return jsonResponse({ error: 'Assignment not in pending status' }, 400);

  // Update assignment
  const { error } = await db
    .from('delivery_assignments')
    .update({
      partner_id: partner_id || null,
      rider_name: rider_name || null,
      rider_phone: rider_phone || null,
      status: 'assigned',
    })
    .eq('id', assignment_id);

  if (error) return jsonResponse({ error: error.message }, 500);

  // Log tracking event
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
    // Generate OTP for delivery completion
    const otp = generateOTP();
    updateData.otp_hash = await hashOTP(otp);
    updateData.otp_expires_at = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min

    // Get order + buyer info for visitor entry
    const { data: order } = await db.from('orders').select('buyer_id').eq('id', assignment.order_id).single();
    if (order) {
      // Send OTP to buyer via notification
      await db.from('notification_queue').insert({
        user_id: order.buyer_id,
        title: '🔑 Delivery OTP',
        body: `Your delivery OTP is ${otp}. Share this with the delivery partner to confirm delivery.`,
        type: 'delivery',
        reference_path: `/orders/${assignment.order_id}`,
        payload: { orderId: assignment.order_id, deliveryStatus: 'picked_up' },
      });

      // Get rider info & buyer profile for gate pre-registration
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
        // Create visitor_entries record so delivery rider shows in Guard Kiosk "Expected" tab
        const visitorOtp = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit for gate
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
          otp_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
        });

        // Notify buyer with gate OTP for the delivery rider
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

    // Also update order status to picked_up
    await db.from('orders').update({ status: 'picked_up' }).eq('id', assignment.order_id);
  }

  if (status === 'failed') {
    updateData.failed_reason = note || 'Delivery failed';
    updateData.attempt_count = (assignment as any).attempt_count + 1;
    // Update order to returned
    await db.from('orders').update({ status: 'returned' }).eq('id', assignment.order_id);
  }

  if (status === 'at_gate') {
    // Update the visitor_entries record (created at picked_up) to mark arrival
    // Also notify buyer that rider is at gate
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

  // Log tracking
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
    .select('id, order_id, otp_hash, otp_expires_at, status')
    .eq('id', assignment_id)
    .single();

  if (!assignment) return jsonResponse({ error: 'Assignment not found' }, 404);
  if (!['picked_up', 'at_gate'].includes(assignment.status)) {
    return jsonResponse({ error: 'Assignment not in deliverable status' }, 400);
  }

  if (!assignment.otp_hash) return jsonResponse({ error: 'No OTP set for this delivery' }, 400);

  // Check OTP expiry
  if (assignment.otp_expires_at && new Date(assignment.otp_expires_at) < new Date()) {
    return jsonResponse({ error: 'OTP has expired' }, 400);
  }

  // Verify OTP
  const isValid = await verifyOTP(otp, assignment.otp_hash);
  if (!isValid) return jsonResponse({ error: 'Invalid OTP' }, 400);

  // Mark delivered
  const { error } = await db
    .from('delivery_assignments')
    .update({
      status: 'delivered',
      delivered_at: new Date().toISOString(),
      otp_hash: null, // Clear OTP
    })
    .eq('id', assignment_id);

  if (error) return jsonResponse({ error: error.message }, 500);

  // Update order status to delivered
  await db.from('orders').update({ status: 'delivered' }).eq('id', assignment.order_id);

  // Log tracking
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

// Handle 3PL webhooks
async function handleWebhook(req: Request, db: any) {
  // Placeholder for 3PL webhook handling
  // In production, validate webhook signature from 3PL provider
  const body = await req.json();
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

  // Map 3PL status to internal status
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

  // Log
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
  const orderId = url.searchParams.get('order_id');
  const orderValue = parseFloat(url.searchParams.get('order_value') || '0');
  const societyId = url.searchParams.get('society_id');

  // Simple fee calculation for v1
  // Base fee: ₹20, Free above ₹500
  const baseFee = 20;
  const freeThreshold = 500;

  if (orderValue >= freeThreshold) {
    return jsonResponse({ delivery_fee: 0, partner_payout: 0, platform_margin: 0, free_delivery: true });
  }

  const deliveryFee = baseFee;
  const partnerPayout = Math.round(deliveryFee * 0.7); // 70% to partner
  const platformMargin = deliveryFee - partnerPayout;

  return jsonResponse({ delivery_fee: deliveryFee, partner_payout: partnerPayout, platform_margin: platformMargin, free_delivery: false });
}
