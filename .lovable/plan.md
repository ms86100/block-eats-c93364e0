

# Platform Stability & Trust Audit Report

---

## A. Critical Risk Areas

### P0 — Immediate Production Risk

**P0-1: Payment webhook `payment.failed` lacks idempotency guard**
- **Component**: `razorpay-webhook` edge function (line 174-189)
- **What can break**: Unlike `payment.captured` which uses an atomic `WHERE razorpay_payment_id IS NULL` claim pattern, the `payment.failed` and `refund.created` handlers blindly update ALL matching records with no duplicate guard. A replayed or retried webhook could overwrite a legitimately `paid` record back to `failed`.
- **Who**: Buyer (paid but order shows failed), Seller (loses revenue)
- **Why it matters**: Financial data corruption. A buyer pays successfully, then a delayed `payment.failed` webhook for a prior attempt overwrites the status. This is a real Razorpay behavior — they send both `payment.failed` and `payment.captured` for the same order if the first attempt fails and the second succeeds.
- **Fix**: Add `WHERE payment_status != 'paid'` guard to the `payment.failed` update, and `WHERE payment_status = 'paid'` to `refund.created`. These are single-line SQL filter additions.

**P0-2: `removeTokenFromDatabase` silently no-ops on logout**
- **Component**: `PushNotificationProvider` + `usePushNotifications`
- **What can break**: `removeTokenFromDatabase` captures `user` and `token` via closure. When the user transitions to `null` (logout), the callback's `user` is already null, so the early return `if (!user || !token) return;` fires — the token is **never deleted**. The old user's device continues receiving push notifications for a new user's actions if someone logs into a different account.
- **Who**: Any user who logs out / switches accounts on a shared device
- **Why it matters**: Privacy violation — push notifications leak to wrong user. Support escalation guaranteed.
- **Fix**: Capture `user.id` and `token` into refs before the transition. Use the ref values in the cleanup callback instead of the live state.

**P0-3: Cart data from User A visible to User B after account switch**
- **Component**: `useCart.tsx` — `QueryClient` cache keyed by `user?.id`
- **What can break**: When user signs out, `window.dispatchEvent(new CustomEvent('app:clear-cache'))` is dispatched but `QueryClient.clear()` is not called directly — it relies on App.tsx listening to the event. If App.tsx hasn't mounted the listener yet (race on fast logout/login), the old cache persists. The new user sees stale cart items from the previous user until a refetch fires.
- **Who**: Multi-user shared device scenario
- **Why it matters**: Data leakage, trust violation
- **Fix**: Call `queryClient.clear()` directly in `signOut()` instead of relying on a custom event. Import `queryClient` as a module-level singleton (it already is in App.tsx).

### P1 — High Risk, Likely to Cause Support Tickets

