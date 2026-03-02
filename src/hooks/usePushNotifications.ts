import { useEffect, useState, useCallback, useContext, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { IdentityContext } from '@/contexts/auth/contexts';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { hapticNotification } from '@/lib/haptics';
import { getPushStage, setPushStage } from '@/lib/pushPermissionStage';

/**
 * NEW APPROACH: Uses @capacitor/push-notifications for permissions + registration
 * on BOTH platforms, then @capacitor-community/fcm to get the FCM token on iOS.
 * 
 * Flow:
 *   PushNotifications.requestPermissions() → PushNotifications.register()
 *   Android: 'registration' event gives FCM token directly
 *   iOS: 'registration' event gives APNs token → FCM.getToken() converts to FCM token
 * 
 * This avoids the Firebase method-swizzling issue that prevented the OS prompt.
 */

type RegistrationState = 'idle' | 'registering' | 'registered' | 'failed';

const MAX_RETRIES = 3;
const WATCHDOG_TIMEOUT_MS = 20000;

/**
 * Reject 64-char hex strings on iOS — these are raw APNs tokens, not FCM.
 */
function isValidFcmToken(token: string, platform: string): boolean {
  if (platform === 'ios' && /^[A-Fa-f0-9]{64}$/.test(token)) {
    return false;
  }
  return token.length > 20;
}

async function getPushNotificationsPlugin() {
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    return PushNotifications;
  } catch (e) {
    console.warn('[Push] @capacitor/push-notifications not available:', e);
    return null;
  }
}

async function getFcmPlugin() {
  try {
    const { FCM } = await import('@capacitor-community/fcm');
    return FCM;
  } catch (e) {
    console.warn('[Push] @capacitor-community/fcm not available:', e);
    return null;
  }
}

// Module-level singleton guard
let activeInstanceId = 0;

