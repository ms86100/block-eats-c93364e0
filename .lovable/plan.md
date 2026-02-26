

# Audit: Login Persistence & Haptic Feedback — Residual Issues

Both fixes were previously implemented but contain critical defects that prevent them from working correctly on native iOS. This audit identifies the root causes without changing any business logic.

---

## Issue A — Login Persistence: Race Condition Defeats Storage Swap

**Current state of the fix:** The code in `src/lib/capacitor-storage.ts` and `src/lib/capacitor.ts` is correct in intent. However, there is a critical race condition in `src/main.tsx`:

```typescript
initializeCapacitorPlugins(); // async — returns a Promise
createRoot(document.getElementById("root")!).render(<App />); // runs IMMEDIATELY
```

`initializeCapacitorPlugins()` is `async` and contains `await migrateLocalStorageToPreferences()`. The function returns a Promise, but **it is not awaited**. This means `createRoot` and `<App />` mount immediately, `useAuthState` fires `supabase.auth.getSession()` **before** the storage swap completes. The auth client still reads from `localStorage` (which is empty on iOS after a cold start), finds no session, and reports the user as logged out.

Additionally, the storage patch at line 15 of `capacitor.ts`:
```typescript
(supabase.auth as any).storage = capacitorStorage;
```
This patches the `.storage` property on the auth instance. However, in Supabase JS v2, the GoTrueClient stores the `storage` reference internally during construction (in `client.ts` line 12: `storage: localStorage`). Simply reassigning `.storage` after construction may not propagate to the internal lock manager and session persistence layer, depending on the Supabase JS version.

**Root cause:** The init function is fire-and-forget. React mounts before the storage adapter is applied, so `getSession()` reads from unpopulated `localStorage`.

**Proposed fix (2 changes, no business logic change):**

1. **`src/main.tsx`** — Await the initialization before mounting React:
```typescript
import { initializeCapacitorPlugins } from "./lib/capacitor";

async function bootstrap() {
  await initializeCapacitorPlugins();
  const { createRoot } = await import("react-dom/client");
  const { default: App } = await import("./App");
  createRoot(document.getElementById("root")!).render(<App />);
}
bootstrap();
```

2. **`src/lib/capacitor.ts`** — Move the storage patch to happen **before** the Supabase client is constructed. Since `client.ts` is auto-generated and cannot be edited, and the client is constructed at import time, the patch must be applied as early as possible. The current approach of patching `(supabase.auth as any).storage` is the only option, but it must complete before any auth call. Awaiting `initializeCapacitorPlugins()` in `main.tsx` guarantees this ordering.

Additionally, ensure the migration runs to completion so any session tokens already in `localStorage` (from before the fix was deployed) are copied to Preferences before the first `getSession()` call.

**Files to change:**
- `src/main.tsx` — await init before `createRoot`

---

## Issue B — Haptic Feedback on BottomNav: Already Fixed, Verify Build

The `BottomNav.tsx` already has `onClick={() => hapticSelection()}` on every `NavLink` (line 67). This fix is correct and should work on native.

**However**, if the user's TestFlight build was created **before** this fix was deployed, the build would not include the change. The user needs to:
1. Pull the latest code
2. Run `npx cap sync`
3. Rebuild and redeploy to TestFlight

If the user confirms haptics still don't work after a fresh build, a deeper investigation is needed into whether `hapticSelection()` fires but the Haptics plugin isn't loaded yet (because `preloadHaptics()` is also async and not awaited before React mounts — same race condition as Issue A).

**Proposed fix (covered by Issue A):** Awaiting `initializeCapacitorPlugins()` in `main.tsx` also ensures `preloadHaptics()` completes before the app renders, so the haptics module (`_mod`) is populated before any user interaction occurs.

**Files to change:** Same as Issue A — `src/main.tsx`

---

## Summary of Changes

| File | Change | Risk |
|------|--------|------|
| `src/main.tsx` | Await `initializeCapacitorPlugins()` before `createRoot` | Zero — only changes startup ordering on native; web init is a no-op that resolves instantly |

This is a single-file, 6-line change that fixes both reported issues by ensuring all native plugin initialization (storage swap, haptics preload, status bar config) completes before React mounts and any auth/UI code runs.

---

## Technical Detail

The current `main.tsx` call sequence:

```text
initializeCapacitorPlugins()  →  returns Promise (not awaited)
createRoot().render(<App />)  →  runs immediately
  └─ useAuthState()
       └─ supabase.auth.getSession()  →  reads localStorage (empty on iOS)
       └─ supabase.auth.onAuthStateChange()  →  fires SIGNED_OUT
```

After fix:

```text
await initializeCapacitorPlugins()
  ├─ patch supabase.auth.storage = capacitorStorage  ✓
  ├─ await migrateLocalStorageToPreferences()         ✓
  ├─ preloadHaptics()                                 ✓
  └─ StatusBar / SplashScreen config                  ✓
createRoot().render(<App />)
  └─ useAuthState()
       └─ supabase.auth.getSession()  →  reads from Preferences (has session)  ✓
```

