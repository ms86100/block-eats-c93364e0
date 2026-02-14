

# Multi-Tenant Context Switching -- 6-Point Verification Fix

## Summary

This plan fixes 5 audit failures across the context switching system: (1) migrate 20+ files from `profile.society_id` to `effectiveSocietyId` for reads, (2) fix React Query cache key pollution, (3) create a `FeatureGate` component for route-level guards, (4) add write-path visual guards, and (5) add a missing database index.

---

## Phase 1: Cache Key Fix (CRITICAL)

**File: `src/hooks/queries/useHomeSellers.ts`**

All 4 seller hooks use `profile?.society_id` in query keys and query functions. Replace with `effectiveSocietyId` from `useAuth()`.

Changes:
- Destructure `effectiveSocietyId` instead of `profile` (keep `profile` only for `block` in nearby sellers)
- Replace all `profile?.society_id` in `queryKey` arrays with `effectiveSocietyId`
- Replace all `profile.society_id` / `profile!.society_id!` in query functions with `effectiveSocietyId`
- Replace `enabled` conditions: `!!profile?.society_id` becomes `!!effectiveSocietyId`

---

## Phase 2: Read Path Migration (11 Pages + 4 Components)

Each change is mechanical: destructure `effectiveSocietyId` from `useAuth()`, replace society_id references in SELECT queries and `useEffect` dependencies.

### Pages

| File | Current Reference | Change |
|---|---|---|
| `BulletinPage.tsx` (line 40, 60, 63) | `profile?.society_id` | Use `effectiveSocietyId` in fetchPosts, fetchMostDiscussed, fetchHelp guards and deps |
| `CategoryPage.tsx` (lines 36-37, 25) | `profile?.society_id` / `profile.society_id` | Use `effectiveSocietyId` in query filter and useEffect dep |
| `CategoryGroupPage.tsx` (lines 51-52) | `profile?.society_id` / `profile.society_id` | Use `effectiveSocietyId` in query filter |
| `SearchPage.tsx` (lines 128, 165-166) | `profile?.society_id` | Use `effectiveSocietyId` in RPC call and query builder |
| `MaintenancePage.tsx` (lines 37, 41) | `profile?.society_id` / `profile.society_id` | Use `effectiveSocietyId` for READ queries only; keep `profile.society_id` for bulk generate INSERT (line 72) |
| `SocietyReportPage.tsx` (lines 39-41) | `profile?.society_id` | Use `effectiveSocietyId` in guard and deps |
| `SocietyProgressPage.tsx` (lines 50, 60, 109-110) | `society?.id` | Use `effectiveSocietyId` instead of `society?.id` |
| `SnagListPage.tsx` (lines 37, 47) | `society?.id` | Use `effectiveSocietyId` instead of `society?.id` |
| `FavoritesPage.tsx` (line 41) | `profile?.society_id` | Use `effectiveSocietyId` in client-side filter |
| `SellerDetailPage.tsx` (line 81) | `authProfile?.society_id` | Use `effectiveSocietyId` |
| `TrustDirectoryPage.tsx` | `profile.society_id` used only on INSERT (line 73) | No read-path change needed; this is a write -- keep as-is |

### Components (Read Path Only)

| File | Current Reference | Change |
|---|---|---|
| `ActivityFeed.tsx` (lines 15, 25, 32, 35, 39) | `profile?.society_id` / `profile.society_id` | Use `effectiveSocietyId` for fetch + realtime subscription filter + useEffect dep |
| `SocietyTrustBadge.tsx` (lines 24, 31, 37, 39) | `profile?.society_id` / `profile.society_id!` | Use `effectiveSocietyId` for score fetch |
| `DocumentVaultTab.tsx` (lines 37, 41) | `society?.id` | Use `effectiveSocietyId` |
| `ProjectQATab.tsx` (lines 54, 59) | `society?.id` | Use `effectiveSocietyId` |
| `TrustScoreDetailed.tsx` (lines 35, 37) | `profile?.society_id` | Use `effectiveSocietyId` |
| `AdminDisputesTab.tsx` (line 31) | `profile?.society_id` | Use `effectiveSocietyId` |
| `CouponInput.tsx` (lines 23, 32) | `profile?.society_id` / `profile.society_id` | Use `effectiveSocietyId` for coupon lookup (read); keep for validation guard |

---

## Phase 3: Write Path Guards

