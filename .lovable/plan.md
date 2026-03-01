
## Push Notification Token Fix — Implemented

### Changes Made (2026-03-01)

1) **Fixed iOS native token bridge in `codemagic.yaml`** (both workflows):
   - `didRegisterForRemoteNotificationsWithDeviceToken` now sets `Messaging.messaging().apnsToken = deviceToken` instead of posting raw Data to Capacitor
   - `MessagingDelegate.didReceiveRegistrationToken` now posts FCM token to `.capacitorDidRegisterForRemoteNotifications` (Capacitor's expected notification name) instead of custom `"FCMToken"`

2) **Added iOS token validation in `src/hooks/usePushNotifications.ts`**:
   - `isValidFcmToken()` rejects 64-char hex APNs tokens on iOS
   - Registration listener skips invalid tokens and waits for real FCM token

3) **Cleaned stale invalid iOS tokens**:
   - Migration deleted existing APNs-style rows (`platform='ios' AND token ~ '^[A-Fa-f0-9]{64}$'`)

4) **Hardened queue processing in `process-notification-queue/index.ts`**:
   - Queue rows are only marked `processed` when `sent > 0`
   - Push failures (sent=0, invoke error, exception) now throw → triggering retry/dead-letter logic

### Next Steps
- Trigger new Codemagic build
- Install TestFlight build on buyer + seller devices
- Verify `device_tokens` stores FCM-format tokens (>100 chars)
- Test broadcast delivery end-to-end
