
Current check result
1) Confirmed token state in backend:
- Buyer/admin test users currently have 0 rows in `device_tokens`.
- Seller has 1 iOS token with `token_len=64` (APNs hex format), not FCM.
- Direct push test to that seller returns `INVALID_TOKEN`.

Implementation plan
1) Fix iOS native token bridge in `codemagic.yaml` (both `ios-release` and `release-all` workflows):
- In `didRegisterForRemoteNotificationsWithDeviceToken`, set `Messaging.messaging().apnsToken = deviceToken`.
- In `messaging(_:didReceiveRegistrationToken:)`, post:
  `NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: fcmToken)`
  (use Capacitor notification name, remove custom `"FCMToken"` post).
- Keep `Messaging.messaging().delegate = self` after `FirebaseApp.configure()`.

2) Prevent APNs token from being saved as push token in `src/hooks/usePushNotifications.ts`:
- Add iOS token validation helper:
  - reject 64-char hex APNs-looking values
  - accept only FCM-style string for iOS.
- If APNs token arrives first, log and skip DB save; wait for FCM token event.
- Keep existing crash guards/try-catch around listeners.

3) Clean stale invalid iOS tokens:
- Add migration to delete existing APNs-style iOS rows:
  `platform='ios' AND token ~ '^[A-F0-9]{64}$'`.
- Keep `send-push-notification` invalid-token cleanup as fallback.

4) Correct queue processing success logic in `supabase/functions/process-notification-queue/index.ts`:
- Do not mark queue row `processed` when push result is `sent=0` or invoke returns error.
- Store `last_error`, increment retry, and move to `retrying/failed` by retry policy.
- Keep in-app notification insert behavior intact.

5) Verify end-to-end after next TestFlight build:
- Install fresh buyer + seller builds, allow notifications.
- Confirm app does not crash on permission grant.
- Confirm `device_tokens` now stores non-64 iOS token values.
- Trigger admin broadcast and order status updates; verify:
  - bell notifications created
  - push delivery shows `sent > 0`
  - no `processed` queue rows with silent push failures.

6) Correlate crash report context `8F42B1C3-5D9E-4A7B-B2E1-9C3F4D5A6E7B`:
- Match crash timestamp with iOS build/version and startup logs.
- If crash persists after token-bridge fix, patch exact native stack frame next.
