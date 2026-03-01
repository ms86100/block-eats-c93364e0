import { useEffect, useState, useCallback, useContext, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';
import { IdentityContext } from '@/contexts/auth/contexts';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { hapticNotification } from '@/lib/haptics';
import { getPushStage, setPushStage } from '@/lib/pushPermissionStage';

type RegistrationState = 'idle' | 'registering' | 'registered' | 'permission_denied' | 'failed';

const MAX_RETRIES = 3;
const WATCHDOG_TIMEOUT_MS = 8000; // Slightly longer for Firebase token exchange

/**
 * Reject 64-char hex strings on iOS — these are raw APNs tokens, not FCM.
 * FCM tokens are typically 100-200+ chars and contain colons or mixed case.
 */
function isValidFcmToken(token: string, platform: string): boolean {
  if (platform === 'ios' && /^[A-Fa-f0-9]{64}$/.test(token)) {
    return false;
  }
  return token.length > 20;
}

/**
 * Dynamically import @capacitor-firebase/messaging for iOS.
 * Returns null on non-iOS or if the plugin is unavailable.
 */
async function getFirebaseMessaging() {
  try {
    const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
    return FirebaseMessaging;
  } catch (e) {
    console.warn('[Push] @capacitor-firebase/messaging not available:', e);
    return null;
  }
}

export function usePushNotifications() {
  const [token, setToken] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const identity = useContext(IdentityContext);
  const user = identity?.user ?? null;
  const navigate = useNavigate();

  // Log on every render so we can trace in native Console.app
  console.log('[Push][INIT] usePushNotifications render — platform:', Capacitor.getPlatform(), 'isNative:', Capacitor.isNativePlatform(), 'userId:', user?.id ?? 'null');

  const userRef = useRef(user);
  userRef.current = user;

  const registrationStateRef = useRef<RegistrationState>('idle');
  const retryCountRef = useRef(0);
  const watchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastErrorRef = useRef<unknown>(null);
  const tokenRef = useRef<string | null>(null);

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

  // Use a ref for permissionStatus inside emitDiagnostic to break the
  // dependency cascade: permissionStatus → emitDiagnostic → markFailed →
  // attemptIosRegistration → attemptRegistration → useEffect teardown.
  const permissionStatusRef = useRef(permissionStatus);
  permissionStatusRef.current = permissionStatus;

  const emitDiagnostic = useCallback(() => {
    console.error('[Push][DIAG] Registration permanently failed', {
      userId: userRef.current?.id ?? 'unknown',
      platform: Capacitor.getPlatform(),
      permissionStatus: permissionStatusRef.current,
      retriesAttempted: retryCountRef.current,
      lastError: lastErrorRef.current,
      timestamp: new Date().toISOString(),
    });
  }, []); // No dependency on permissionStatus — read from ref instead

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

  // C2: Use refs to capture userId/token before logout nullifies them
  const userIdForCleanupRef = useRef<string | null>(null);
  useEffect(() => {
    if (user?.id) userIdForCleanupRef.current = user.id;
  }, [user?.id]);

  const removeTokenFromDatabase = useCallback(async () => {
    const uid = userIdForCleanupRef.current;
    const tok = tokenRef.current;
    if (!uid || !tok) return;

    try {
      const { error } = await supabase
        .from('device_tokens')
        .delete()
        .eq('user_id', uid)
        .eq('token', tok);

      if (error) {
        console.error('[Push] Error removing push token:', error);
      } else {
        console.log('[Push] Token removed for user:', uid);
      }
    } catch (err) {
      console.error('[Push] Failed to remove push token:', err);
    }
  }, []);

  // ── Handle a valid token (shared by iOS Firebase path and Android path) ──
  const handleValidToken = useCallback(async (tokenValue: string) => {
    clearWatchdog();
    registrationStateRef.current = 'registered';
    retryCountRef.current = 0;

    setToken(tokenValue);
    tokenRef.current = tokenValue;

    const saved = await saveTokenToDatabase(tokenValue);
    if (!saved) {
      console.log('[Push] Token save deferred — will retry when user becomes available');
    }
  }, [clearWatchdog, saveTokenToDatabase]);

  // ── iOS registration via @capacitor-firebase/messaging ──
  const attemptIosRegistration = useCallback(async () => {
    const FirebaseMessaging = await getFirebaseMessaging();
    if (!FirebaseMessaging) {
      console.error('[Push] FirebaseMessaging plugin not available on iOS — cannot get FCM token');
      markFailed();
      return;
    }

    try {
      // Step 1: force native OS permission flow (ensures iOS Settings → Notifications appears)
      let nativePerm = await PushNotifications.checkPermissions();
      console.log('[Push][iOS] Native permission:', nativePerm.receive);

      if (nativePerm.receive === 'prompt') {
        nativePerm = await PushNotifications.requestPermissions();
        console.log('[Push][iOS] Native permission after request:', nativePerm.receive);
      }

      if (nativePerm.receive !== 'granted') {
        setPermissionStatus('denied');
        registrationStateRef.current = 'permission_denied';
        console.log('[Push][iOS] Native permission denied — terminal state');
        return;
      }

      setPermissionStatus('granted');

      // Step 2: register with APNs explicitly (extra reliability on iOS)
      try {
        await PushNotifications.register();
        console.log('[Push][iOS] PushNotifications.register() completed');
      } catch (registerErr) {
        // Do not hard-fail here; tokenReceived/getToken may still succeed.
        console.warn('[Push][iOS] PushNotifications.register() warning:', registerErr);
      }

      // Step 3: read FCM token from Firebase Messaging
      console.log('[Push][iOS] Getting FCM token via FirebaseMessaging.getToken()…');
      const result = await FirebaseMessaging.getToken();
      const fcmToken = result.token;

      console.log('[Push][iOS] FCM token received:', fcmToken.substring(0, 20) + '…', 'length:', fcmToken.length);

      if (!isValidFcmToken(fcmToken, 'ios')) {
        console.warn('[Push][iOS] Token failed FCM validation — rejecting');
        markFailed();
        return;
      }

      await handleValidToken(fcmToken);
    } catch (err) {
      console.error('[Push][iOS] Registration error:', err);
      lastErrorRef.current = err;
      markFailed();
    }
  }, [markFailed, handleValidToken]);

  // ── Android/Web registration via @capacitor/push-notifications ──
  const attemptAndroidRegistration = useCallback(async () => {
    try {
      let permStatus = await PushNotifications.checkPermissions();
      console.log('[Push][Android] Current permission:', permStatus.receive);

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
        console.log('[Push][Android] After request:', permStatus.receive);
      }

      if (permStatus.receive !== 'granted') {
        setPermissionStatus('denied');
        registrationStateRef.current = 'permission_denied';
        console.log('[Push][Android] Permission denied — terminal state');
        return;
      }

      setPermissionStatus('granted');
      clearWatchdog();

      console.log('[Push][Android] Calling PushNotifications.register()…');
      await PushNotifications.register();
      console.log('[Push][Android] register() completed — starting watchdog');

      // Start watchdog timer
      watchdogTimerRef.current = setTimeout(() => {
        watchdogTimerRef.current = null;

        if (registrationStateRef.current === 'registered') return;

        retryCountRef.current += 1;
        console.warn(`[Push][Android] Watchdog expired — no token (attempt ${retryCountRef.current}/${MAX_RETRIES})`);

        if (retryCountRef.current >= MAX_RETRIES) {
          markFailed();
        } else {
          registrationStateRef.current = 'idle';
          attemptRegistration();
        }
      }, WATCHDOG_TIMEOUT_MS);
    } catch (err) {
      console.error('[Push][Android] Registration error:', err);
      lastErrorRef.current = err;
      markFailed();
    }
  }, [clearWatchdog, markFailed]);

  // ── Core registration dispatcher ──
  const attemptRegistration = useCallback(async () => {
    const state = registrationStateRef.current;

    if (state === 'registered' || state === 'failed' || state === 'permission_denied') {
      console.log(`[Push] attemptRegistration skipped — state: ${state}`);
      return;
    }

    registrationStateRef.current = 'registering';
    const attempt = retryCountRef.current + 1;
    const platform = Capacitor.getPlatform();
    console.log(`[Push] attemptRegistration — attempt ${attempt}/${MAX_RETRIES}, platform: ${platform}`);

    if (!Capacitor.isNativePlatform()) {
      console.log('[Push] Skipping — not a native platform');
      registrationStateRef.current = 'idle';
      return;
    }

    // iOS: use @capacitor-firebase/messaging for direct FCM token
    // Android: use @capacitor/push-notifications (already returns FCM tokens)
    if (platform === 'ios') {
      await attemptIosRegistration();
    } else {
      await attemptAndroidRegistration();
    }
  }, [attemptIosRegistration, attemptAndroidRegistration]);

  // ── Listeners + lifecycle ──
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const platform = Capacitor.getPlatform();
    const cleanups: (() => void)[] = [];

    // ── iOS: listen for token refresh via FirebaseMessaging ──
    if (platform === 'ios') {
      (async () => {
        try {
          const FirebaseMessaging = await getFirebaseMessaging();
          if (FirebaseMessaging) {
            const tokenListener = await FirebaseMessaging.addListener('tokenReceived', async (event) => {
              try {
                const tokenValue = event.token;
                console.log('[Push][iOS] tokenReceived event:', tokenValue.substring(0, 20) + '…', 'length:', tokenValue.length);

                if (!isValidFcmToken(tokenValue, 'ios')) {
                  console.warn('[Push][iOS] Refreshed token failed validation — ignoring');
                  return;
                }

                await handleValidToken(tokenValue);
              } catch (err) {
                console.error('[Push][iOS] tokenReceived listener exception:', err);
              }
            });
            cleanups.push(() => tokenListener.remove());
          }
        } catch (err) {
          console.error('[Push][iOS] Failed to set up tokenReceived listener:', err);
        }
      })();
    }

    // ── Android: listen for 'registration' event from PushNotifications ──
    if (platform === 'android') {
      const registrationListener = PushNotifications.addListener(
        'registration',
        async (registrationToken) => {
          try {
            const tokenValue = registrationToken?.value;
            if (!tokenValue || typeof tokenValue !== 'string' || tokenValue.length === 0) {
              console.error('[Push][Android] registration event — invalid token:', registrationToken);
              return;
            }

            console.log('[Push][Android] registration event — token:', tokenValue.substring(0, 20) + '…', 'length:', tokenValue.length);

            if (!isValidFcmToken(tokenValue, 'android')) {
              console.warn('[Push][Android] Token failed validation — ignoring');
              return;
            }

            await handleValidToken(tokenValue);
          } catch (err) {
            console.error('[Push][Android] registration listener exception:', err);
          }
        }
      );
      cleanups.push(() => { registrationListener.then(l => l.remove()).catch(() => {}); });

      const registrationErrorListener = PushNotifications.addListener(
        'registrationError',
        (error) => {
          try {
            console.error('[Push][Android] registrationError:', JSON.stringify(error));
            lastErrorRef.current = error;
            markFailed();
          } catch (err) {
            console.error('[Push][Android] registrationError listener exception:', err);
          }
        }
      );
      cleanups.push(() => { registrationErrorListener.then(l => l.remove()).catch(() => {}); });
    }

    // ── Foreground notification: show toast + sound + haptic (both platforms) ──
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
    cleanups.push(() => { notificationReceivedListener.then(l => l.remove()).catch(() => {}); });

    // Action performed (both platforms)
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
    cleanups.push(() => { notificationActionListener.then(l => l.remove()).catch(() => {}); });

    // ── Foreground resume retry ──
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

    // ── Provisional strategy: on first login, defer the prompt ──
    // Only auto-attempt registration if we're already in 'full' stage.
    // If stage is 'none' or 'deferred', just set up listeners (no permission prompt).
    if (user) {
      setTimeout(async () => {
        const stage = await getPushStage();
        console.log(`[Push] Push stage: ${stage}`);

        if (stage === 'none') {
          // First login — mark as deferred, don't prompt
          await setPushStage('deferred');
          console.log('[Push] First login — deferred push prompt until first order');
          return;
        }

        if (stage === 'full') {
          // User has been through the full prompt flow before — register normally
          attemptRegistration();
        }
        // 'deferred' — do nothing, wait for explicit trigger (first order)
      }, 500);
    }

    return () => {
      clearWatchdog();
      cleanups.forEach(fn => fn());
      appListenerCleanup?.();
    };
  }, [user, attemptRegistration, handleValidToken, navigate, clearWatchdog, markFailed]);

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

  /**
   * Explicitly request full notification permission (call on first order).
   * Upgrades stage from 'deferred' → 'full' and triggers the OS prompt.
   */
  const requestFullPermission = useCallback(async () => {
    console.log('[Push] requestFullPermission called — upgrading to full stage');
    await setPushStage('full');
    registrationStateRef.current = 'idle';
    retryCountRef.current = 0;
    await attemptRegistration();
  }, [attemptRegistration]);

  return {
    token,
    permissionStatus,
    registerPushNotifications: attemptRegistration,
    requestFullPermission,
    removeTokenFromDatabase,
  };
}
