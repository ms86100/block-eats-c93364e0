# P0 Root Cause Analysis and Permanent Fix Plan

## The Problem Statement (What You See)

On iOS TestFlight: cold launch shows "Something went wrong. Startup failed due to a runtime error. Please reopen the app." Clicking "Reload App" does nothing meaningful.

On web preview: same error appears after HMR (hot module reload) triggers a transient hooks-ordering violation.

---

## 1. Why "Reload App" Does Nothing

The "Reload App" button in the fallback HTML calls `window.location.reload()` (line 5 of `main.tsx`). This performs a full browser reload, which re-executes the entire bootstrap sequence. However, if the same root error occurs again on the second boot, the same fallback appears immediately. The button is correctly wired -- but it reloads into the same crash.

The button does NOT:

- Recreate the React root independently
- Clear auth/session state
- Reinitialize Capacitor runtime
- Clear cached modules

It is a simple `window.location.reload()`. For a persistent crash, reload just repeats the crash.

---

## 2. The Exact Startup Failure (Two Distinct Bugs)

### Bug A: `main.tsx` Global Handlers Preempt React ErrorBoundary

**File:** `src/main.tsx`, lines 24-37
**Condition:** Any render error fires before `ErrorBoundary.componentDidMount` sets `data-app-mounted`

The sequence:

1. React starts rendering `<App />` inside `ErrorBoundary`
2. A child component (AuthProvider, PushNotificationProvider, etc.) throws during render
3. The error propagates to the `window.addEventListener("error")` handler in `main.tsx` line 25
4. `appDidNotMount()` checks for `data-app-mounted` attribute -- it is NOT yet set because `componentDidMount` fires AFTER first successful render, and the render failed
5. `showFatalFallback()` replaces `root.innerHTML` with static HTML, destroying the React tree
6. `ErrorBoundary.getDerivedStateFromError` was called but its re-render (error UI) is orphaned because the React root was just nuked
7. The app is now dead -- static HTML with a reload button that restarts the same sequence

The fundamental design flaw: the global error handler in `main.tsx` races with React's error boundary mechanism. It fires synchronously when the error is thrown, before React can recover via ErrorBoundary. It then destroys the React tree, making ErrorBoundary's recovery impossible.

### Bug B: HMR Hooks Order Violation (Web Preview Specific)

**File:** `src/contexts/auth/AuthProvider.tsx`
**Error:** "Rendered more hooks than during the previous render" at line 159 (HMR-cached version)

The current disk version of AuthProvider.tsx has 137 lines and 9 hooks, all unconditional. This is correct. The error at "line 159" references a stale HMR-cached version of the file (note the `?t=1772099085265` cache-buster in the URL). When Vite hot-reloads a component whose hook count changed, React throws this error. It is transient and would resolve with a full page reload -- except Bug A intercepts it first and kills the tree.

### Bug C: TestFlight Cold Start Failure (Native Specific)

On TestFlight, HMR is not involved. The production build loads from bundled `dist/` assets. The most likely crash path:

1. `main.tsx` bootstrap calls `initializeCapacitorPlugins()`
2. Inside `capacitor.ts`, the manual session restore (lines 27-40) does `await capacitorStorage.getItem(storageKey)` followed by `await supabase.auth.setSession()`
3. If `setSession()` throws (corrupt stored token, network issue during token validation), the error IS caught by the try/catch
4. React mounts. `AuthProvider` calls `useAuthState()`, which calls `supabase.auth.onAuthStateChange()` and `supabase.auth.getSession()`
5. If the Supabase client's internal session state is inconsistent (partial initialization due to async storage), `getSession()` may return a malformed session
6. `fetchProfile()` is called with a user ID from a session that is about to expire or is invalid
7. The RPC `get_user_auth_context` fails with a 401 or JWT error
8. This error propagates through React Query's `onError` handler, which calls `handleAuthError()` (App.tsx line 117), which calls `supabase.auth.signOut()`, which triggers `onAuthStateChange` with SIGNED_OUT
9. But AuthProvider is mid-render -- setState is called during render, causing a cascading error
10. Error hits the window error handler in `main.tsx` → `appDidNotMount()` returns true → fallback replaces tree

---

## 3. The Fix Plan (No New Features, No Redesign)

### Fix 1: Remove Aggressive Global Error Interception from `main.tsx`

