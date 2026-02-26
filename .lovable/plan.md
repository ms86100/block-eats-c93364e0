

# P0 Fix: Blank White Screen — Startup Safety + Capacitor Hardening

## Summary

The blank white screen on TestFlight has **three converging causes**, not one. This plan addresses all of them to guarantee that the app always reaches either the login screen or a recoverable error UI — never a permanent white screen.

---

## Fix 1: Harden Capacitor Config (Root Cause)

**File: `capacitor.config.ts`**

The current config relies on `process.env.CAPACITOR_ENV` which is fragile. If the env var is missing or the CI step changes, the app silently loads in dev mode on a production device (no server to connect to = white screen).

**Changes:**
- Remove the `allowNavigation` restriction entirely (it can silently block auth redirects on iOS)
- Remove `process.env.CAPACITOR_ENV` branching — instead, produce a clean production-safe config that always works when bundled
- The dev server URL will be injected only via a separate `capacitor.config.dev.ts` approach, or by using Codemagic's existing `CAPACITOR_ENV` at `npx cap sync` time but with a **failsafe**: if the env is not set, default to production behavior (no remote server), not dev behavior
- Set `launchAutoHide: false` on SplashScreen so the splash stays until the app explicitly hides it (which `src/lib/capacitor.ts` already does)

```text
Before (dangerous default):
  isProduction = false → loads remote dev server → white screen on device

After (safe default):
  isProduction defaults to true → loads bundled assets → always works
  Only explicitly setting CAPACITOR_ENV=development enables dev server
```

## Fix 2: Fix AnimatePresence Crash (Direct Crash Vector)

**File: `src/components/seller/NewOrderAlertOverlay.tsx`**

The component returns `null` when `!order`, but this happens INSIDE `AnimatePresence`, causing Framer Motion to fight React over DOM removal → `removeChild` error → can cascade to white screen.

**Changes:**
- Always render `<AnimatePresence mode="wait">` as the wrapper
- Conditionally render the `motion.div` child with a `key` prop inside it
- Move the `if (!order) return null` logic to be the conditional inside AnimatePresence

## Fix 3: Isolate GlobalSellerAlert with Error Boundary (Containment)

**File: `src/App.tsx`**

`GlobalSellerAlert` sits at the top level of the component tree. If it crashes (Realtime failure, auth race, AnimatePresence error), it takes down the entire app. No route, no login, no recovery.

**Changes:**
- Wrap `<GlobalSellerAlert />` in a lightweight error boundary that returns `null` on error (silent containment — seller alerts are not worth killing the app)
- This is a small inline `SafeSellerAlert` class component in App.tsx

## Fix 4: Startup Safety Contract (Architectural Guarantee)

**Files: `src/main.tsx`, `src/components/ErrorBoundary.tsx`**

The current 10-second watchdog in `main.tsx` shows a fallback if `data-app-mounted` is not set, but "Reload App" just calls `bootstrap()` again which hits the same crash path. And the ErrorBoundary's "Reload" does `window.location.reload()` which also re-enters the same state.

**Changes to `main.tsx`:**
- The retry button in the fallback HTML will clear `sessionStorage` and `localStorage` auth tokens before re-bootstrapping, breaking any auth-related crash loops
- Add a boot counter in sessionStorage; if bootstrap fails 3 times in a row, show a "Clear Data & Retry" option that wipes all cached state

**Changes to `ErrorBoundary.tsx`:**
- The "Reload App" button will first clear query caches and auth state before reloading
- The "Go Home" button will navigate to `/auth` (not `/`) to avoid re-entering a protected route that crashes

**Net result:** After these changes, ANY render error in ANY component will result in one of:
1. Route-level recovery (RouteErrorBoundary catches it, user can go back)
2. Seller alert silently disabled (SafeSellerAlert catches it)
3. Global ErrorBoundary shows retry UI with working recovery
4. Boot watchdog shows fallback with cache-clearing retry

The app can never permanently white-screen.

---

## Technical Details

### `capacitor.config.ts` — Safe Default

