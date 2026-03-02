import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

export interface DiagnosticResult {
  step: string;
  ok: boolean;
  detail: string;
}

/**
 * Run a full diagnostic check of the push notification chain.
 * Tests: platform → plugin load → permission → FCM (iOS) → DB tokens → edge fn.
 */
export async function runPushDiagnostics(userId?: string): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];
  const platform = Capacitor.getPlatform();

  // 1. Platform check
  const isNative = Capacitor.isNativePlatform();
  results.push({
    step: '1. Platform',
    ok: isNative,
    detail: isNative ? `Native (${platform})` : `Web — push not supported`,
  });
  if (!isNative) return results;

  // 2. PushNotifications plugin
  let PN: any = null;
  try {
    const mod = await import('@capacitor/push-notifications');
    PN = mod.PushNotifications;
    results.push({ step: '2. PushNotifications plugin', ok: true, detail: 'Loaded' });
  } catch (e) {
    results.push({ step: '2. PushNotifications plugin', ok: false, detail: String(e) });
    return results;
  }

  // 3. Permission status
  try {
    const perm = await PN.checkPermissions();
    const granted = perm.receive === 'granted';
    results.push({
      step: '3. Permission',
      ok: granted,
      detail: `receive: ${perm.receive}`,
    });
  } catch (e) {
    results.push({ step: '3. Permission', ok: false, detail: String(e) });
  }

  // 4. FCM plugin (iOS only)
  if (platform === 'ios') {
    try {
      const { FCM } = await import('@capacitor-community/fcm');
      results.push({ step: '4. FCM plugin (iOS)', ok: true, detail: 'Loaded' });

      // 5. FCM.getToken()
      try {
        const result = await FCM.getToken();
        const tok = result.token;
        const valid = tok && tok.length > 20 && !/^[A-Fa-f0-9]{64}$/.test(tok);
        results.push({
          step: '5. FCM.getToken() (iOS)',
          ok: !!valid,
          detail: valid
            ? `Token: ${tok.substring(0, 20)}… (${tok.length} chars)`
            : `Invalid or APNs-like: ${tok?.substring(0, 20) ?? 'null'}`,
        });
      } catch (e) {
        results.push({ step: '5. FCM.getToken() (iOS)', ok: false, detail: String(e) });
      }
    } catch (e) {
      results.push({ step: '4. FCM plugin (iOS)', ok: false, detail: String(e) });
    }
  }

  // 6. device_tokens in DB
  if (userId) {
    try {
      const { data, error } = await supabase
        .from('device_tokens')
        .select('id, token, platform, updated_at')
        .eq('user_id', userId);
      if (error) throw error;
      const count = data?.length ?? 0;
      results.push({
        step: '6. device_tokens in DB',
        ok: count > 0,
        detail: `${count} token(s) found${count > 0 ? ` — latest: ${data![0].platform}` : ''}`,
      });
    } catch (e) {
      results.push({ step: '6. device_tokens in DB', ok: false, detail: String(e) });
    }
  } else {
    results.push({ step: '6. device_tokens in DB', ok: false, detail: 'No userId provided — skipped' });
  }

  // 7. Edge function test
  if (userId) {
    try {
      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          userId,
          title: '🔔 Push Diagnostics',
          body: 'If you see this, push notifications are working!',
          data: { type: 'diagnostic' },
        },
      });
      if (error) throw error;
      const sent = data?.sent ?? 0;
      results.push({
        step: '7. Edge function test send',
        ok: sent > 0,
        detail: `sent: ${sent}, failed: ${data?.failed ?? 0}`,
      });
    } catch (e) {
      results.push({ step: '7. Edge function test send', ok: false, detail: String(e) });
    }
  } else {
    results.push({ step: '7. Edge function test send', ok: false, detail: 'No userId — skipped' });
  }

  return results;
}

/** Pretty-print diagnostics to console. */
export function printDiagnostics(results: DiagnosticResult[]): void {
  console.group('🔔 Push Notification Diagnostics');
  for (const r of results) {
    const icon = r.ok ? '✅' : '❌';
    console.log(`${icon} ${r.step}: ${r.detail}`);
  }
  console.groupEnd();
}
