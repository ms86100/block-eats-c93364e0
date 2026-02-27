import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-razorpay-signature',
};

async function getRazorpaySecret(supabase: any): Promise<string | null> {
  // First try to get from admin_settings table
  const { data: setting } = await supabase
    .from('admin_settings')
    .select('value, is_active')
    .eq('key', 'razorpay_key_secret')
    .single();

  if (setting?.value && setting.is_active) {
    return setting.value;
  }

  // Fallback to environment variable
  return Deno.env.get('RAZORPAY_KEY_SECRET') || null;
}

async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(body)
    );
    
    const expectedBytes = new Uint8Array(signatureBuffer);
    
    // Convert incoming hex signature to Uint8Array for constant-time comparison
    const sigBytes = new Uint8Array(signature.length / 2);
    for (let i = 0; i < signature.length; i += 2) {
      sigBytes[i / 2] = parseInt(signature.substring(i, i + 2), 16);
    }
    
    if (expectedBytes.length !== sigBytes.length) return false;
    
    // Constant-time comparison to prevent timing attacks
    let diff = 0;
    for (let i = 0; i < expectedBytes.length; i++) {
      diff |= expectedBytes[i] ^ sigBytes[i];
    }
    return diff === 0;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.text();
    const signature = req.headers.get('x-razorpay-signature');

    // Get Razorpay secret
    const razorpaySecret = await getRazorpaySecret(supabase);
    if (!razorpaySecret) {
      console.error('Razorpay secret not configured');
      return new Response(
        JSON.stringify({ error: 'Payment gateway not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify webhook signature — MANDATORY
    if (!signature) {
      console.error('Missing x-razorpay-signature header');
      return new Response(
        JSON.stringify({ error: 'Missing signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isValid = await verifySignature(body, signature, razorpaySecret);
    if (!isValid) {
      console.error('Invalid webhook signature');
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload = JSON.parse(body);
    const event = payload.event;
    const paymentEntity = payload.payload?.payment?.entity;

    console.log('Webhook event:', event);
    console.log('Payment entity:', paymentEntity);

    if (event === 'payment.captured') {
      const razorpayOrderId = paymentEntity.order_id;
      const razorpayPaymentId = paymentEntity.id;
      const razorpayEventId = payload.event_id || null;
      const orderId = paymentEntity.notes?.order_id;

      if (!orderId) {
        console.error('Order ID not found in payment notes');
        return new Response(
          JSON.stringify({ error: 'Order ID not found' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Duplicate webhook guard: check if this razorpay_payment_id was already processed
      const { data: existingPayment } = await supabase
        .from('payment_records')
        .select('id')
        .eq('razorpay_payment_id', razorpayPaymentId)
        .maybeSingle();

      if (existingPayment) {
        console.log(`Duplicate webhook for payment ${razorpayPaymentId}, skipping`);
        return new Response(
          JSON.stringify({ already_processed: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Payment captured for order ${orderId}`);

      // Update order status
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          razorpay_payment_id: razorpayPaymentId,
        })
        .eq('id', orderId);

      if (orderError) {
        console.error('Error updating order:', orderError);
        return new Response(
          JSON.stringify({ error: 'Failed to update order' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update payment record with razorpay_payment_id for dedup + event_id for replay protection
      const { error: paymentError } = await supabase
        .from('payment_records')
        .update({
          payment_status: 'paid',
          transaction_reference: razorpayPaymentId,
          razorpay_payment_id: razorpayPaymentId,
        })
        .eq('order_id', orderId);

      if (paymentError) {
        console.error('Error updating payment record:', paymentError);
      }

      console.log(`Order ${orderId} marked as paid`);
    } else if (event === 'payment.failed') {
      const orderId = paymentEntity.notes?.order_id;

      if (orderId) {
        console.log(`Payment failed for order ${orderId}`);
        
        await supabase
          .from('orders')
          .update({ payment_status: 'failed' })
          .eq('id', orderId);

        await supabase
          .from('payment_records')
          .update({ payment_status: 'failed' })
          .eq('order_id', orderId);
      }
    } else if (event === 'refund.created') {
      const orderId = paymentEntity.notes?.order_id;

      if (orderId) {
        console.log(`Refund created for order ${orderId}`);
        
        await supabase
          .from('orders')
          .update({ payment_status: 'refunded' })
          .eq('id', orderId);

        await supabase
          .from('payment_records')
          .update({ payment_status: 'refunded' })
          .eq('order_id', orderId);
      }
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
