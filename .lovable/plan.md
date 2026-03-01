

## Why Push Notifications Are Not Working

The root cause is in `src/hooks/usePushNotifications.ts` lines 506-523. The push permission stage logic still implements the old "Zomato deferred" strategy instead of prompting on first launch:

```text
Current flow (broken):
  stage 'none'     → sets 'deferred', returns (NO prompt)
  stage 'deferred' → does nothing (NO prompt)
  stage 'full'     → calls attemptRegistration() (prompt works)
```

On a fresh install, the stage is always `none`, so the app sets it to `deferred` and never shows the iOS permission popup. The user would need to place an order first (which calls `requestFullPermission`) -- but you chose "On first launch."

## Fix

Change lines 506-523 in `src/hooks/usePushNotifications.ts` so that:

- Stage `none` → set stage to `full` and call `attemptRegistration()` immediately
- Stage `deferred` → also upgrade to `full` and call `attemptRegistration()`
- Stage `full` → call `attemptRegistration()` as before

The updated logic:

```typescript
if (user) {
  setTimeout(async () => {
    const stage = await getPushStage();
    console.log(`[Push] Push stage: ${stage}`);

    if (stage !== 'full') {
      // First launch or deferred — upgrade to full and prompt immediately
      await setPushStage('full');
      console.log('[Push] Upgrading to full stage — requesting permission now');
    }

    attemptRegistration();
  }, 500);
}
```

This is a single-line-range change in one file. After this, the iOS "Allow Notifications" popup will appear on first login.

## Also Pending (from previous plan, approved)

These changes are still needed and should be implemented in the same pass:

1. **Database migration**: Fix `fn_enqueue_new_order_notification` type mismatch (`NEW.status::text`)
2. **Block self-orders**: Client-side check in `useCartPage.ts` + database guard in `create_multi_vendor_orders`
3. **CI validation guards**: Add push entitlement and AppDelegate verification steps to `codemagic.yaml`

