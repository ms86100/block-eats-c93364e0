import { useEffect, useState, useCallback, useContext, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';
import { IdentityContext } from '@/contexts/auth/contexts';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { hapticNotification } from '@/lib/haptics';
import { getPushStage, setPushStage } from '@/lib/pushPermissionStage';

/**
 * Registration states:
 * - idle: not yet attempted
 * - registering: in progress
 * - registered: token obtained and saved
 * - failed: exhausted retries (but NOT due to permission — retryable on resume)
 *
 * IMPORTANT: We no longer have a terminal 'permission_denied' state.
 * If permission is not granted, we stay 'idle' so future attempts (resume, user CTA) can retry.
 */
type RegistrationState = 'idle' | 'registering' | 'registered' | 'failed';

const MAX_RETRIES = 3;
const WATCHDOG_TIMEOUT_MS = 8000;

/**
 * Reject 64-char hex strings on iOS — these are raw APNs tokens, not FCM.
 */
function isValidFcmToken(token: string, platform: string): boolean {
  if (platform === 'ios' && /^[A-Fa-f0-9]{64}$/.test(token)) {
    return false;
  }
  return token.length > 20;
}

async function getFirebaseMessaging() {
  try {
    const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
    return FirebaseMessaging;
  } catch (e) {
    console.warn('[Push] @capacitor-firebase/messaging not available:', e);
    return null;
  }
}

// Module-level singleton guard — prevents duplicate registration effects
let activeInstanceId = 0;

/**
 * INTERNAL: Full hook with all side effects. Only called by PushNotificationProvider.
 * All other consumers should use usePushNotifications() from PushNotificationContext.
 */
export function usePushNotificationsInternal() {
  const [token, setToken] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const identity = useContext(IdentityContext);
  const user = identity?.user ?? null;
  const navigate = useNavigate();

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

  const permissionStatusRef = useRef(permissionStatus);
  permissionStatusRef.current = permissionStatus;

  const emitDiagnostic = useCallback(() => {
    console.error('[Push][DIAG] Registration failed after retries', {
      userId: userRef.current?.id ?? 'unknown',
      platform: Capacitor.getPlatform(),
      permissionStatus: permissionStatusRef.current,
      retriesAttempted: retryCountRef.current,
      lastError: lastErrorRef.current,
      timestamp: new Date().toISOString(),
    });
  }, []);

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

  // ── Handle a valid token ──
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
      console.error('[Push][iOS] FirebaseMessaging plugin not available — cannot get FCM token');
      markFailed();
      return;
    }

    try {
      // Step 1: check native OS permission
      let nativePerm = await PushNotifications.checkPermissions();
      console.log('[Push][iOS] ▶ checkPermissions result:', nativePerm.receive);

      if (nativePerm.receive === 'prompt') {
        console.log('[Push][iOS] ▶ Calling requestPermissions()…');
        nativePerm = await PushNotifications.requestPermissions();
        console.log('[Push][iOS] ▶ requestPermissions result:', nativePerm.receive);
      }

      // FIX A: Do NOT set terminal state on non-granted.
      // If user explicitly denied, update UI status but stay 'idle' so CTA/resume can retry.
      if (nativePerm.receive !== 'granted') {
        const isDenied = nativePerm.receive === 'denied';
        setPermissionStatus(isDenied ? 'denied' : 'prompt');
        registrationStateRef.current = 'idle'; // NOT terminal — allows retry
        console.log(`[Push][iOS] Permission not granted (${nativePerm.receive}) — staying idle for retry`);
        return;
      }

      setPermissionStatus('granted');

      // Step 2: register with APNs
      try {
        console.log('[Push][iOS] ▶ Calling PushNotifications.register()…');
        await PushNotifications.register();
        console.log('[Push][iOS] ✓ PushNotifications.register() completed');
      } catch (registerErr) {
        console.warn('[Push][iOS] PushNotifications.register() warning:', registerErr);
      }

      // Step 3: get FCM token
      console.log('[Push][iOS] ▶ Calling FirebaseMessaging.getToken()…');
      const result = await FirebaseMessaging.getToken();
      const fcmToken = result.token;
      console.log('[Push][iOS] ✓ FCM token received:', fcmToken.substring(0, 20) + '…', 'length:', fcmToken.length);

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

  // ── Android registration ──
  const attemptAndroidRegistration = useCallback(async () => {
    try {
      let permStatus = await PushNotifications.checkPermissions();
      console.log('[Push][Android] ▶ checkPermissions:', permStatus.receive);

      if (permStatus.receive === 'prompt') {
        console.log('[Push][Android] ▶ Calling requestPermissions()…');
        permStatus = await PushNotifications.requestPermissions();
        console.log('[Push][Android] ▶ requestPermissions result:', permStatus.receive);
      }

      // FIX A: Same non-terminal treatment for Android
      if (permStatus.receive !== 'granted') {
        const isDenied = permStatus.receive === 'denied';
        setPermissionStatus(isDenied ? 'denied' : 'prompt');
        registrationStateRef.current = 'idle';
        console.log(`[Push][Android] Permission not granted (${permStatus.receive}) — staying idle`);
        return;
      }

      setPermissionStatus('granted');
      clearWatchdog();

      console.log('[Push][Android] ▶ Calling PushNotifications.register()…');
      await PushNotifications.register();
      console.log('[Push][Android] ✓ register() completed — starting watchdog');

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
  // FIX A: Only skip if already 'registered'. 'failed' can be retried via explicit CTA.
  const attemptRegistration = useCallback(async () => {
    const state = registrationStateRef.current;

    if (state === 'registered') {
      console.log('[Push] attemptRegistration skipped — already registered');
      return;
    }

    // Allow retry from 'failed' state (explicit user action or resume)
    if (state === 'registering') {
      console.log('[Push] attemptRegistration skipped — already in progress');
      return;
    }

    registrationStateRef.current = 'registering';
    const attempt = retryCountRef.current + 1;
    const platform = Capacitor.getPlatform();
    console.log(`[Push] ▶ attemptRegistration — attempt ${attempt}/${MAX_RETRIES}, platform: ${platform}`);

    if (!Capacitor.isNativePlatform()) {
      console.log('[Push] Skipping — not a native platform');
      registrationStateRef.current = 'idle';
      return;
    }

    if (platform === 'ios') {
      await attemptIosRegistration();
    } else {
      await attemptAndroidRegistration();
    }
  }, [attemptIosRegistration, attemptAndroidRegistration]);

  // ── Listeners + lifecycle ──
  useEffect(() => {
    // Module-level singleton guard — only one instance may run effects
    const myId = ++activeInstanceId;
    if (myId !== activeInstanceId) {
      console.warn('[Push] Duplicate instance detected — skipping effects');
      return;
    }
    console.log('[Push] Effect owner instance:', myId);

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

    // ── Android: listen for 'registration' event ──
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

    // ── Foreground notification ──
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
    cleanups.push(() => { notificationActionListener.then(l => l.remove()).catch(() => {}); });

    // ── App resume: re-check permission and retry if now granted ──
    let appListenerCleanup: (() => void) | undefined;

    (async () => {
      try {
        const { App } = await import('@capacitor/app');
        const listener = await App.addListener('appStateChange', async ({ isActive }) => {
          try {
            if (!isActive) return;

            const state = registrationStateRef.current;
            console.log(`[Push] App resumed — regState: ${state}, token: ${tokenRef.current ? 'yes' : 'null'}, user: ${userRef.current?.id ?? 'null'}`);

            // If already registered, nothing to do
            if (state === 'registered') return;

            // On resume, always re-check permission — user may have toggled in Settings
            const permStatus = await PushNotifications.checkPermissions();
            console.log(`[Push] Resume permission check: ${permStatus.receive}`);

            if (permStatus.receive === 'granted' && userRef.current) {
              setPermissionStatus('granted');
              registrationStateRef.current = 'idle';
              retryCountRef.current = 0;
              console.log('[Push] Permission granted on resume — attempting registration');
              attemptRegistration();
            } else if (permStatus.receive === 'denied') {
              setPermissionStatus('denied');
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

    // ── FIX B: Do NOT auto-prompt on login. Only set up listeners. ──
    // The OS permission prompt is triggered ONLY from:
    //   1. EnableNotificationsBanner CTA (user taps "Turn On")
    //   2. requestFullPermission() called after first order
    // This avoids iOS timing suppression during early app lifecycle.
    if (user) {
      setTimeout(async () => {
        const stage = await getPushStage();
        console.log(`[Push] Push stage on login: ${stage}`);

        // Only silently re-register if user previously granted permission
        if (stage === 'full') {
          const permCheck = await PushNotifications.checkPermissions();
          if (permCheck.receive === 'granted') {
            console.log('[Push] Stage full + permission granted — silent re-registration');
            registrationStateRef.current = 'idle';
            retryCountRef.current = 0;
            attemptRegistration();
          } else {
            console.log(`[Push] Stage full but permission ${permCheck.receive} — waiting for user action`);
            setPermissionStatus(permCheck.receive === 'denied' ? 'denied' : 'prompt');
          }
        } else {
          console.log(`[Push] Stage '${stage}' — waiting for user to tap Enable banner`);
        }
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

  // ── Diagnostic ──
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
   * FIX B: Explicitly request full notification permission.
   * Called from NotificationsPage CTA or after first order.
   * This is the ONLY path that triggers the iOS permission popup.
   */
  const requestFullPermission = useCallback(async () => {
    console.log('[Push] ▶ requestFullPermission called — upgrading to full stage');

    // Call OS prompt IMMEDIATELY to preserve user-gesture context (iOS requirement)
    if (!Capacitor.isNativePlatform()) {
      console.log('[Push] Not native — skipping');
      return;
    }

    // Watchdog: if the entire flow takes >10s, bail out so UI doesn't hang
    const timeout = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('requestFullPermission timed out after 10s')), 10000)
    );

    const doRegister = async () => {
      // Step 1: Request permission from OS right away (preserves gesture context)
      let permStatus = await PushNotifications.checkPermissions();
      console.log('[Push] requestFullPermission checkPermissions:', permStatus.receive);

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
        console.log('[Push] requestFullPermission requestPermissions result:', permStatus.receive);
      }

      if (permStatus.receive !== 'granted') {
        setPermissionStatus(permStatus.receive === 'denied' ? 'denied' : 'prompt');
        console.log('[Push] Permission not granted — aborting');
        return;
      }

      setPermissionStatus('granted');

      // Step 2: Now persist stage and do full registration
      await setPushStage('full');
      registrationStateRef.current = 'idle';
      retryCountRef.current = 0;
      await attemptRegistration();
    };

    try {
      await Promise.race([doRegister(), timeout]);
    } catch (err) {
      console.error('[Push] requestFullPermission error/timeout:', err);
      // Reset state so button becomes clickable again
      registrationStateRef.current = 'idle';
    }
  }, [attemptRegistration]);

  return {
    token,
    permissionStatus,
    registerPushNotifications: attemptRegistration,
    requestFullPermission,
    removeTokenFromDatabase,
  };
}
