import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the user's JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { society_id, new_society } = body;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Handle new society creation
    if (new_society && typeof new_society === "object") {
      const { name, slug, address, city, state, pincode, latitude, longitude } = new_society;

      if (!name || !slug) {
        return new Response(
          JSON.stringify({ error: "new_society requires name and slug" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: created, error: createError } = await adminClient
        .from("societies")
        .insert({
          name,
          slug,
          address: address || null,
          city: city || null,
          state: state || null,
          pincode: pincode || null,
          latitude: latitude || null,
          longitude: longitude || null,
          is_verified: false,
          is_active: true,
        })
        .select("id, name, is_active, is_verified")
        .single();

      if (createError) {
        console.error("Society creation error:", createError);
        return new Response(
          JSON.stringify({ error: "Failed to create society: " + createError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update user profile and metadata with new society
      await adminClient.from("profiles").update({ society_id: created.id }).eq("id", user.id);
      await adminClient.auth.admin.updateUserById(user.id, {
        user_metadata: { society_id: created.id },
      });

      return new Response(
        JSON.stringify({
          valid: true,
          society: {
            id: created.id,
            name: created.name,
            is_active: created.is_active,
            is_verified: created.is_verified,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle existing society validation
    if (!society_id || typeof society_id !== "string") {
      return new Response(
        JSON.stringify({ error: "society_id or new_society is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(society_id)) {
      return new Response(
        JSON.stringify({ error: "Invalid society_id format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: society, error: societyError } = await adminClient
      .from("societies")
      .select("id, name, is_active, is_verified")
      .eq("id", society_id)
      .single();

    if (societyError || !society) {
      return new Response(
        JSON.stringify({ error: "Society not found", valid: false }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: updateError } = await adminClient
      .from("profiles")
      .update({ society_id })
      .eq("id", user.id);

    if (updateError) {
      console.error("Profile update error:", updateError);
    }

    const { error: metaError } = await adminClient.auth.admin.updateUserById(user.id, {
      user_metadata: { society_id },
    });

    if (metaError) {
      console.error("Metadata update error:", metaError);
    }

    return new Response(
      JSON.stringify({
        valid: true,
        society: {
          id: society.id,
          name: society.name,
          is_active: society.is_active,
          is_verified: society.is_verified,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
