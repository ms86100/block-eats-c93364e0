

## Push Notification Fix — Implementation Plan

Three files to update with targeted fixes across 6 areas.

### File 1: `src/hooks/usePushNotifications.ts` — 3 changes

**A. `removeTokenFromDatabase` (lines 173-193)**
Replace single-token delete (`.eq('user_id', uid).eq('token', tok)`) with user-wide delete (`.eq('user_id', uid)`). Removes guard requiring `tok` to be non-null. Prevents orphaned tokens after FCM rotation.

**B. `handleNotificationAction` (lines 320-326)**
Expand from 2 conditions (orderId, type=order) to full routing: check `path`/`reference_path` first, then orderId, then type-specific routes (chat, order, visitor, dispute, maintenance, bulletin/notice), with `/notifications` as fallback.

**C. Login auto-prompt (lines 524-526)**
Replace the passive `else` branch that logs "waiting for user to tap Enable banner" with an active branch: when stage is `'none'` or `'deferred'`, set stage to `'full'` and call `attemptRegistration()`. This triggers the iOS permission dialog on first login instead of requiring users to find the banner.

### File 2: `src/lib/notifications.ts` — full replacement

- Import titles from `order-notification-titles.ts` instead of duplicating them in switch statements
- Replace buyer switch (10 statuses) with `BUYER_BODIES` lookup map covering all 13 statuses (adds `on_the_way`, `arrived`, `assigned`, `in_progress`)
- Replace seller switch (2 statuses) with `SELLER_BODIES` lookup map covering 3 statuses (adds `enquired`)
- Add retry logic to `sendPushNotification`: up to 3 attempts with exponential backoff (1s, 2s delays)
- Remove emoji from `sendChatNotification` title (matches uploaded file)

### File 3: `src/lib/pushPermissionStage.ts` — full replacement

- Return `'none'` on web instead of `'full'` (prevents unnecessary plugin import attempts)
- Switch from static `import { Preferences }` to dynamic `await import('@capacitor/preferences')` via helper function
- Add web guard to `setPushStage` (early return on non-native)

### Files unchanged
- `PushNotificationProvider.tsx` — no changes needed
- `EnableNotificationsBanner.tsx` — remains as fallback CTA
- `send-push-notification/index.ts` — already correct
- `codemagic.yaml` — already has swizzling disabled + AppDelegate forwarding