**Design decision: INSERT operations keep `profile.society_id` (user's real society).**

An admin "viewing as" Society B should NOT create content in Society B. They are viewing, not impersonating.

### Components with INSERT operations (NO society_id change, but ADD visual guard)

These 10 components insert data with `profile.society_id` -- correct behavior. Add a guard that disables the create action when `viewAsSocietyId` is set:

| Component | Guard Logic |
|---|---|
| `CreatePostSheet.tsx` | Disable submit when `viewAsSocietyId` is set |
| `CreateHelpSheet.tsx` | Disable submit when `viewAsSocietyId` is set |
| `CreateDisputeSheet.tsx` | Disable submit when `viewAsSocietyId` is set |
| `CreateSnagSheet.tsx` | Disable submit when `viewAsSocietyId` is set |
| `AddMilestoneSheet.tsx` | Disable submit when `viewAsSocietyId` is set |
| `AddExpenseSheet.tsx` | Disable submit when `viewAsSocietyId` is set |
| `AddDocumentSheet.tsx` | Disable submit when `viewAsSocietyId` is set |
| `AskQuestionSheet.tsx` | Disable submit when `viewAsSocietyId` is set |
| `EmergencyBroadcastSheet.tsx` | Disable submit when `viewAsSocietyId` is set |
| `CouponManager.tsx` | Disable create when `viewAsSocietyId` is set |

Implementation: Each component already uses `useAuth()`. Add `viewAsSocietyId` to destructure. Before the submit button, if `viewAsSocietyId` is set, show a small info banner: "You are viewing another society. Switch back to create content." and disable the submit button.

**Special cases:**
- `MaintenancePage.tsx` bulk generate (line 72): Uses `profile.society_id` for INSERT -- correct, keep as-is, add guard
- `TrustDirectoryPage.tsx` skill listing INSERT (line 73): Keep `profile.society_id`, add guard
- `BecomeSellerPage.tsx` (line 157): Keep `profile?.society_id` -- user registers as seller in their OWN society only

---

## Phase 4: Feature Gate Component

**New file: `src/components/ui/FeatureGate.tsx`**

```text
Props:
  - feature: FeatureKey (from useSocietyFeatures)
  - children: ReactNode
  - fallback?: ReactNode (optional custom disabled message)

Behavior:
  - Loading -> show skeleton
  - Feature disabled -> show "This feature is not available in your society" message
  - Feature enabled -> render children
```

### Apply FeatureGate to pages

Wrap the main content of these pages inside `<FeatureGate>`:

| Page | Feature Key |
|---|---|
| `BulletinPage.tsx` | `bulletin` |
| `DisputesPage.tsx` | `disputes` |
| `SocietyFinancesPage.tsx` | `finances` |
| `SocietyProgressPage.tsx` | `construction_progress` |
| `SnagListPage.tsx` | `snag_management` |

### Update BottomNav

Modify `BottomNav.tsx` to:
1. Import `useSocietyFeatures` hook
2. Map nav items to feature keys: `{ '/community': 'bulletin', '/society': null }` (society always visible)
3. Filter out nav items whose mapped feature is disabled
4. Keep Home and Profile always visible

---

## Phase 5: Database Index

**Migration SQL:**

```sql
CREATE INDEX IF NOT EXISTS idx_user_notifications_society_id
ON user_notifications(society_id) WHERE society_id IS NOT NULL;
```

---

## Implementation Order

1. Database migration (index) -- no code dependency
2. `useHomeSellers.ts` cache key fix -- prevents data corruption
3. Read path migration (11 pages + 6 components) -- all mechanical swaps
4. `FeatureGate.tsx` component creation + page wrappers
5. `BottomNav.tsx` feature flag integration
6. Write path guards (10 components) -- add `viewAsSocietyId` check + info banner

---

## Files Summary

| Category | Files | Count |
|---|---|---|
| Cache key fix | `useHomeSellers.ts` | 1 |
| Read path pages | BulletinPage, CategoryPage, CategoryGroupPage, SearchPage, MaintenancePage, SocietyReportPage, SocietyProgressPage, SnagListPage, FavoritesPage, SellerDetailPage | 10 |
| Read path components | ActivityFeed, SocietyTrustBadge, DocumentVaultTab, ProjectQATab, TrustScoreDetailed, AdminDisputesTab, CouponInput | 7 |
| Write path guards | CreatePostSheet, CreateHelpSheet, CreateDisputeSheet, CreateSnagSheet, AddMilestoneSheet, AddExpenseSheet, AddDocumentSheet, AskQuestionSheet, EmergencyBroadcastSheet, CouponManager | 10 |
| New component | `FeatureGate.tsx` | 1 |
| Nav update | `BottomNav.tsx` | 1 |
| Database migration | Index on `user_notifications(society_id)` | 1 |
| **Total** | | **31 files** |

---

## Risk Assessment

| Change | Risk | Mitigation |
|---|---|---|
| Read path migration (17 files) | MEDIUM -- many files | Each is a variable swap; no logic changes; RLS still enforces access |
| Cache key fix | LOW | Fixes a bug; one-time re-fetch after deploy |
| FeatureGate + BottomNav | LOW | Default is "enabled" when no record exists; no feature breaks |
| Write path guards | LOW | UI-only; RLS still blocks unauthorized writes regardless |
| DB index | NONE | Additive, non-blocking |

