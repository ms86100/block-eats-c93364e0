import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateOrderRequest {
  orderId: string;
  amount: number;
  sellerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

async function getRazorpayKeys(supabase: any): Promise<{ keyId: string; keySecret: string } | null> {
  const { data: settings } = await supabase
    .from('admin_settings')
    .select('key, value, is_active')
    .in('key', ['razorpay_key_id', 'razorpay_key_secret']);

  if (settings && settings.length === 2) {
    const keyIdSetting = settings.find((s: any) => s.key === 'razorpay_key_id');
    const keySecretSetting = settings.find((s: any) => s.key === 'razorpay_key_secret');

    if (keyIdSetting?.value && keySecretSetting?.value && keyIdSetting.is_active && keySecretSetting.is_active) {
      return { keyId: keyIdSetting.value, keySecret: keySecretSetting.value };
    }
  }

  const envKeyId = Deno.env.get('RAZORPAY_KEY_ID');
  const envKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

  if (envKeyId && envKeySecret) {
    return { keyId: envKeyId, keySecret: envKeySecret };
  }

  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const razorpayKeys = await getRazorpayKeys(supabase);
    if (!razorpayKeys) {
      console.error('Razorpay keys not configured');
      return new Response(
        JSON.stringify({ error: 'Payment gateway not configured. Please contact admin.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // C7: Use anon-key client for auth validation (service role bypasses JWT verification)
    const { withAuth } = await import("../_shared/auth.ts");
    const authResult = await withAuth(req, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const user = { id: authResult.userId };

    // Phase 2: Rate limit — 10/min
    const { allowed } = await checkRateLimit(`order:${user.id}`, 10, 60);
    if (!allowed) return rateLimitResponse(corsHeaders);

    const body: CreateOrderRequest = await req.json();
    const { orderId, amount, sellerId, customerName, customerEmail, customerPhone } = body;

    console.log('Creating Razorpay order:', { orderId, amount, sellerId });

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('buyer_id', user.id)
      .single();

    if (orderError || !order) {
      console.error('Order not found or unauthorized:', orderError);
      return new Response(
        JSON.stringify({ error: 'Order not found or you are not authorized' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: seller } = await supabase
      .from('seller_profiles')
      .select('razorpay_account_id, business_name')
      .eq('id', sellerId)
      .single();

    const razorpayAuth = btoa(`${razorpayKeys.keyId}:${razorpayKeys.keySecret}`);
    
    const orderPayload: any = {
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: orderId,
      notes: {
        order_id: orderId,
        seller_id: sellerId,
        buyer_id: user.id,
      },
    };

    if (seller?.razorpay_account_id) {
      orderPayload.transfers = [
        {
          account: seller.razorpay_account_id,
          amount: Math.round(amount * 100),
          currency: 'INR',
          notes: { order_id: orderId, type: 'seller_payout' },
          on_hold: 0,
        },
      ];
    }

    console.log('Razorpay order payload:', orderPayload);

    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${razorpayAuth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    });

    if (!razorpayResponse.ok) {
      const errorText = await razorpayResponse.text();
      console.error('Razorpay error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to create payment order', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const razorpayOrder = await razorpayResponse.json();
    console.log('Razorpay order created:', razorpayOrder.id);

    await supabase
      .from('orders')
      .update({ razorpay_order_id: razorpayOrder.id })
      .eq('id', orderId);

    return new Response(
      JSON.stringify({
        razorpay_order_id: razorpayOrder.id,
        razorpay_key_id: razorpayKeys.keyId,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        prefill: { name: customerName, email: customerEmail, contact: customerPhone },
        notes: razorpayOrder.notes,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error creating order:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
