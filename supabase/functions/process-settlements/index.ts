import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Check if auto-settle is enabled
    const { data: autoSetting } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "auto_settle_enabled")
      .single();

    const autoEnabled = autoSetting?.value === "true";

    // Allow manual invocation even when auto is off (admin can pass force=true)
    let force = false;
    try {
      const body = await req.json();
      force = body?.force === true;
    } catch {
      // No body is fine
    }

    if (!autoEnabled && !force) {
      return new Response(
        JSON.stringify({ processed: 0, message: "Auto-settle is disabled. Pass force=true to override." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Fetch eligible settlements where cooldown has passed
    const { data: eligibleSettlements, error: fetchErr } = await supabase
      .from("seller_settlements")
      .select("id, order_id, seller_id, net_amount, settlement_status")
      .eq("settlement_status", "pending")
      .lte("eligible_at", new Date().toISOString());

    if (fetchErr) throw fetchErr;

    if (!eligibleSettlements || eligibleSettlements.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: "No eligible settlements" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let processed = 0;
    const errors: { id: string; error: string }[] = [];

    for (const settlement of eligibleSettlements) {
      // 3. Verify delivery/completion is confirmed
      // DEFECT 5 FIX: For self-pickup or seller-delivery orders, check order status instead of delivery_assignments
      const { data: orderData } = await supabase
        .from("orders")
        .select("status, fulfillment_type, delivery_handled_by")
        .eq("id", settlement.order_id)
        .single();

      const isNonPlatformDelivery = orderData?.fulfillment_type === 'self_pickup' ||
        (orderData?.delivery_handled_by !== 'platform');

      if (isNonPlatformDelivery) {
        // For self-pickup / seller-delivery: order must be completed or delivered
        if (!orderData || !['delivered', 'completed'].includes(orderData.status)) {
          errors.push({ id: settlement.id, error: "Order not completed" });
          continue;
        }
      } else {
        // For platform delivery: check delivery_assignments
        const { data: delivery } = await supabase
          .from("delivery_assignments")
          .select("status")
          .eq("order_id", settlement.order_id)
          .single();

        if (delivery?.status !== "delivered") {
          errors.push({ id: settlement.id, error: "Delivery not confirmed" });
          continue;
        }
      }

      // 4. Verify payment is confirmed
      const { data: payment } = await supabase
        .from("payment_records")
        .select("payment_status")
        .eq("order_id", settlement.order_id)
        .limit(1)
        .single();

      if (payment?.payment_status !== "paid") {
        errors.push({ id: settlement.id, error: "Payment not confirmed" });
        continue;
      }

      // 5. Mark as eligible first (trigger allows this)
      const { error: eligibleErr } = await supabase
        .from("seller_settlements")
        .update({ settlement_status: "eligible" })
        .eq("id", settlement.id);

      if (eligibleErr) {
        errors.push({ id: settlement.id, error: eligibleErr.message });
        continue;
      }

      // 6. Mark as processing -> settled
      // In production, this is where Razorpay Route transfer would happen
      // For now, we just mark it as settled
      const { error: settleErr } = await supabase
        .from("seller_settlements")
        .update({
          settlement_status: "processing",
        })
        .eq("id", settlement.id);

      if (settleErr) {
        errors.push({ id: settlement.id, error: settleErr.message });
        continue;
      }

      // TODO: Integrate Razorpay Route transfer here
      // const transferResult = await initiateRazorpayTransfer(settlement);

      const { error: finalErr } = await supabase
        .from("seller_settlements")
        .update({
          settlement_status: "settled",
          settled_at: new Date().toISOString(),
        })
        .eq("id", settlement.id);

      if (finalErr) {
        errors.push({ id: settlement.id, error: finalErr.message });
        continue;
      }

      // 7. Log to audit_log
      await supabase.from("audit_log").insert({
        actor_id: null,
        action: "settlement_processed",
        target_type: "seller_settlements",
        target_id: settlement.id,
        society_id: null,
        metadata: {
          order_id: settlement.order_id,
          seller_id: settlement.seller_id,
          net_amount: settlement.net_amount,
        },
      });

      processed++;
    }

    return new Response(
      JSON.stringify({ processed, errors, total_eligible: eligibleSettlements.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
