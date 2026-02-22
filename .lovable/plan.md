

# Security & Gate Module — Deep Audit Plan

## Scope

6 pages, 9 components, 1 edge function, 5 tables, 1 RPC function bug.

**Pages**: Guard Kiosk, Gate Entry, Security Verify (redirect), Security Audit, Visitor Management, Parcel Management, Authorized Persons

**Components**: GuardResidentQRTab, GuardVisitorOTPTab, GuardDeliveryTab, GuardManualEntryTab, GuardGateLogTab, ExpectedVisitorsList, QRCodeDisplay, ResidentConfirmation, ManualEntryApproval, GuardConfirmationPoller, WorkerGateValidation

---

## Phase 1: Discovered Issues

### G1 — CRITICAL: GuardGateLogTab passes wrong parameter to RPC

`GuardGateLogTab` calls `supabase.rpc('get_unified_gate_log', { _society_id, _limit: 50 })` but the function signature is `get_unified_gate_log(_society_id uuid, _date date)`. The `_limit` parameter is not recognized and `_date` is missing. This causes the "Log" tab in the Guard Console to fail silently or return an error.

**Fix**: Change call to pass `_date: new Date().toISOString().split('T')[0]` instead of `_limit: 50`. The function already has no LIMIT clause (returns all entries for the given date).

### G2 — MEDIUM: PendingDeliveries uses useState instead of useEffect

In `GuardDeliveryTab`, the `PendingDeliveries` sub-component uses `useState(() => { ... })` (line 251) to trigger a fetch — this is a React anti-pattern. `useState` initializers run synchronously and should not perform async side effects. The fetch will fire on every render.

**Fix**: Replace `useState(() => { ... })` with `useEffect(() => { ... }, [societyId])`.

### G3 — MEDIUM: GuardResidentQRTab has duplicate manual entry logic

`GuardResidentQRTab` contains a full manual entry section (lines 104-143) with its own realtime subscription, duplicating `GuardManualEntryTab` which is a separate tab. This is dead code that could cause double entries.

**Fix**: Remove the manual entry section from `GuardResidentQRTab` since `GuardManualEntryTab` is already a dedicated tab. This eliminates the duplication.

### G4 — LOW: Visitor OTP query missing security officer scope check

`GuardVisitorOTPTab` directly queries `visitor_entries` by `society_id` + `otp_code` without verifying the querying user is a security officer. RLS covers SELECT (residents see own + admins see all), but security officers have no explicit SELECT policy on `visitor_entries`. They rely on `is_society_admin` or the query happening through the guard context.

**Status**: Functionally safe — guards must already pass the `GuardKioskPage` access gate. Document only.

### G5 — LOW: Parcel INSERT policy requires `resident_id = auth.uid()`

The parcel INSERT RLS policy enforces `resident_id = auth.uid() AND can_write_to_society(...)`. When an admin/guard logs a parcel for a different resident, `resident_id` is set to the target resident (not the guard), so the insert will fail via RLS.

**Fix**: The policy needs to allow admins to insert parcels for other residents. Add an OR clause for `is_society_admin(auth.uid(), society_id) OR is_admin(auth.uid())`.

### G6 — INFO: SecurityVerifyPage is a deprecated redirect

`/security/verify` redirects to `/guard-kiosk`. No action needed — by design.

### G7 — INFO: Expected visitors check-in bypasses guard logging

`ExpectedVisitorsList.handleQuickCheckIn` updates `visitor_entries` status but does not create a `gate_entries` record, unlike the OTP and delivery flows which log gate entries. This means quick check-ins are invisible in the security audit log.

**Fix**: Add a `gate_entries` insert in `handleQuickCheckIn` for audit completeness.

---

## Phase 2: Test Suite

Create `src/test/security-gate.test.ts` with approximately 60-70 test cases covering:

**Gate Token (edge function logic validation)**
- Token format: encrypted payload + HMAC signature
- Expiry enforcement (60-second window)
- Nonce deduplication blocks replay
- Unverified residents rejected (403)
- Non-officer validators rejected (403)
- Basic mode: immediate entry logged
- Confirmation mode: awaiting_confirmation flag set

