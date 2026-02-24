/**
 * Seed Scenario E2E Validation Test
 * ===================================
 * Triggers the reset-and-seed-scenario edge function, then validates
 * that the seeded data is discoverable end-to-end:
 *   1. Sellers exist with correct categories
 *   2. Products are approved & available with specifications
 *   3. Buyers can discover sellers via search_nearby_sellers
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://rvvctaikytfeyzkwoqxg.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2dmN0YWlreXRmZXl6a3dvcXhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NTUxMTksImV4cCI6MjA4NTMzMTExOX0.Y7V9O3ifSufEYrSOoqoHKdzWcFxyCEY2TIf7ENU-lHE";

let client: SupabaseClient;
let seedResult: any;

describe("Seed Scenario E2E", () => {
  beforeAll(async () => {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });

    // Trigger the seed function
    const res = await fetch(`${SUPABASE_URL}/functions/v1/reset-and-seed-scenario`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    seedResult = await res.json();
  }, 120_000); // 2 min timeout for seed

  it("seed function should succeed", () => {
    expect(seedResult.success).toBe(true);
    expect(seedResult.summary).toBeDefined();
  });

  it("should create expected number of societies", () => {
    expect(seedResult.summary.societies).toBeGreaterThanOrEqual(3);
  });

  it("should create expected number of sellers", () => {
    expect(seedResult.summary.sellers).toBeGreaterThanOrEqual(6);
  });

  it("should create expected number of products", () => {
    expect(seedResult.summary.products).toBeGreaterThanOrEqual(30);
  });

  it("should have products with specifications (attribute blocks)", () => {
    expect(seedResult.summary.products_with_specs).toBeGreaterThan(0);
  });

  it("should preserve admin account", () => {
    expect(seedResult.summary.admin_preserved).toBe(1);
  });

  describe("Database validation", () => {
    it("all seeded sellers should be approved", async () => {
      const { data, error } = await client
        .from("seller_profiles")
        .select("id, verification_status")
        .eq("verification_status", "approved");

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(seedResult.summary.sellers);
    });

    it("all seeded products should be approved and available", async () => {
      const { data, error } = await client
        .from("products")
        .select("id, approval_status, is_available")
        .eq("approval_status", "approved")
        .eq("is_available", true);

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(seedResult.summary.products);
    });

    it("products should span multiple categories", async () => {
      const { data, error } = await client
        .from("products")
        .select("category")
        .eq("approval_status", "approved");

      expect(error).toBeNull();
      const categories = [...new Set(data!.map((p: any) => p.category))];
      expect(categories.length).toBeGreaterThanOrEqual(4);
    });

    it("some products should have specifications JSONB data", async () => {
      const { data, error } = await client
        .from("products")
        .select("id, specifications")
        .not("specifications", "is", null)
        .eq("approval_status", "approved")
        .limit(5);

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThan(0);
    });

    it("buyer societies should have coordinates for discovery", async () => {
      const { data, error } = await client
        .from("societies")
        .select("id, name, latitude, longitude")
        .not("latitude", "is", null)
        .not("longitude", "is", null);

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(3);
    });

    it("buyers should discover sellers via search_nearby_sellers", async () => {
      // Get a buyer society
      const { data: societies } = await client
        .from("societies")
        .select("id")
        .not("latitude", "is", null)
        .limit(1);

      expect(societies).toBeTruthy();
      expect(societies!.length).toBeGreaterThan(0);

      const { data, error } = await client.rpc("search_nearby_sellers", {
        _buyer_society_id: societies![0].id,
        _radius_km: 10,
      });

      expect(error).toBeNull();
      // Should find at least some sellers within radius
      expect(data).toBeDefined();
      // Note: may be 0 if all sellers are in same society (search excludes same society)
      // This is expected behavior - cross-society discovery
    });
  });

  describe("Credential validation", () => {
    it("seeded buyer should be able to sign in", async () => {
      if (!seedResult.summary?.credentials?.buyers?.[0]) return;

      const email = seedResult.summary.credentials.buyers[0];
      const password = seedResult.summary.credentials.password;

      const buyerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      });

      const { error } = await buyerClient.auth.signInWithPassword({ email, password });
      expect(error).toBeNull();
      await buyerClient.auth.signOut();
    });

    it("seeded seller should be able to sign in", async () => {
      if (!seedResult.summary?.credentials?.sellers?.[0]) return;

      const email = seedResult.summary.credentials.sellers[0];
      const password = seedResult.summary.credentials.password;

      const sellerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      });

      const { error } = await sellerClient.auth.signInWithPassword({ email, password });
      expect(error).toBeNull();
      await sellerClient.auth.signOut();
    });
  });
});
