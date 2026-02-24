/**
 * Integration Test Infrastructure
 * ================================
 * Provides authenticated Supabase clients for real DB integration tests.
 * Tests sign in as real users to verify RLS policies.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://rvvctaikytfeyzkwoqxg.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2dmN0YWlreXRmZXl6a3dvcXhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NTUxMTksImV4cCI6MjA4NTMzMTExOX0.Y7V9O3ifSufEYrSOoqoHKdzWcFxyCEY2TIf7ENU-lHE";

// ─── Test User Credentials ────────────────────────────────────────────
export const TEST_CREDENTIALS = {
  admin: { email: "integration-admin@test.sociva.com", password: "TestAdmin2026!" },
  seller: { email: "integration-seller@test.sociva.com", password: "TestSeller2026!" },
  buyer: { email: "integration-buyer@test.sociva.com", password: "TestBuyer2026!" },
  guard: { email: "integration-guard@test.sociva.com", password: "TestGuard2026!" },
} as const;

export type TestRole = keyof typeof TEST_CREDENTIALS;

// ─── Client Factory ───────────────────────────────────────────────────
/** Creates a fresh Supabase client (unauthenticated) with isolated storage */
let clientCounter = 0;
export function createTestClient(): SupabaseClient {
  clientCounter++;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
      storageKey: `test-client-${clientCounter}-${Date.now()}`,
    },
  });
}

/** Creates a Supabase client authenticated as the given role */
export async function createAuthenticatedClient(role: TestRole): Promise<SupabaseClient> {
  const client = createTestClient();
  const creds = TEST_CREDENTIALS[role];

  const { error } = await client.auth.signInWithPassword({
    email: creds.email,
    password: creds.password,
  });

  if (error) {
    throw new Error(
      `Failed to sign in as ${role} (${creds.email}): ${error.message}. ` +
        `Run the seed-integration-test-users edge function first.`
    );
  }

  return client;
}

/** Gets the current user ID from an authenticated client */
export async function getCurrentUserId(client: SupabaseClient): Promise<string> {
  const { data } = await client.auth.getUser();
  if (!data.user) throw new Error("No authenticated user");
  return data.user.id;
}

// ─── Seed Check ───────────────────────────────────────────────────────
/** Calls the seed edge function to ensure test users exist */
export async function ensureTestUsersSeeded(): Promise<{
  society_id: string;
  society_2_id: string;
  users: Record<string, { id: string; email: string; society_id: string }>;
}> {
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/seed-integration-test-users`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to seed test users: ${res.status} ${text}`);
  }

  return res.json();
}

// ─── Cleanup Helpers ──────────────────────────────────────────────────
/** Deletes rows created during a test (call in afterEach/afterAll) */
export async function cleanupRows(
  client: SupabaseClient,
  table: string,
  ids: string[]
): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await client.from(table).delete().in("id", ids);
  if (error) console.warn(`Cleanup warning (${table}):`, error.message);
}

/** Generates a unique test slug to avoid collisions between runs */
export function testSlug(prefix: string): string {
  return `${prefix}_test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Assertion Helpers ────────────────────────────────────────────────
/** Asserts that a Supabase query returned an error (RLS block) */
export function expectRLSBlock(error: any, context: string) {
  if (!error) {
    throw new Error(`Expected RLS block for: ${context}, but operation succeeded`);
  }
}

/** Asserts that a Supabase query succeeded */
export function expectSuccess(error: any, context: string) {
  if (error) {
    throw new Error(`Expected success for: ${context}, but got error: ${error.message}`);
  }
}
