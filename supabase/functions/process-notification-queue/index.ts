import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_RETRIES = 3;

// Exponential backoff: 30s, 2min, 8min
function getNextRetryAt(retryCount: number): string {
  const delayMs = Math.pow(4, retryCount) * 30000;
  return new Date(Date.now() + delayMs).toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Atomically claim pending notifications (prevents duplicate processing)
    const { data: pending, error: fetchError } = await supabase
      .rpc("claim_notification_queue", { batch_size: 50 });

    if (fetchError) {
      console.error("Error fetching queue:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pending || pending.length === 0) {
      return new Response(JSON.stringify({ processed: 0, retried: 0, dead_lettered: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing ${pending.length} queued notifications`);

    let processed = 0;
    let retried = 0;
    let deadLettered = 0;

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
          throw new Error(`DB insert failed: ${insertError.message}`);
        }

        // Try to send push notification and verify delivery
        let pushFailed = false;
        let pushErrorMsg = "";
        try {
          const { data: pushResult, error: pushError } = await supabase.functions.invoke("send-push-notification", {
            body: {
              userId: item.user_id,
              title: item.title,
              body: item.body,
              data: item.payload || {},
            },
          });

          if (pushError) {
            pushFailed = true;
            pushErrorMsg = `Push invoke error: ${pushError.message || String(pushError)}`;
            console.warn(`[Queue][${item.id}] ${pushErrorMsg}`);
          } else if (pushResult?.sent === 0) {
            pushFailed = true;
            pushErrorMsg = `Push sent=0, failed=${pushResult?.failed ?? '?'}: ${JSON.stringify(pushResult?.results ?? [])}`;
            console.warn(`[Queue][${item.id}] ${pushErrorMsg}`);
          } else {
            console.log(`[Queue][${item.id}] Push delivered: sent=${pushResult?.sent}`);
          }
        } catch (pushErr: any) {
          pushFailed = true;
          pushErrorMsg = `Push exception: ${pushErr?.message || String(pushErr)}`;
          console.warn(`[Queue][${item.id}] ${pushErrorMsg}`);
        }

        if (pushFailed) {
          // Push delivery failed — treat as retryable error (in-app notification already saved)
          throw new Error(pushErrorMsg);
        }

        // Mark as processed only when push actually delivered
        await supabase
          .from("notification_queue")
          .update({ status: "processed", processed_at: new Date().toISOString() })
          .eq("id", item.id);

        processed++;
      } catch (err: any) {
        const currentRetry = (item.retry_count || 0) + 1;
        const errorMsg = err?.message || String(err);

        if (currentRetry >= MAX_RETRIES) {
          // Dead-letter: max retries exceeded
          await supabase
            .from("notification_queue")
            .update({
              status: "failed",
              processed_at: new Date().toISOString(),
              retry_count: currentRetry,
              last_error: errorMsg,
            })
            .eq("id", item.id);
          deadLettered++;
          console.error(`Dead-lettered notification ${item.id} after ${MAX_RETRIES} retries: ${errorMsg}`);
        } else {
          // Schedule retry with exponential backoff
          await supabase
            .from("notification_queue")
            .update({
              status: "retrying",
              retry_count: currentRetry,
              last_error: errorMsg,
              next_retry_at: getNextRetryAt(currentRetry),
            })
            .eq("id", item.id);
          retried++;
          console.warn(`Scheduled retry ${currentRetry}/${MAX_RETRIES} for ${item.id}: ${errorMsg}`);
        }
      }
    }

    return new Response(
      JSON.stringify({ processed, retried, dead_lettered: deadLettered, total: pending.length }),
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