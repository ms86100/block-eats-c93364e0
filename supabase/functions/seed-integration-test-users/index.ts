import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Creates dedicated integration-test users with known credentials.
 * Uses service_role to auto-confirm and create profiles.
 * Idempotent — skips if users already exist.
 */
const TEST_USERS = [
  {
    email: "integration-admin@test.sociva.com",
    password: "TestAdmin2026!",
    name: "Integration Admin",
    flat_number: "ADMIN-01",
    block: "Admin Block",
    role: "admin",
  },
  {
    email: "integration-seller@test.sociva.com",
    password: "TestSeller2026!",
    name: "Integration Seller",
    flat_number: "S-101",
    block: "Tower A",
    role: "seller",
  },
  {
    email: "integration-buyer@test.sociva.com",
    password: "TestBuyer2026!",
    name: "Integration Buyer",
    flat_number: "B-204",
    block: "Tower C",
    role: "buyer",
  },
  {
    email: "integration-guard@test.sociva.com",
    password: "TestGuard2026!",
    name: "Integration Guard",
    flat_number: "G-001",
    block: "Gate Block",
    role: "guard",
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get or create a test society
    let societyId: string;
    const { data: existingSociety } = await supabase
      .from("societies")
      .select("id")
      .eq("name", "Integration Test Society")
      .single();

    if (existingSociety) {
      societyId = existingSociety.id;
    } else {
      const { data: newSociety, error: socErr } = await supabase
        .from("societies")
        .insert({
          name: "Integration Test Society",
          slug: "integration-test-society",
          address: "123 Test Lane, Bangalore",
          latitude: 13.035,
          longitude: 77.65,
          is_active: true,
          security_mode: "basic",
        })
        .select("id")
        .single();

      if (socErr) throw socErr;
      societyId = newSociety!.id;
    }

    // Create a second society for cross-society tests
    let society2Id: string;
    const { data: existingSociety2 } = await supabase
      .from("societies")
      .select("id")
      .eq("name", "Integration Test Society 2")
      .single();

    if (existingSociety2) {
      society2Id = existingSociety2.id;
    } else {
      const { data: newSociety2, error: soc2Err } = await supabase
        .from("societies")
        .insert({
          name: "Integration Test Society 2",
          slug: "integration-test-society-2",
          address: "456 Test Ave, Bangalore",
          latitude: 13.037,
          longitude: 77.652,
          is_active: true,
          security_mode: "basic",
        })
        .select("id")
        .single();

      if (soc2Err) throw soc2Err;
      society2Id = newSociety2!.id;
    }

    const results: Record<string, { id: string; email: string; society_id: string; created: boolean }> = {};

    for (const user of TEST_USERS) {
      // Check if user already exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existing = existingUsers?.users?.find((u: any) => u.email === user.email);

      if (existing) {
        results[user.role] = { id: existing.id, email: user.email, society_id: user.role === "buyer" ? society2Id : societyId, created: false };
        continue;
      }

      // Create user with auto-confirm
      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
      });

      if (authErr) throw authErr;
      const userId = authData.user!.id;
      const userSociety = user.role === "buyer" ? society2Id : societyId;

      // Create profile
      const { error: profileErr } = await supabase.from("profiles").insert({
        id: userId,
        name: user.name,
        email: user.email,
        flat_number: user.flat_number,
        block: user.block,
        society_id: userSociety,
        verification_status: "approved",
        phone: "9876543210",
      });

      if (profileErr) {
        console.error(`Profile error for ${user.email}:`, profileErr);
      }

      // Grant admin role if needed
      if (user.role === "admin") {
        await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
      }

      // Make guard a security officer
      if (user.role === "guard") {
        await supabase.from("security_staff").insert({
          user_id: userId,
          society_id: societyId,
          is_active: true,
        });
      }

      results[user.role] = { id: userId, email: user.email, society_id: userSociety, created: true };
    }

    return new Response(
      JSON.stringify({
        success: true,
        society_id: societyId,
        society_2_id: society2Id,
        users: results,
        credentials: TEST_USERS.map((u) => ({ email: u.email, password: u.password, role: u.role })),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