/**
 * INTERNAL: Full hook with all side effects. Only called by PushNotificationProvider.
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
      const { error } = await supabase
        .from('device_tokens')
        .upsert(
          {
            user_id: currentUser.id,
            token: pushToken,
            platform,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,token' }
        );

      if (error) {
        console.error('[Push] Token upsert FAILED:', error.message, error.code, error.details);
        console.log('[Push] Attempting fallback INSERT…');
        const { error: insertErr } = await supabase
          .from('device_tokens')
          .insert({
            user_id: currentUser.id,
            token: pushToken,
            platform,
            updated_at: new Date().toISOString(),
          });
        if (insertErr) {
          if (insertErr.code === '23505') {
            console.log('[Push] Token already exists (unique constraint) — OK');
            return true;
          }
          console.error('[Push] Fallback INSERT also failed:', insertErr.message, insertErr.code);
          return false;
        }
        console.log('[Push] Token saved via fallback INSERT');
        return true;
      }
      console.log('[Push] Token saved successfully via upsert');
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

  // ── Unified registration (both platforms use PushNotifications) ──
  const attemptRegistration = useCallback(async () => {
    const state = registrationStateRef.current;

    if (state === 'registered') {
      console.log('[Push] attemptRegistration skipped — already registered');
      return;
    }
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

    const PN = await getPushNotificationsPlugin();
    if (!PN) { markFailed(); return; }

    try {
      let permStatus = await PN.checkPermissions();
      console.log(`[Push][${platform}] ▶ checkPermissions:`, permStatus.receive);

      if (permStatus.receive === 'prompt') {
        console.log(`[Push][${platform}] ▶ Calling requestPermissions()…`);
        permStatus = await PN.requestPermissions();
        console.log(`[Push][${platform}] ▶ requestPermissions result:`, permStatus.receive);
      }

      if (permStatus.receive !== 'granted') {
        const isDenied = permStatus.receive === 'denied';
        setPermissionStatus(isDenied ? 'denied' : 'prompt');
        registrationStateRef.current = 'idle';
        console.log(`[Push][${platform}] Permission not granted (${permStatus.receive}) — staying idle`);
        return;
      }

      setPermissionStatus('granted');
      clearWatchdog();

      console.log(`[Push][${platform}] ▶ Calling PushNotifications.register()…`);
      await PN.register();
      console.log(`[Push][${platform}] ✓ register() completed — starting watchdog`);

      // Start watchdog for token arrival
      watchdogTimerRef.current = setTimeout(() => {
        watchdogTimerRef.current = null;
        if (registrationStateRef.current === 'registered') return;

        retryCountRef.current += 1;
        console.warn(`[Push][${platform}] Watchdog expired — no token (attempt ${retryCountRef.current}/${MAX_RETRIES})`);

        if (retryCountRef.current >= MAX_RETRIES) {
          markFailed();
        } else {
          registrationStateRef.current = 'idle';
          attemptRegistration();
        }
      }, WATCHDOG_TIMEOUT_MS);
    } catch (err) {
      console.error(`[Push][${platform}] Registration error:`, err);
      lastErrorRef.current = err;
      markFailed();
    }
  }, [clearWatchdog, markFailed]);

  // ── Foreground notification handler (shared logic) ──
  const handleForegroundNotification = useCallback((title: string, body: string, data?: Record<string, string>) => {
    console.log('[Push] Foreground notification:', title, body);
    hapticNotification('warning');

    // Play sound
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

    toast(title || 'New Notification', {
      description: body || '',
      duration: 10000,
      action: data?.orderId
        ? { label: 'View', onClick: () => navigate(`/orders/${data.orderId}`) }
        : undefined,
    });
  }, [navigate]);

  // ── Handle notification tap (shared logic) ──
  const handleNotificationAction = useCallback((data?: Record<string, string>) => {
    if (data?.orderId) {
      navigate(`/orders/${data.orderId}`);
    } else if (data?.type === 'order') {
      navigate('/orders');
    }
  }, [navigate]);

  // ── Listeners + lifecycle ──
  useEffect(() => {
    const myId = ++activeInstanceId;
    if (myId !== activeInstanceId) {
      console.warn('[Push] Duplicate instance detected — skipping effects');
      return;
    }
    console.log('[Push] Effect owner instance:', myId);

    if (!Capacitor.isNativePlatform()) return;

    const platform = Capacitor.getPlatform();
    const cleanups: (() => void)[] = [];

    (async () => {
      const PN = await getPushNotificationsPlugin();
      if (!PN) return;

      // ── Registration event ──
      // Android: gives FCM token directly
      // iOS: gives APNs token → we convert via FCM.getToken()
      const registrationListener = PN.addListener('registration', async (registrationToken) => {
        try {
          const rawToken = registrationToken?.value;
          if (!rawToken || typeof rawToken !== 'string' || rawToken.length === 0) {
            console.error(`[Push][${platform}] registration event — invalid token:`, registrationToken);
            return;
          }

          console.log(`[Push][${platform}] registration event — raw token:`, rawToken.substring(0, 20) + '…', 'length:', rawToken.length);

          if (platform === 'ios') {
            // On iOS, the 'registration' event gives us the APNs token.
            // We need to use @capacitor-community/fcm to get the FCM token.
            console.log('[Push][iOS] APNs token received — converting to FCM token via FCM.getToken()…');
            const fcm = await getFcmPlugin();
            if (!fcm) {
              console.error('[Push][iOS] @capacitor-community/fcm not available — cannot convert token');
              markFailed();
              return;
            }
            const fcmResult = await fcm.getToken();
            const fcmToken = fcmResult.token;
            console.log('[Push][iOS] ✓ FCM token:', fcmToken.substring(0, 20) + '…', 'length:', fcmToken.length);

            if (!isValidFcmToken(fcmToken, 'ios')) {
              console.warn('[Push][iOS] FCM token failed validation — rejecting');
              markFailed();
              return;
            }

            await handleValidToken(fcmToken);
          } else {
            // Android: registration event already provides FCM token
            if (!isValidFcmToken(rawToken, 'android')) {
              console.warn('[Push][Android] Token failed validation — ignoring');
              return;
            }
            await handleValidToken(rawToken);
          }
        } catch (err) {
          console.error(`[Push][${platform}] registration listener exception:`, err);
        }
      });
      cleanups.push(() => { registrationListener.then(l => l.remove()).catch(() => {}); });

      // ── Registration error ──
      const registrationErrorListener = PN.addListener('registrationError', (error) => {
        try {
          console.error(`[Push][${platform}] registrationError:`, JSON.stringify(error));
          lastErrorRef.current = error;
          markFailed();
        } catch (err) {
          console.error(`[Push][${platform}] registrationError listener exception:`, err);
        }
      });
      cleanups.push(() => { registrationErrorListener.then(l => l.remove()).catch(() => {}); });

      // ── Foreground notification ──
      const fgListener = PN.addListener('pushNotificationReceived', (notification) => {
        try {
          console.log(`[Push][${platform}] Foreground notification received:`, JSON.stringify(notification));
          const data = notification.data as Record<string, string> | undefined;
          handleForegroundNotification(notification.title || '', notification.body || '', data);
        } catch (err) {
          console.error(`[Push][${platform}] pushNotificationReceived listener exception:`, err);
        }
      });
      cleanups.push(() => { fgListener.then(l => l.remove()).catch(() => {}); });

      // ── Action performed (notification tap) ──
      const actionListener = PN.addListener('pushNotificationActionPerformed', (notification) => {
        try {
          console.log(`[Push][${platform}] Action performed:`, JSON.stringify(notification));
          const data = notification.notification.data as Record<string, string> | undefined;
          handleNotificationAction(data);
        } catch (err) {
          console.error(`[Push][${platform}] pushNotificationActionPerformed listener exception:`, err);
        }
      });
      cleanups.push(() => { actionListener.then(l => l.remove()).catch(() => {}); });
    })();

    // ── iOS: also listen for FCM token refresh ──
    if (platform === 'ios') {
      (async () => {
        try {
          const fcm = await getFcmPlugin();
          if (fcm && typeof (fcm as any).addListener === 'function') {
            // @capacitor-community/fcm doesn't have a built-in token refresh listener,
            // but Firebase will re-deliver via the registration event path.
            console.log('[Push][iOS] FCM plugin ready for token conversion');
          }
        } catch (err) {
          console.warn('[Push][iOS] FCM plugin setup note:', err);
        }
      })();
    }

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

            if (state === 'registered') return;

            // Unified permission check via PushNotifications (both platforms)
            const PN = await getPushNotificationsPlugin();
            let resumePermission = 'prompt';
            if (PN) {
              const p = await PN.checkPermissions();
              resumePermission = p.receive;
            }
            console.log(`[Push] Resume permission check: ${resumePermission}`);

            if (resumePermission === 'granted' && userRef.current) {
              setPermissionStatus('granted');
              registrationStateRef.current = 'idle';
              retryCountRef.current = 0;
              console.log('[Push] Permission granted on resume — attempting registration');
              attemptRegistration();
            } else if (resumePermission === 'denied') {
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

    // ── Do NOT auto-prompt on login. Only set up listeners. ──
    if (user) {
      setTimeout(async () => {
        const stage = await getPushStage();
        console.log(`[Push] Push stage on login: ${stage}`);

        if (stage === 'full') {
          const PN = await getPushNotificationsPlugin();
          let loginPerm = 'prompt';
          if (PN) {
            const p = await PN.checkPermissions();
            loginPerm = p.receive;
          }
          if (loginPerm === 'granted') {
            console.log('[Push] Stage full + permission granted — silent re-registration');
            registrationStateRef.current = 'idle';
            retryCountRef.current = 0;
            attemptRegistration();
          } else {
            console.log(`[Push] Stage full but permission ${loginPerm} — waiting for user action`);
            setPermissionStatus(loginPerm === 'denied' ? 'denied' : 'prompt');
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
  }, [user, attemptRegistration, handleValidToken, handleForegroundNotification, handleNotificationAction, navigate, clearWatchdog, markFailed]);

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
   * Explicitly request full notification permission.
   * Called from NotificationsPage CTA or after first order.
   * Uses PushNotifications for the OS prompt (both platforms).
   */
  const requestFullPermission = useCallback(async () => {
    console.log('[Push] ▶▶▶ requestFullPermission called — upgrading to full stage');

    if (!Capacitor.isNativePlatform()) {
      console.log('[Push] Not native — skipping');
      return;
    }

    const platform = Capacitor.getPlatform();

    const timeout = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('requestFullPermission timed out after 20s')), 20000)
    );

    const doRegister = async () => {
      const PN = await getPushNotificationsPlugin();
      if (!PN) {
        console.error('[Push] ✗ PushNotifications plugin not available');
        setPermissionStatus('denied');
        return;
      }

      // Step 1: Check current permission before requesting
      let permStatus = await PN.checkPermissions();
      console.log(`[Push] requestFullPermission (${platform}) BEFORE checkPermissions:`, permStatus.receive);

      if (permStatus.receive === 'prompt') {
        console.log(`[Push] requestFullPermission (${platform}) ▶ Calling requestPermissions() NOW — OS prompt should appear`);
        permStatus = await PN.requestPermissions();
        console.log(`[Push] requestFullPermission (${platform}) AFTER requestPermissions:`, permStatus.receive);
      }

      // Step 2: Re-check to confirm (guards against silent no-op)
      const recheck = await PN.checkPermissions();
      console.log(`[Push] requestFullPermission (${platform}) RE-CHECK:`, recheck.receive);

      const finalStatus = recheck.receive;

      if (finalStatus !== 'granted') {
        // Permission was NOT granted — either denied or still prompt (silent fail)
        const isDenied = finalStatus === 'denied';
        setPermissionStatus(isDenied ? 'denied' : 'prompt');
        console.log(`[Push] ✗ Permission not granted after request. Final: ${finalStatus}`);
        
        if (!isDenied) {
          // Still 'prompt' after requesting = OS prompt never appeared (plugin conflict)
          console.error('[Push] ✗✗✗ CRITICAL: Permission still "prompt" after requestPermissions() — OS prompt likely suppressed');
        }
        return;
      }

      setPermissionStatus('granted');
      await setPushStage('full');
      console.log(`[Push] ✓ Permission granted — triggering register()`);

      // Trigger registration — token will arrive via the 'registration' listener
      registrationStateRef.current = 'idle';
      retryCountRef.current = 0;
      await attemptRegistration();
    };

    try {
      await Promise.race([doRegister(), timeout]);
    } catch (err) {
      console.error('[Push] requestFullPermission error/timeout:', err);
      registrationStateRef.current = 'idle';
      // On timeout, check if permission was actually granted but token just didn't arrive
      try {
        const PN = await getPushNotificationsPlugin();
        if (PN) {
          const p = await PN.checkPermissions();
          console.log(`[Push] Post-timeout permission check:`, p.receive);
          if (p.receive === 'granted') {
            setPermissionStatus('granted');
          } else if (p.receive === 'denied') {
            setPermissionStatus('denied');
          }
        }
      } catch {}
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