**File:** `src/main.tsx`

The `window.addEventListener("error")` and `window.addEventListener("unhandledrejection")` handlers that call `showFatalFallback()` must NOT fire during the React render cycle. They race with ErrorBoundary and destroy the tree before React can recover.

**Change:** Remove the immediate `showFatalFallback()` calls from the error/rejection handlers. Keep ONLY the 10-second timeout as the safety net. The ErrorBoundary handles render errors; the 10-second timeout catches cases where nothing renders at all.

Additionally, change the fallback's reload mechanism from `window.location.reload()` to nuking the root's innerHTML and re-running `bootstrap()` from scratch, ensuring a fresh React root is created.

### Fix 2: Move `data-app-mounted` Signal Earlier

**File:** `src/components/ErrorBoundary.tsx`

Move the `data-app-mounted` attribute from `componentDidMount` to the `constructor`. This ensures the attribute is set as soon as React begins processing the component -- before any child errors can fire. The 10-second timeout will then correctly determine that React IS running (even if into an error state), and will not show the raw HTML fallback.

### Fix 3: Eliminate All Remaining `useAuth()` Calls Outside AuthProvider

**File:** `src/hooks/useBuyerOrderAlerts.ts`

This hook calls `useAuth()` and is invoked inside `AppRoutes` (which is inside AuthProvider -- correct placement). However, if HMR causes component reordering or if another hook in the chain throws first, the cascading failure kills the tree. Convert this to use `useContext(IdentityContext)` with null-safety, matching the pattern already applied to `PushNotificationProvider` and `usePushNotifications`.

### Fix 4: Isolate GlobalSellerAlert from Fatal Crashes

**File:** `src/App.tsx`

The `GlobalSellerAlert` component calls `useAuth()` at line 292. If this throws during HMR or context initialization, it crashes the entire app. Wrap it in its own try/catch via a small error boundary, or convert to use `useContext` with null-safety.

### Fix 5: Harden `capacitor.ts` Session Restore for TestFlight

**File:** `src/lib/capacitor.ts`

The manual session restore block (lines 27-40) calls `supabase.auth.setSession()`. If the stored token is corrupt or expired, `setSession` may internally trigger `onAuthStateChange` which starts React-side state updates before the app has mounted. Add a flag to defer session restore until after React mount, or ensure `setSession` errors are fully absorbed.

---

## 4. Technical Details of Each Change

### `src/main.tsx` (Fix 1)

Remove the `appDidNotMount()` check and `showFatalFallback()` from the `error` and `unhandledrejection` handlers. Keep them as logging-only. The 10-second timeout remains as the sole safety net for complete mount failure. Change the fallback button from `window.location.reload()` to a function that clears the root, re-imports App, and creates a fresh React root.

### `src/components/ErrorBoundary.tsx` (Fix 2)

Move `document.getElementById('root')?.setAttribute('data-app-mounted', 'true')` from `componentDidMount` to the constructor. This ensures the attribute is present before any child render errors propagate to global handlers.

### `src/hooks/useBuyerOrderAlerts.ts` (Fix 3)

Replace `const { user } = useAuth()` with `const identity = useContext(IdentityContext); const user = identity?.user ?? null;`. Add early return if `identity` is null.

### `src/App.tsx` (Fix 4)

Convert `GlobalSellerAlert` to use raw `useContext` for both `IdentityContext` and `SellerContext` instead of `useAuth()`. Return null if contexts are not yet available.

### `src/lib/capacitor.ts` (Fix 5)

Remove the manual `supabase.auth.setSession()` call entirely. The Supabase client is already configured with `capacitorStorage` as its storage adapter. When `GoTrueClient` initializes, it calls `storage.getItem()` internally and restores the session automatically. The manual restore is redundant and introduces a race condition where `setSession` triggers `onAuthStateChange` before React is mounted.

---

## Summary

The startup crash is caused by a design conflict: `main.tsx` installs global error handlers that destroy the React tree before React's own ErrorBoundary can recover. On web, HMR-induced hooks errors trigger this. On TestFlight, a redundant manual session restore can trigger auth state changes before React mounts, causing a similar cascade. The fix removes the aggressive global interception, eliminates the redundant session restore, and converts remaining `useAuth()` calls in global hooks to null-safe context access.