**Guard Kiosk Access Control**
- Non-admin, non-officer users see "Access Restricted"
- Security officers see full console
- Society admins see full console
- Feature gate blocks when `guard_kiosk` disabled

**Visitor OTP Verification**
- 6-digit OTP enforced
- Expired OTP rejected
- Valid OTP returns visitor details with resident name
- Check-in updates status
- Deny resets state

**Manual Entry Flow**
- Rate limiting (20/min)
- Realtime subscription for responses
- Approved/denied/expired states render correctly
- Notification enqueued for resident

**Delivery Verification**
- Search by delivery code, rider name, phone
- Allow entry updates status to `at_gate`
- Gate entry logged

**Worker Validation**
- `validate_worker_entry` RPC: active workers pass
- Suspended/blacklisted workers blocked
- Outside shift hours blocked
- No flat assignments blocked
- Entry logged in both `worker_entry_logs` and `gate_entries`

**Visitor Management**
- Add visitor generates 6-digit OTP
- Pre-approved flag controls OTP generation
- Recurring visitors with day selection
- Check-in/check-out/cancel transitions
- OTP copy to clipboard
- Today/Upcoming/History tabs filter correctly

**Parcel Management**
- Resident logs own parcel
- Admin flat lookup flow
- Collect marks as collected with timestamp
- Pending vs collected tab filtering

**Authorized Persons**
- Add with name, relationship, phone, photo
- Remove sets `is_active = false`
- Feature-gated under `visitor_management`

**Security Audit**
- Officers see only their own verifications
- Admins see all entries
- Filters: date range, entry type, status, resident name
- CSV export
- Pagination
- Metrics: today count, manual %, denied %, avg confirm time

**Resident Confirmation**
- Pending entries shown with countdown
- Confirm/deny updates gate entry
- Expired entries blocked by RLS
- Realtime + 5s polling fallback

**Guard Confirmation Poller**
- Countdown from timeout seconds
- Realtime resolves to confirmed/denied
- 4s polling fallback
- Expired state after timeout
- Dedup via `resolvedRef`

---

## Phase 3: Auto-Fixes

### Fix G1 (Critical) — GuardGateLogTab wrong RPC parameter
Replace `_limit: 50` with `_date: new Date().toISOString().split('T')[0]` in the RPC call.

### Fix G2 (Medium) — PendingDeliveries useState misuse
Replace `useState(() => { ... })` with `useEffect(() => { ... }, [societyId])`.

### Fix G3 (Medium) — Remove duplicate manual entry from GuardResidentQRTab
Remove lines 37-143 (manual entry state, realtime subscription, and manual entry card) from `GuardResidentQRTab` since `GuardManualEntryTab` handles this as a dedicated tab.

### Fix G5 (Low) — Parcel INSERT RLS for admin
Add migration: admin/society-admin bypass for parcel inserts.

### Fix G7 (Info) — Expected visitor check-in audit logging
Add `gate_entries` insert in `ExpectedVisitorsList.handleQuickCheckIn`.

---

## Phase 4: Deliverables

1. `.lovable/security-gate-audit.md` — Feature & Rule Inventory with all 7 issues
2. `src/test/security-gate.test.ts` — Full test suite (~65 tests)
3. Code fixes for G1, G2, G3, G5, G7
4. RLS migration for G5
5. Re-run all tests to verify no regressions

---

## Technical Notes

- The gate-token edge function uses AES-GCM encryption + HMAC-SHA256 signing derived from `SUPABASE_SERVICE_ROLE_KEY`
- Nonce deduplication uses the `notes` column with `nonce:` prefix (no dedicated UNIQUE index on nonce — relies on application-level check)
- Security mode is per-society (`basic` or `confirmation`) stored in `societies.security_mode`
- RLS layering: feature gate policies AND role-based policies must both pass (AND semantics)
- `get_unified_gate_log` unions 4 tables: visitor_entries, gate_entries, worker_attendance, delivery_assignments

