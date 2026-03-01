
Goal: stop the repeated iOS crashes and restore reliable seller push/in-app alerts for new buyer orders.

What I verified (root causes)
1) New-order notification trigger is missing on INSERT
- Latest buyer order exists: `orders.id = 59f6cec8-bf50-40f4-a41d-803b4de025db`, status `placed` (created `2026-03-01 07:28:06+00`).
- There is no matching row in `notification_queue` and no matching `user_notifications` for this order.
- Database trigger inspection shows only `trg_enqueue_order_notification` (AFTER UPDATE) exists; no INSERT trigger for new placed orders.
- Migration `20260301064847_080a506b...sql` explicitly dropped `trg_enqueue_order_placed_notification`, which explains why new placed orders stopped notifying sellers.

2) Stored iOS tokens are APNs-style, but backend is sending via FCM registration-token API
- Seller token values are 64-char hex strings (APNs style), not FCM registration tokens.
- Direct call to `send-push-notification` returns:
  - `Sent 0 notifications, 2 failed`
  - `error: INVALID_TOKEN` for both seller tokens.
- So token capture “works” at DB level, but delivery fails because token type and delivery channel are mismatched.

3) Queue processor is treating push failures as success
- `process-notification-queue` calls `supabase.functions.invoke("send-push-notification")` in try/catch.
- It does not check `invoke` returned `error` or `data.sent`.
- Result: queue rows can be marked `processed` even when push delivery failed (silent failure path).

4) Crash likely tied to push-init/native startup race on iOS (needs crash log mapping)
- Crash happens around permission/first-run lifecycle and then app opens fine later (classic initialization race signature).
- You confirmed crash logs are available for both devices; we should use those to confirm exact crash frame before final hardening.
- Current JS push listener path has unsafe spots (no callback-level guard in registration listener; token access assumes shape), so we should harden regardless.

Implementation plan (concrete)
Phase 1 — Restore seller “new order” notifications immediately
1. Add a new migration to recreate an INSERT trigger on `orders` for `status IN ('placed','enquired')`.
2. Keep existing UPDATE trigger for status transitions; ensure no duplicate inserts.
3. Add idempotency guard in trigger payload (orderId + status) to prevent duplicate queue entries.

Phase 2 — Fix push delivery pipeline correctness
4. Update `process-notification-queue` to treat push as failed unless:
   - invoke has no `error`, and
   - response has `sent > 0`.
5. On failure, set queue row to `retrying`/`failed` with concrete `last_error` (including INVALID_TOKEN cases), instead of marking processed.
6. Add structured logs in both queue processor and send function (userId, queueId, token count, sent/failed).

Phase 3 — Fix iOS token source mismatch (core delivery fix)
7. Change iOS registration path to persist FCM token (not APNs hex token):
   - Initialize Firebase once at launch.
   - Wire Firebase Messaging delegate to fetch FCM registration token.
   - Forward/store FCM token to backend.
8. Extend `device_tokens` metadata to track token provider/type (`fcm` vs `apns`) and platform.
9. Backfill/cleanup old invalid APNs-style rows for iOS after FCM capture is confirmed.

Phase 4 — Crash hardening (both devices)
10. Add defensive guards around push registration callbacks in `usePushNotifications`:
    - wrap listener bodies in `try/catch`,
    - validate token shape before `.slice`,
    - fail gracefully without unhandled promise rejection.
11. Gate registration until auth + app-active + native bridge ready; prevent overlapping register attempts.
12. Add explicit diagnostic breadcrumbs around startup/push init to correlate with TestFlight crash timestamps.
13. Review TestFlight crash stack frames and patch the exact crashing native path (AppDelegate/Firebase/push callback) once symbolicated.

Phase 5 — Verification checklist (must pass before closing)
14. DB validation:
    - place a buyer order and confirm `notification_queue` row is created immediately for seller.
15. Queue validation:
    - run queue processor and verify row transitions and no silent “processed with sent=0”.
16. Delivery validation:
    - direct send to seller returns `sent > 0`.
17. App validation:
    - seller receives both in-app alert and push for new placed order.
18. Stability validation:
    - fresh install + allow push on both buyer/seller devices with no “Sociva crashed” popup.
19. End-to-end regression:
    - order placed → seller alerted → order accepted/preparing/ready notifications still function.

Technical details (for implementation)
- Files to update:
  - `supabase/migrations/*` (restore INSERT trigger + optional idempotency guard),
  - `supabase/functions/process-notification-queue/index.ts` (delivery success criteria),
  - `supabase/functions/send-push-notification/index.ts` (structured error logging/token metadata),
  - `src/hooks/usePushNotifications.ts` (listener safety + registration gating),
  - iOS push bootstrap path in CI/native patching flow (FCM token capture path).
- Data points already confirmed:
  - missing queue row for order `59f6cec8-bf50-40f4-a41d-803b4de025db`,
  - seller user id `20cda5a7-6a1f-4a71-855a-e3ec37812223`,
  - direct push currently fails with `INVALID_TOKEN` on both stored seller tokens.