**P1-1: `auto-cancel-orders` has no scheduled trigger**
- **Component**: `auto-cancel-orders` edge function
- **What can break**: The function exists but is only invoked via HTTP POST. There is no cron job configured in `supabase/config.toml` to call it periodically. Urgent orders with 3-minute auto-cancel rely on the **client-side** `UrgentOrderTimer` to detect timeout and refetch. If the seller closes the app, the order remains `placed` indefinitely (the client-side timer only runs on the buyer's view for display).
- **Who**: Buyer (order stuck in limbo), Seller (phantom orders)
- **Why it matters**: Core business promise broken — "urgent orders auto-cancel" doesn't actually work without the cron trigger.
- **Fix**: Add a cron schedule in `supabase/config.toml` to invoke `auto-cancel-orders` every 1-2 minutes.

**P1-2: Razorpay payment polling has no UI feedback on timeout**
- **Component**: `useCartPage.ts` `handleRazorpaySuccess` (lines 163-179)
- **What can break**: After Razorpay success callback, the code polls 10 times at 1.5s intervals (15s total). If the webhook hasn't processed by then, it shows a benign `toast.info` and navigates away. But the order's `payment_status` remains `pending`. There's no mechanism for the buyer to re-check or retry. The order could eventually be auto-cancelled as an orphan (if the cron exists), leaving the buyer charged but with no order.
- **Who**: Buyer
- **Why it matters**: Money taken, no order. Top-tier trust destroyer.
- **Fix**: If polling times out, navigate to the order detail page (which has realtime subscription) and show a persistent banner "Payment verification in progress" rather than navigating to the orders list.

**P1-3: Realtime `buyer-order-updates` requires `REPLICA IDENTITY FULL` but relies on `payload.old`**
- **Component**: `useBuyerOrderAlerts.ts` line 47
- **What can break**: The code checks `(payload.old as any)?.status` to detect if status actually changed. Without `REPLICA IDENTITY FULL` on the `orders` table, `payload.old` only contains the primary key. The memory notes mention `REPLICA IDENTITY FULL` is set, but if it's ever reset (migration, restore), the status change detection silently breaks — every UPDATE triggers a toast, including non-status updates (like `updated_at` changes).
- **Who**: Buyer (spam toasts on non-status updates)
- **Fix**: Defensive check: if `payload.old.status` is undefined, skip the toast rather than showing it.

**P1-4: Order placed with `payment_status: 'pending'` for COD**
- **Component**: `useCartPage.ts` line 159
- **What can break**: COD orders are created with `payment_status: 'pending'`. The `auto-cancel-orders` function cancels non-COD orders with `pending` payment after 15 min (line 42: `.neq('payment_method', 'cod')`). This is correct. However, COD orders never transition from `pending` to `paid` unless manually updated. The `payment_records` table will accumulate `pending` records forever for COD orders.
- **Who**: Admin (confusing analytics)
- **Fix**: Set COD `payment_status` to `'cod_pending'` or update to `'paid'` on delivery completion via trigger.

### P2 — Medium Risk

**P2-1: Search filter state persisted in localStorage across accounts**
- **Component**: `useSearchPage.ts` line 40-49
- **What can break**: `FILTER_STORAGE_KEY = 'app_search_filters'` is not scoped to user ID. If User A sets a 50km radius with cross-society enabled, User B inherits those filters on the same device.
- **Who**: Buyer (confusing product results)
- **Fix**: Scope the key to user ID or clear on logout.

**P2-2: `gate-token` signature verification uses non-constant-time comparison**
- **Component**: `gate-token/index.ts` line 56-59
- **What can break**: `verifySignature` compares two base64 strings with `===`. Unlike the Razorpay webhook (which uses byte-level XOR), the gate token uses direct string equality, which is vulnerable to timing attacks.
- **Who**: Security (theoretical attack on gate access)
- **Fix**: Use the same byte-level XOR comparison pattern used in `razorpay-webhook`.

**P2-3: Visitor OTP is a 6-digit random number generated client-side**
- **Component**: `useVisitorManagement.ts` line 54-56
- **What can break**: `Math.random()` is not cryptographically secure. For a gate access OTP, this is acceptable for most use cases but could be brute-forced (1M combinations, no rate limit on OTP validation in the client-side code).
- **Who**: Society security
- **Fix**: Use `crypto.getRandomValues()` for OTP generation and ensure server-side rate limiting on OTP validation.

**P2-4: `useSubmitGuard` cooldown is only 1 second**
- **Component**: `useSubmitGuard.ts`
- **What can break**: On slow networks, the order creation RPC can take 3-5 seconds. The 1-second cooldown expires before the first call completes. The `pendingRef` guard catches this, but if the first call throws an error (setting `pendingRef = false`), a rapid retry within 1s is blocked but at 1.1s it's allowed — creating a potential double-order scenario if the RPC actually succeeded but threw a network error.
- **Who**: Buyer (double-charged)
- **Fix**: Increase cooldown to 3-5 seconds, or keep `pendingRef = true` until `isPlacingOrder` resets.

**P2-5: Profile upsert during signup can orphan auth user**
- **Component**: `useAuthPage.ts` lines 343-363
- **What can break**: If the profile insert fails for any reason OTHER than email/phone uniqueness (e.g., network timeout, DB unavailable), the auth user exists but has no profile. The `useAuthState` recovery creates a minimal profile, but with potentially empty `flat_number` and `block`, making delivery impossible until manually fixed.
- **Who**: New user (broken onboarding)
- **Fix**: Already partially handled by `useAuthState` auto-recovery. Add a "Complete your profile" banner on HomePage when `profile.flat_number` is empty.

**P2-6: `create-razorpay-order` transfers 100% to seller (no platform fee deduction)**
- **Component**: `create-razorpay-order/index.ts` line 127-135
- **What can break**: The Razorpay Route transfer amount equals the full order amount. Platform fee is tracked in `payment_records` but not deducted from the Razorpay transfer. The seller receives 100% of the payment via Razorpay, then the platform has no mechanism to collect its fee.
- **Who**: Platform (revenue loss)
- **Why it matters**: This is a business logic gap but it's documented (O3 in audit file). Flagging here because it's a financial risk in production.

---

## B. Trust & UX Failure Scenarios

**Scenario 1: "I paid but my order disappeared"**
- User pays via UPI. Razorpay sends `payment.captured` webhook slowly. Polling times out after 15s. User navigates to orders list. Meanwhile `auto-cancel-orders` (if cron exists) cancels the order after 15 min because `payment_status` is still `pending`. User is charged with no order.
- Surfaces as: Angry support ticket with payment screenshot.

**Scenario 2: "I'm getting someone else's notifications"**
- User A logs out on a shared phone. Push token is not deleted (P0-2). User B logs in. User A's device token still points to the old user in `device_tokens`. When User A's orders update, push goes to User B's device.
- Surfaces as: Privacy complaint, potential legal issue.

**Scenario 3: "Seller never got my urgent order"**
- Buyer places an urgent order. Seller's app is backgrounded. Push notification fails (no device token yet — fresh install). Polling fallback hasn't fired yet. The 3-minute auto-cancel timer is client-side only (P1-1). If no cron is configured, the order stays `placed` forever. Buyer waits, eventually cancels manually.
- Surfaces as: "Your urgent feature doesn't work" complaint.

**Scenario 4: "My order shows failed but I was charged"**
- Razorpay sends `payment.failed` for attempt 1, then `payment.captured` for attempt 2. If `payment.captured` processes first (setting status to `paid`), then the delayed `payment.failed` webhook overwrites it back to `failed` (P0-1).
- Surfaces as: "I paid but it says failed" — requires manual DB fix.

**Scenario 5: "I logged in and see nothing"**
- New user signs up. Profile insert fails silently. Auth user exists. On next login, `get_user_auth_context` returns null profile. Auto-recovery in `useAuthState` creates a minimal profile but the user sees an empty home page with no society context.
- Surfaces as: "App is blank after I signed up" support ticket.

---

## C. Small, Safe Improvements (No Logic Changes)

| # | Issue | Fix | Risk |
|---|-------|-----|------|
| C1 | P0-1: Webhook overwrites paid→failed | Add `.neq('payment_status', 'paid')` to `payment.failed` handler; add `.eq('payment_status', 'paid')` to `refund.created` handler | Zero — additive filter only |
| C2 | P0-2: Push token not deleted on logout | Capture `userId` and `token` in refs before cleanup; use refs in `removeTokenFromDatabase` | Zero — fixes existing behavior |
| C3 | P1-1: Auto-cancel has no cron | Verify/add cron schedule for `auto-cancel-orders` in config | Zero — enables existing function |
| C4 | P1-3: Realtime old status undefined | Add `if (!oldStatus) return;` guard before comparison | Zero — defensive check |
| C5 | P2-2: Gate token timing-safe comparison | Replace `===` with byte-level XOR comparison | Zero — security hardening |
| C6 | P2-4: Submit guard cooldown too short | Increase `cooldownMs` from 1000 to 3000 in `useCartPage.ts` | Zero — reduces double-submit window |
| C7 | P1-2: Payment polling timeout UX | On timeout, navigate to order detail instead of orders list; show info banner | Minimal — improves recovery path |
| C8 | P2-1: Search filters leak across users | Scope localStorage key to user ID | Zero — data isolation |
| C9 | P2-5: Incomplete profile detection | Add "Complete your profile" prompt on HomePage when `flat_number` is empty | Zero — UX improvement |

---

## D. Final Verdict

### ⚠️ Conditionally Safe

The platform is conditionally safe for production provided:

1. **P0-1 is fixed before go-live** — the `payment.failed` webhook overwrite is a data corruption risk that could cause real financial disputes
2. **P0-2 is fixed before go-live** — push token leakage on logout is a privacy violation
3. **P1-1 is verified** — confirm that `auto-cancel-orders` has a cron trigger, or the urgent order promise is broken

### Known Limitations We Accept
- COD payment_status remains `pending` forever (cosmetic, no functional impact)
- Platform fee is tracked but not deducted from Razorpay transfers (documented business decision — O3)
- Order item status transitions lack DB-level validation (documented — O7)
- `Math.random()` for visitor OTP (acceptable for residential gate access)
- Delivery fee attribution in multi-vendor orders is inconsistent (documented — O3)

### Residual Risk Ownership
- **Payment disputes**: Operations team must have Razorpay dashboard access to reconcile `paid` vs `failed` discrepancies until C1 is shipped
- **Push notification gaps**: Expected until first native build deploys to real devices (device_tokens table is empty — confirmed by console logs)
- **Auto-cancel reliability**: If cron is not configured, urgent order auto-cancel relies entirely on client-side timers (fragile)

