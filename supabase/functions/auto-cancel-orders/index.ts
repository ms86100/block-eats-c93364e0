import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const app = new Hono();

// Handle CORS preflight
app.options("*", (c) => {
  return c.json({}, 200, corsHeaders);
});

// Auto-cancel expired urgent orders
app.post("/", async (c) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find orders that have passed their auto_cancel_at time and are still in 'placed' status
    const now = new Date().toISOString();
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    // Query 1: Urgent orders past auto_cancel_at
    const { data: urgentExpired, error: urgentErr } = await supabase
      .from("orders")
      .select("id, buyer_id, seller_id, total_amount")
      .eq("status", "placed")
      .not("auto_cancel_at", "is", null)
      .lt("auto_cancel_at", now);

    // Query 2: Orphaned UPI/online orders — payment_status=pending, non-COD, older than 15 min
    const { data: orphanedUpi, error: orphanErr } = await supabase
      .from("orders")
      .select("id, buyer_id, seller_id, total_amount")
      .eq("status", "placed")
      .eq("payment_status", "pending")
      .neq("payment_method", "cod")
      .lt("created_at", fifteenMinAgo);

    const fetchError = urgentErr || orphanErr;
    const expiredOrders = [
      ...(urgentExpired || []),
      ...(orphanedUpi || []),
    ].filter((order, idx, arr) => arr.findIndex(o => o.id === order.id) === idx);

    if (fetchError) {
      console.error("Error fetching expired orders:", fetchError);
      return c.json({ error: fetchError.message }, 500, corsHeaders);
    }

    if (!expiredOrders || expiredOrders.length === 0) {
      console.log("No expired orders to cancel");
      return c.json({ message: "No expired orders", cancelled: 0 }, 200, corsHeaders);
    }

    console.log(`Found ${expiredOrders.length} expired orders to cancel`);

    // C9: Cancel all expired orders in parallel with Promise.allSettled
    const results = await Promise.allSettled(
      expiredOrders.map(async (order) => {
        const { error: updateError } = await supabase
          .from("orders")
          .update({
            status: "cancelled",
            rejection_reason: "Order automatically cancelled - seller did not respond within the time limit",
            updated_at: now,
          })
          .eq("id", order.id);

        if (updateError) {
          console.error(`Error cancelling order ${order.id}:`, updateError);
          throw { id: order.id, error: updateError.message };
        }
        console.log(`Order ${order.id} auto-cancelled`);
        return { id: order.id, success: true };
      })
    );

    const mapped = results.map((r) =>
      r.status === 'fulfilled' ? r.value : { id: (r.reason as any)?.id, success: false, error: (r.reason as any)?.error }
    );

    const successCount = mapped.filter((r) => r.success).length;
    return c.json(
      {
        message: `Processed ${expiredOrders.length} orders`,
        cancelled: successCount,
        results: mapped,
      },
      200,
      corsHeaders
    );
  } catch (error) {
    console.error("Error in auto-cancel function:", error);
    return c.json({ error: String(error) }, 500, corsHeaders);
  }
});

Deno.serve(app.fetch);
