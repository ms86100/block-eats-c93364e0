import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

/**
 * Shared rate limiter for edge functions.
 * Uses the rate_limits table with service role access.
 * 
 * @param key - Unique key for the rate limit (e.g., `user:${userId}:create-order`)
 * @param maxRequests - Maximum requests allowed in the window
 * @param windowSeconds - Time window in seconds
 * @returns { allowed: boolean, remaining: number }
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const now = new Date();
  const windowStart = new Date(now.getTime() - windowSeconds * 1000);

  // Try to get existing rate limit entry
  const { data: existing } = await supabase
    .from("rate_limits")
    .select("*")
    .eq("key", key)
    .single();

  if (existing) {
    const existingWindowStart = new Date(existing.window_start);
    
    if (existingWindowStart < windowStart) {
      // Window expired, reset
      await supabase
        .from("rate_limits")
        .update({ count: 1, window_start: now.toISOString() })
        .eq("key", key);
      
      return { allowed: true, remaining: maxRequests - 1 };
    }

    if (existing.count >= maxRequests) {
      return { allowed: false, remaining: 0 };
    }

    // Increment count
    await supabase
      .from("rate_limits")
      .update({ count: existing.count + 1 })
      .eq("key", key);

    return { allowed: true, remaining: maxRequests - existing.count - 1 };
  }

  // No existing entry, create one
  await supabase
    .from("rate_limits")
    .upsert({ key, count: 1, window_start: now.toISOString() }, { onConflict: "key" });

  return { allowed: true, remaining: maxRequests - 1 };
}

/**
 * Returns a 429 Too Many Requests response
 */
export function rateLimitResponse(corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({ error: "Too many requests. Please try again later." }),
    {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
