

## Push Notification Investigation — Root Cause Analysis & Fix Plan

I've completed a thorough code inspection of the entire push notification stack: the JS hook, the native AppDelegate, the Codemagic build pipeline, the Capacitor config, and the Firebase integration. Here are the real findings.

---

### Finding 1 (Critical): `FirebaseAppDelegateProxyEnabled` is never set to `false` in Info.plist

**The problem:**
Your `AppDelegate.swift` (injected by Codemagic) **manually forwards** the APNs device token to Capacitor via `NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, ...)`. This pattern is correct — but **only** when Firebase's automatic method swizzling is disabled by setting `FirebaseAppDelegateProxyEnabled = false` in Info.plist.

Right now, that key is **never injected**. The default is `true`, meaning Firebase is swizzling AppDelegate methods AND your code is also manually forwarding tokens. This double-handling can cause:
- The permission prompt to silently fail or not appear
- Token confusion (APNs token vs FCM token race)
- The app not appearing properly in iOS Settings → Notifications

**Fix:** Add a PlistBuddy command in `codemagic.yaml` (in the "Enable Push Notification & Background Modes capabilities" step) to inject:
```
FirebaseAppDelegateProxyEnabled = false
```

---

### Finding 2 (Important): No user-facing recovery when permission is missed or denied

**The problem:**
The iOS notification permission prompt is a **one-shot deal** — iOS only shows it once per app install. If the user taps "Don't Allow" or if the prompt fails to appear (due to Finding 1), there is no UI in the app to:
- Show the current notification permission status
- Guide the user to iOS Settings to enable notifications manually
- Offer a "retry" button

The `NotificationsPage.tsx` only manages in-app preference toggles (orders, chat, promotions, sounds) — it has zero awareness of the actual OS-level permission state.

**Fix:** Add an OS-level notification status banner at the top of NotificationsPage that:
- Checks `PushNotifications.checkPermissions()` on mount
- If denied/not determined: shows a prominent banner with "Notifications are disabled. Tap to open Settings"
- Links to the iOS Settings app via a native URL scheme (`App.openUrl({ url: 'app-settings:' })`)

---

### Finding 3 (Important): Callback dependency chain causes effect teardown mid-registration

**The problem:**
In `usePushNotifications.ts`, the main `useEffect` (line 291) depends on `attemptRegistration` in its dependency array. The dependency chain is:

```text
permissionStatus (state)
  → emitDiagnostic (useCallback)
    → markFailed (useCallback)
      → attemptIosRegistration (useCallback)
        → attemptRegistration (useCallback)
          → useEffect [line 291] ← TEARS DOWN & RE-RUNS
```

When `setPermissionStatus('granted')` is called at line 191 during iOS registration (mid-flow), this triggers a cascade: the main useEffect tears down all listeners and re-runs. The registration was already in progress (waiting for `FirebaseMessaging.getToken()`), but cleanup fires underneath it, potentially:
- Removing token listeners before the token arrives
- Triggering a second `attemptRegistration()` call that gets skipped (state is already 'registering')

**Fix:** Remove `permissionStatus` from `emitDiagnostic`'s dependency by capturing it via a ref instead. This breaks the cascade and prevents the effect from re-running mid-registration.

---

### Finding 4 (Minor): No provisional/quiet notification support

Apps like Zomato request **provisional notifications** on iOS (quiet delivery to Notification Center without a prompt), then later ask for full permission when the user engages. This gives a smoother onboarding experience. The current code goes straight for the full permission prompt on login, which is aggressive and gives only one chance.

**Fix (optional, future):** Consider implementing a two-stage approach: provisional on first login, then full permission prompt when the user places their first order.

---

### Implementation Plan

**Batch 1 — Build pipeline fix (codemagic.yaml):**
1. Add `FirebaseAppDelegateProxyEnabled = false` to Info.plist injection in both iOS build workflows
2. This is the most likely root cause for the missing permission prompt

**Batch 2 — Code stability fix (usePushNotifications.ts):**
3. Replace `permissionStatus` state dependency in `emitDiagnostic` with a ref to prevent the useEffect teardown cascade during registration

**Batch 3 — User recovery UI (NotificationsPage.tsx):**
4. Add an OS-level permission status check and "Open Settings" banner at the top of the Notifications page, so users can recover if the prompt was missed or denied

---

### What this means for your next TestFlight build

After these changes, you will need to trigger a new Codemagic build. On the test device:
- **Delete the existing Sociva app** completely (iOS caches permission decisions per bundle ID)
- Install the new TestFlight build
- On login, the iOS permission prompt should appear
- If it still doesn't, the new NotificationsPage banner will show the current state and let you open Settings to enable it manually

