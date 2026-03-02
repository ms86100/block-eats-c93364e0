

## Root Cause Analysis

There are **two distinct problems** causing push notifications to fail:

### Problem 1: `device_tokens` table is EMPTY — tokens never saved

The `device_tokens` table has **zero rows**. Even though the user granted permission and the banner worked, the FCM token was never persisted. Here's why:

The `requestFullPermission()` flow calls `attemptRegistration()` → `attemptIosRegistration()`. On iOS, this calls `PushNotifications.register()` then `FirebaseMessaging.getToken()` and finally `handleValidToken()` → `saveTokenToDatabase()`.

However, `saveTokenToDatabase` uses an **upsert with `onConflict: 'user_id,token'`**. If there's no unique constraint on `(user_id, token)` in the database, the upsert silently fails or errors. We need to verify this constraint exists, and also add better error logging to catch this.

Additionally, the `requestFullPermission` function calls `attemptRegistration()` at the end, but `attemptRegistration` has a guard: it skips if state is `'registering'`. Since `requestFullPermission` doesn't explicitly reset state to `'idle'` before the inner `attemptRegistration` call on the iOS path, the call may be silently skipped.

### Problem 2: `send-push-notification` rejects client calls (401)

The `send-push-notification` edge function has a strict auth check:
```typescript
if (!authHeader || authHeader !== `Bearer ${serviceRoleKey}`) {
  return 401; // "service role required"
}
```

But `society-notifications.ts` calls it via `supabase.functions.invoke()` from the **client**, which sends the **anon key** (or user JWT), NOT the service role key. Every broadcast push call is silently rejected with 401.

The `process-notification-queue` edge function (which DOES use service role) calls `send-push-notification` internally — but looking at the broadcast flow in `EmergencyBroadcastSheet`, it calls `notifySocietyMembers()` directly from the client, which fires individual `supabase.functions.invoke('send-push-notification')` calls — all of which get 401'd.

---

## Fix Plan

### Fix 1: Ensure `device_tokens` constraint + fix registration state

- Verify/add a unique constraint on `(user_id, token)` in the `device_tokens` table (required for upsert)
- In `requestFullPermission()`, ensure `registrationStateRef.current` is set to `'idle'` right before calling `attemptRegistration()` (it already does this — but double-check the iOS `attemptIosRegistration` path doesn't leave it in `'registering'` state)

### Fix 2: Route broadcast push through `process-notification-queue`

Instead of calling `send-push-notification` directly from client (which gets 401), the `notifySocietyMembers()` and `notifySocietyAdmins()` functions should:
- Write entries to the `notification_queue` table (which is what `process-notification-queue` reads from)
- Then trigger `process-notification-queue` (which runs with service role and can call `send-push-notification` internally)

This is actually how the system was designed to work — the queue is the intermediary. The direct `supabase.functions.invoke('send-push-notification')` calls in `society-notifications.ts` bypass the queue and hit the 401 wall.

**Changes:**
1. **`src/lib/society-notifications.ts`**: Replace direct `send-push-notification` invocations with inserts into `notification_queue` table, then trigger `process-notification-queue`
2. **Database migration**: Verify unique constraint on `device_tokens(user_id, token)` exists
3. **`src/hooks/usePushNotifications.ts`**: Add explicit state reset and additional logging in `requestFullPermission` to ensure `attemptRegistration` actually runs

### Files to change

| File | Change |
|------|--------|
| `src/lib/society-notifications.ts` | Replace direct edge function calls with queue inserts |
| `src/hooks/usePushNotifications.ts` | Add state reset + logging before `attemptRegistration` in `requestFullPermission` |
| Database migration | Verify/add unique constraint on `device_tokens(user_id, token)` |

