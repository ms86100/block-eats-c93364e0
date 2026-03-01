import { useEffect, useState, useCallback, useContext, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';
import { IdentityContext } from '@/contexts/auth/contexts';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { hapticNotification } from '@/lib/haptics';

type RegistrationState = 'idle' | 'registering' | 'registered' | 'permission_denied' | 'failed';

const MAX_RETRIES = 3;
const WATCHDOG_TIMEOUT_MS = 5000;

/**
 * Reject 64-char hex strings on iOS — these are raw APNs tokens, not FCM.
 * FCM tokens are typically 100-200+ chars and contain colons or mixed case.
 */
function isValidFcmToken(token: string, platform: string): boolean {
  if (platform === 'ios' && /^[A-Fa-f0-9]{64}$/.test(token)) {
    return false;
  }
  // Basic sanity: FCM tokens are long strings
  return token.length > 20;
}

export function usePushNotifications() {
  const [token, setToken] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const identity = useContext(IdentityContext);
  const user = identity?.user ?? null;
  const navigate = useNavigate();

  const userRef = useRef(user);
  userRef.current = user;

  // ── State machine refs (in-memory only) ──
  const registrationStateRef = useRef<RegistrationState>('idle');
  const retryCountRef = useRef(0);
  const watchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastErrorRef = useRef<unknown>(null);
  const tokenRef = useRef<string | null>(null);

  // Keep tokenRef in sync
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  // ── Helpers ──
  const clearWatchdog = useCallback(() => {
    if (watchdogTimerRef.current !== null) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
  }, []);

  const emitDiagnostic = useCallback(() => {
    console.error('[Push][DIAG] Registration permanently failed', {
      userId: userRef.current?.id ?? 'unknown',
      platform: Capacitor.getPlatform(),
      permissionStatus,
      retriesAttempted: retryCountRef.current,
      lastError: lastErrorRef.current,
      timestamp: new Date().toISOString(),
    });
  }, [permissionStatus]);

  const markFailed = useCallback(() => {
    registrationStateRef.current = 'failed';
    clearWatchdog();
    emitDiagnostic();
  }, [clearWatchdog, emitDiagnostic]);

  // ── Token persistence ──
  const saveTokenToDatabase = useCallback(async (pushToken: string) => {
    const currentUser = userRef.current;
    console.log('[Push] saveTokenToDatabase called, user:', currentUser?.id ?? 'null', 'token:', pushToken.substring(0, 20) + '…');

    if (!currentUser) {
      console.warn('[Push] No user at token-save time — will retry when user is ready');
      return false;
    }

    const platform = Capacitor.getPlatform() as 'ios' | 'android' | 'web';

    try {
      const { error, data } = await supabase
        .from('device_tokens')
        .upsert(
          {
            user_id: currentUser.id,
            token: pushToken,
            platform,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,token' }
        )
        .select();

      if (error) {
        console.error('[Push] Token save FAILED:', error.message, error.code, error.details);
        return false;
      }
      console.log('[Push] Token saved successfully:', data);
      return true;
    } catch (err) {
      console.error('[Push] Token save exception:', err);
      return false;
    }
  }, []);

  const removeTokenFromDatabase = useCallback(async () => {
    if (!user || !token) return;

    try {
      const { error } = await supabase
        .from('device_tokens')
        .delete()
        .eq('user_id', user.id)
        .eq('token', token);

      if (error) {
        console.error('[Push] Error removing push token:', error);
      }
    } catch (err) {
      console.error('[Push] Failed to remove push token:', err);
    }
  }, [user, token]);

  // ── Core registration with state machine ──
  const attemptRegistration = useCallback(async () => {
    const state = registrationStateRef.current;

    // Terminal states → no-op
    if (state === 'registered' || state === 'failed' || state === 'permission_denied') {
      console.log(`[Push] attemptRegistration skipped — state: ${state}`);
      return;
    }

    registrationStateRef.current = 'registering';
    const attempt = retryCountRef.current + 1;
    console.log(`[Push] attemptRegistration — attempt ${attempt}/${MAX_RETRIES}, platform: ${Capacitor.getPlatform()}`);

    if (!Capacitor.isNativePlatform()) {
      console.log('[Push] Skipping — not a native platform');
      registrationStateRef.current = 'idle';
      return;
    }

    try {
      let permStatus = await PushNotifications.checkPermissions();
      console.log('[Push] Current permission:', permStatus.receive);

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
        console.log('[Push] After request:', permStatus.receive);
      }

      if (permStatus.receive !== 'granted') {
        setPermissionStatus('denied');
        registrationStateRef.current = 'permission_denied';
        console.log('[Push] Permission denied — terminal state');
        return;
      }

      setPermissionStatus('granted');

      // Clear any previous watchdog
      clearWatchdog();

      console.log('[Push] Calling PushNotifications.register()…');
      await PushNotifications.register();
      console.log('[Push] register() completed — starting watchdog');

      // Start watchdog timer
      watchdogTimerRef.current = setTimeout(() => {
        watchdogTimerRef.current = null;

        // If token arrived while we waited, nothing to do
        if (registrationStateRef.current === 'registered') {
          return;
        }

        retryCountRef.current += 1;
        console.warn(`[Push] Watchdog expired — no token received (attempt ${retryCountRef.current}/${MAX_RETRIES})`);

        if (retryCountRef.current >= MAX_RETRIES) {
          markFailed();
        } else {
          // Reset to idle so attemptRegistration can run again
          registrationStateRef.current = 'idle';
          attemptRegistration();
        }
      }, WATCHDOG_TIMEOUT_MS);
    } catch (err) {
      console.error('[Push] Registration error:', err);
      lastErrorRef.current = err;
      markFailed();
    }
  }, [clearWatchdog, markFailed]);

  // ── Listeners + lifecycle ──
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // Registration success listener — wrapped in try/catch for crash safety
    const registrationListener = PushNotifications.addListener(
      'registration',
      async (registrationToken) => {
        try {
          const tokenValue = registrationToken?.value;
          if (!tokenValue || typeof tokenValue !== 'string' || tokenValue.length === 0) {
            console.error('[Push] registration event — invalid token:', registrationToken);
            return;
          }

          console.log('[Push] registration event — token:', tokenValue.substring(0, 20) + '…', 'length:', tokenValue.length);

          // Reject APNs hex tokens on iOS — wait for FCM token instead
          const currentPlatform = Capacitor.getPlatform();
          if (!isValidFcmToken(tokenValue, currentPlatform)) {
            console.warn(`[Push] Rejected non-FCM token (platform=${currentPlatform}, len=${tokenValue.length}) — waiting for FCM token`);
            return;
          }

          // Clear watchdog — we got a valid FCM token
          clearWatchdog();
          registrationStateRef.current = 'registered';
          retryCountRef.current = 0;

          setToken(tokenValue);
          tokenRef.current = tokenValue;

          const saved = await saveTokenToDatabase(tokenValue);
          if (!saved) {
            console.log('[Push] Token save deferred — will retry when user becomes available');
          }
        } catch (err) {
          console.error('[Push] registration listener exception:', err);
          // Don't crash — just log
        }
      }
    );

    // Registration error listener — hard failure, no retry
    const registrationErrorListener = PushNotifications.addListener(
      'registrationError',
      (error) => {
        try {
          console.error('[Push] registrationError:', JSON.stringify(error));
          lastErrorRef.current = error;
          markFailed();
        } catch (err) {
          console.error('[Push] registrationError listener exception:', err);
        }
      }
    );

    // ── Foreground notification: show toast + sound + haptic ──
    const notificationReceivedListener = PushNotifications.addListener(
      'pushNotificationReceived',
      (notification) => {
        try {
          console.log('[Push] Foreground notification received:', JSON.stringify(notification));

          hapticNotification('warning');

          try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            for (let i = 0; i < 3; i++) {
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.frequency.value = i % 2 === 0 ? 880 : 660;
              osc.type = 'square';
              const start = ctx.currentTime + i * 0.2;
              gain.gain.setValueAtTime(0.25, start);
              gain.gain.exponentialRampToValueAtTime(0.01, start + 0.18);
              osc.start(start);
              osc.stop(start + 0.2);
            }
            setTimeout(() => ctx.close().catch(() => {}), 1000);
          } catch (e) {
            console.warn('[Push] Sound failed:', e);
          }

          const title = notification.title || 'New Notification';
          const body = notification.body || '';
          const data = notification.data as Record<string, string> | undefined;

          toast(title, {
            description: body,
            duration: 10000,
            action: data?.orderId
              ? {
                  label: 'View',
                  onClick: () => navigate(`/orders/${data.orderId}`),
                }
              : undefined,
          });
        } catch (err) {
          console.error('[Push] pushNotificationReceived listener exception:', err);
        }
      }
    );

    // Action performed
    const notificationActionListener = PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (notification) => {
        try {
          console.log('[Push] Action performed:', JSON.stringify(notification));
          const data = notification.notification.data;
          if (data?.orderId) {
            navigate(`/orders/${data.orderId}`);
          } else if (data?.type === 'order') {
            navigate('/orders');
          }
        } catch (err) {
          console.error('[Push] pushNotificationActionPerformed listener exception:', err);
        }
      }
    );

    // ── Foreground resume retry (conditional) ──
    let appListenerCleanup: (() => void) | undefined;

    (async () => {
      try {
        const { App } = await import('@capacitor/app');
        const listener = await App.addListener('appStateChange', async ({ isActive }) => {
          try {
            if (!isActive) return;

            const state = registrationStateRef.current;
            console.log(`[Push] App resumed — regState: ${state}, token: ${tokenRef.current ? 'yes' : 'null'}, user: ${userRef.current?.id ?? 'null'}`);

            if (state === 'failed') return;

            if (state === 'permission_denied') {
              try {
                const permStatus = await PushNotifications.checkPermissions();
                if (permStatus.receive === 'granted') {
                  console.log('[Push] Permission now granted after resume — resetting state');
                  setPermissionStatus('granted');
                  registrationStateRef.current = 'idle';
                  retryCountRef.current = 0;
                  attemptRegistration();
                }
              } catch (e) {
                console.warn('[Push] Permission re-check failed:', e);
              }
              return;
            }

            if ((state === 'idle' || state === 'registering') && !tokenRef.current && userRef.current) {
              registrationStateRef.current = 'idle';
              attemptRegistration();
            }
          } catch (err) {
            console.error('[Push] appStateChange listener exception:', err);
          }
        });
        appListenerCleanup = () => listener.remove();
      } catch (err) {
        console.error('[Push] Failed to register appStateChange listener:', err);
      }
    })();

    // ── Trigger registration if user is ready ──
    if (user) {
      // Small delay to ensure native bridge is fully ready after app launch
      setTimeout(() => {
        attemptRegistration();
      }, 500);
    }

    return () => {
      clearWatchdog();
      registrationListener.then(l => l.remove()).catch(() => {});
      registrationErrorListener.then(l => l.remove()).catch(() => {});
      notificationReceivedListener.then(l => l.remove()).catch(() => {});
      notificationActionListener.then(l => l.remove()).catch(() => {});
      appListenerCleanup?.();
    };
  }, [user, attemptRegistration, saveTokenToDatabase, navigate, clearWatchdog, markFailed]);

  // ── Retry token save when user becomes available ──
  useEffect(() => {
    if (user && token) {
      console.log('[Push] User now available — retrying token save');
      saveTokenToDatabase(token);
    }
  }, [user, token, saveTokenToDatabase]);

  // ── Diagnostic: check if current user has any saved tokens ──
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('device_tokens')
          .select('id, token, platform, updated_at')
          .eq('user_id', user.id);
        if (error) {
          console.error('[Push][Diag] Error querying device_tokens:', error.message);
        } else {
          console.log(`[Push][Diag] User ${user.id} has ${data?.length || 0} registered token(s)`, data);
        }
      } catch (e) {
        console.error('[Push][Diag] Exception:', e);
      }
    })();
  }, [user]);

  return {
    token,
    permissionStatus,
    registerPushNotifications: attemptRegistration,
    removeTokenFromDatabase,
  };
}
