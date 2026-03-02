import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PushPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

interface FirebaseServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

// Generate JWT for FCM HTTP v1 API authentication
async function generateAccessToken(serviceAccount: FirebaseServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600; // 1 hour expiry

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: serviceAccount.token_uri,
    iat: now,
    exp: exp,
  };

  // Encode header and payload
  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import private key and sign
  // Handle both real newlines and escaped \n from JSON secret storage
  const privateKeyPem = serviceAccount.private_key.replace(/\\n/g, "\n");
  const pemContents = privateKeyPem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\n/g, "")
    .replace(/\r/g, "")
    .trim();
  
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${unsignedToken}.${signatureB64}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch(serviceAccount.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    console.error(`[DIAG] Token exchange failed (${tokenResponse.status}): ${error}`);
    throw new Error(`Failed to get access token: ${error}`);
  }
  console.log("[DIAG] OAuth token exchange succeeded");

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

// Send push notification via FCM HTTP v1 API
async function sendFCMNotification(
  accessToken: string,
  projectId: string,
  deviceToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  console.log(`[DIAG] FCM URL: ${fcmUrl}, token prefix: ${deviceToken.substring(0, 20)}...`);

  const message: Record<string, unknown> = {
    message: {
      token: deviceToken,
      notification: {
        title,
        body,
      },
      data: data || {},
      // iOS specific configuration
      apns: {
        headers: {
          "apns-push-type": "alert",
          "apns-priority": "10",
        },
        payload: {
          aps: {
            alert: {
              title,
              body,
            },
            sound: "default",
            badge: 1,
          },
        },
      },
      // Android specific configuration
      android: {
        priority: "high",
        notification: {
          sound: "default",
        },
      },
    },
  };

  try {
    console.log(`[DIAG] Access token length: ${accessToken.length}, starts with: ${accessToken.substring(0, 20)}...`);
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
    console.log(`[DIAG] Auth header: Bearer ${accessToken.substring(0, 30)}...`);
    const response = await fetch(fcmUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(message),
    });

    const responseText = await response.text();

    if (!response.ok) {
      const errorText = responseText;
      console.error(`[DIAG] FCM error (${response.status}): ${errorText}`);
      let errorData: any;
      try { errorData = JSON.parse(errorText); } catch { errorData = { raw: errorText }; }
      
      // Check if token is invalid/expired
      if (
        errorData.error?.details?.some(
          (d: { errorCode?: string }) =>
            d.errorCode === "UNREGISTERED" || d.errorCode === "INVALID_ARGUMENT"
        )
      ) {
        return { success: false, error: "INVALID_TOKEN" };
      }
      
      return { success: false, error: JSON.stringify(errorData) };
    }

    console.log(`[DIAG] FCM success (${response.status}): ${responseText.substring(0, 300)}`);
    return { success: true };
  } catch (error) {
    console.error("FCM request failed:", error);
    return { success: false, error: String(error) };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // C3: Only allow service-role callers (internal edge functions)
    const authHeader = req.headers.get("Authorization");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!authHeader || authHeader !== `Bearer ${serviceRoleKey}`) {
      return new Response(
        JSON.stringify({ error: "Unauthorized — service role required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    if (!serviceAccountJson) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT not configured");
    }

    // Diagnostic: log first 30 chars to debug secret format issues
    console.log(`[DIAG] FIREBASE_SERVICE_ACCOUNT starts with: "${serviceAccountJson.substring(0, 30)}..." (length: ${serviceAccountJson.length})`);

    let serviceAccount: FirebaseServiceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch (parseErr) {
      console.error(`[DIAG] JSON.parse failed. Full value preview: "${serviceAccountJson.substring(0, 100)}"`);
      throw new Error(`FIREBASE_SERVICE_ACCOUNT is not valid JSON. Starts with: "${serviceAccountJson.substring(0, 30)}"`);
    }
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, title, body, data }: PushPayload = await req.json();

    if (!userId || !title || !body) {
      return new Response(
        JSON.stringify({ error: "userId, title, and body are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch device tokens for user
    const { data: tokens, error: tokensError } = await supabase
      .from("device_tokens")
      .select("id, token, platform")
      .eq("user_id", userId);

    if (tokensError) {
      throw new Error(`Failed to fetch tokens: ${tokensError.message}`);
    }

    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ message: "No device tokens found for user", sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate access token for FCM
    const accessToken = await generateAccessToken(serviceAccount);

    // Send to all device tokens
    const results = await Promise.all(
      tokens.map(async (tokenRecord) => {
        const result = await sendFCMNotification(
          accessToken,
          serviceAccount.project_id,
          tokenRecord.token,
          title,
          body,
          data
        );

        // Remove invalid tokens
        if (result.error === "INVALID_TOKEN") {
          await supabase
            .from("device_tokens")
            .delete()
            .eq("id", tokenRecord.id);
          console.log(`Removed invalid token: ${tokenRecord.id}`);
        }

        return { ...result, platform: tokenRecord.platform };
      })
    );

    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;

    return new Response(
      JSON.stringify({
        message: `Sent ${successCount} notifications, ${failedCount} failed`,
        sent: successCount,
        failed: failedCount,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Push notification error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
