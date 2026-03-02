

## Push Notification v2 Hardening — Implementation Plan

The app currently crashes on load (`Failed to fetch dynamically imported module`), which is a transient HMR issue — it will resolve after the next successful build. The push notification fixes below are the substantive changes.

Your current code already has the v1 fixes (auto-prompt, tap routing, token cleanup, retry logic). The v2 hardening adds three reliability improvements to `usePushNotifications.ts` and a new diagnostic utility file.

### Changes

**File 1: `src/hooks/usePushNotifications.ts`** — 3 targeted edits

**A. Listener gate (race condition fix)**
Add a `listenersReadyRef` Promise that is created before the async IIFE sets up listeners, and resolved after all 4 listeners are attached. In `attemptRegistration()`, await this promise (with 5s timeout) before calling `PN.register()`. This prevents the token event from firing before the listener is ready on cold starts.

**B. iOS FCM.getToken() retry**
In the `'registration'` listener's iOS branch (currently line 395), replace the single `fcm.getToken()` call with a loop of up to 3 attempts with 1s/2s/3s backoff. If Firebase is still initializing on cold start, the first call can fail — retrying gives it time.

**C. iOS watchdog fallback**
In the watchdog timeout handler (currently line 261-274), add an iOS-specific branch: before retrying `register()`, attempt `FCM.getToken()` directly. If Firebase has a cached token from a prior session, this can succeed even when the registration event never fired.

**File 2: `src/lib/notifications.ts`** — minor alignment

Replace `getOrderNotifTitle(status, role)` with direct `ORDER_NOTIF_TITLES_BUYER[status]` / `ORDER_NOTIF_TITLES_SELLER[status]` lookups to match the uploaded file's pattern. Add `orderId` short-ID to seller cancelled body.

**File 3: `src/lib/pushDiagnostics.ts`** — new file

Create a diagnostic utility with `runPushDiagnostics(userId)` that tests each step of the chain: platform check, plugin loading, permission status, FCM plugin (iOS), FCM.getToken() (iOS), device_tokens query, and edge function test send. Returns structured results. Include `printDiagnostics()` helper for console output. Can be called from settings/debug page or browser console.

**File 4: Fix visitor route**

The uploaded file routes visitor notifications to `/visitor-management`, but your actual route is `/visitors`. The current code already has `/visitors` — no change needed here.

### Not changing
- `pushPermissionStage.ts` — already matches v2
- `EnableNotificationsBanner.tsx` — unchanged
- `PushNotificationProvider.tsx` — unchanged
- Edge function / Codemagic — already correct