```typescript
// Flip the default: production unless explicitly dev
const isDevelopment = process.env.CAPACITOR_ENV === 'development';

const config: CapacitorConfig = {
  appId: 'app.sociva.community',
  appName: 'Sociva',
  webDir: 'dist',

  // Only inject dev server when explicitly in development mode
  ...(isDevelopment && {
    server: {
      url: 'https://b3f6efce-9b8e-4071-b39d-b038b9b1adf4.lovableproject.com?forceHideBadge=true',
      cleartext: true,
      hostname: 'sociva.app',
      androidScheme: 'https',
    },
  }),

  // Production: no server block, no allowNavigation
  // Capacitor loads from bundled dist/ assets by default
  ...(!isDevelopment && {
    server: {
      androidScheme: 'https',
    },
  }),

  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: false,  // App controls hide via capacitor.ts
      ...
    },
    ...
  },
  android: {
    allowMixedContent: isDevelopment,
    webContentsDebuggingEnabled: isDevelopment,
    ...
  },
};
```

### `codemagic.yaml` — Update env var

The Codemagic workflow already sets `CAPACITOR_ENV=production`. With the flipped default, this is now a no-op safety belt rather than a critical requirement. No changes needed to codemagic.yaml for this fix.

### `NewOrderAlertOverlay.tsx` — AnimatePresence Fix

```tsx
export function NewOrderAlertOverlay({ order, onDismiss }: Props) {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();

  const handleView = () => {
    onDismiss();
    navigate(`/orders/${order!.id}`);
  };

  return (
    <AnimatePresence mode="wait">
      {order && (
        <motion.div
          key="new-order-alert"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] ..."
          onClick={onDismiss}
        >
          {/* ... inner content unchanged ... */}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

### `App.tsx` — SafeSellerAlert Boundary

```tsx
class SafeSellerAlert extends React.Component<{children: React.ReactNode}, {failed: boolean}> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: Error) { console.error('[SafeSellerAlert]', e); }
  render() { return this.state.failed ? null : this.props.children; }
}

// In the render tree:
<SafeSellerAlert>
  <GlobalSellerAlert />
</SafeSellerAlert>
```

### `main.tsx` — Crash-Loop Breaker

```typescript
function showFatalFallback() {
  // Track boot failures
  const fails = Number(sessionStorage.getItem('boot-fails') || '0') + 1;
  sessionStorage.setItem('boot-fails', String(fails));

  const root = document.getElementById("root");
  if (!root) return;

  // After 3 failures, offer nuclear option
  const showClear = fails >= 3;
  root.innerHTML = `...${showClear ? '<button id="clear-btn">Clear Data & Retry</button>' : ''}...`;

  document.getElementById("retry-boot-btn")?.addEventListener("click", () => {
    // Clear auth tokens to break crash loops
    try { localStorage.removeItem('sb-rvvctaikytfeyzkwoqxg-auth-token'); } catch {}
    root.innerHTML = "";
    bootstrap();
  });

  if (showClear) {
    document.getElementById("clear-btn")?.addEventListener("click", () => {
      sessionStorage.clear();
      localStorage.clear();
      window.location.reload();
    });
  }
}

// On successful mount, reset counter
// (added to bootstrap after createRoot):
sessionStorage.removeItem('boot-fails');
```

### `ErrorBoundary.tsx` — Safe Recovery

- "Go Home" navigates to `#/auth` instead of `#/` (avoids re-entering ProtectedRoute that may crash)
- "Reload App" clears auth token before reload

---

## Verification Checklist

After these fixes, the following invariants hold:

| Scenario | Outcome |
|----------|---------|
| CAPACITOR_ENV not set | App loads from bundled assets (safe) |
| CAPACITOR_ENV=development | App loads from dev server (dev only) |
| CAPACITOR_ENV=production | App loads from bundled assets (explicit) |
| NewOrderAlertOverlay unmounts | Clean AnimatePresence exit, no DOM error |
| GlobalSellerAlert crashes | Silently contained, app continues |
| Any route crashes | RouteErrorBoundary catches, user can go back |
| Boot fails 3 times | "Clear Data & Retry" option shown |
| Auth session stale on startup | Crash loop broken by token clearing |

