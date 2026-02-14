import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch pending notifications (batch of 50)
    const { data: pending, error: fetchError } = await supabase
      .from("notification_queue")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error("Error fetching queue:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pending || pending.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing ${pending.length} queued notifications`);

    let processed = 0;
    let failed = 0;

    for (const item of pending) {
      try {
        // Insert into user_notifications
        const { error: insertError } = await supabase
          .from("user_notifications")
          .insert({
            user_id: item.user_id,
            title: item.title,
            body: item.body,
            type: item.type,
            reference_path: item.reference_path,
          });

        if (insertError) {
          console.error(`Failed to insert notification for ${item.id}:`, insertError);
          failed++;
          continue;
        }

        // Try to send push notification
        try {
          await supabase.functions.invoke("send-push-notification", {
            body: {
              userId: item.user_id,
              title: item.title,
              body: item.body,
              data: item.payload || {},
            },
          });
        } catch (pushErr) {
          // Push failure is non-critical; notification is already in DB
          console.warn(`Push notification failed for ${item.id}:`, pushErr);
        }

        // Mark as processed
        await supabase
          .from("notification_queue")
          .update({ status: "processed", processed_at: new Date().toISOString() })
          .eq("id", item.id);

        processed++;
      } catch (err) {
        console.error(`Error processing notification ${item.id}:`, err);
        // Mark as failed
        await supabase
          .from("notification_queue")
          .update({ status: "failed", processed_at: new Date().toISOString() })
          .eq("id", item.id);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ processed, failed, total: pending.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in process-notification-queue:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
