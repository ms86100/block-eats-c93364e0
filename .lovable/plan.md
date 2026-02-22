

# Fix: Society Dashboard Shows All Features Regardless of Plan

## Root Cause

The `SocietyDashboardPage.tsx` (lines 97-117) renders ALL feature cards as a **hardcoded list** without ever checking if the feature is enabled for that society. It does not use `useEffectiveFeatures()` or `isFeatureEnabled()` at all.

So when a builder has a plan with only 4 out of 18 features enabled (as shown in your screenshot -- only help_requests, visitor_management, parcel_management, and bulletin are green), the Society Dashboard still shows Visitors, Domestic Help, Parcels, Parking, Finances, Payment Schedule, Construction, Snag Reports, Inspection, Disputes, etc.

The feature gating system works correctly at the **individual page level** (via `FeatureGate` component), but the **dashboard itself** never filters the cards.

## Solution

### 1. Add feature gating to SocietyDashboardPage

**File:** `src/pages/SocietyDashboardPage.tsx`

- Import `useEffectiveFeatures` and `FeatureKey`
- Add a `featureKey` property to each card definition, mapping it to the correct feature key
- Filter the cards array to only show cards whose feature is enabled (or cards with no feature key, like admin-only items)

Card-to-feature mapping:

| Card | Feature Key |
|------|-------------|
| Visitors | `visitor_management` |
| Domestic Help | `domestic_help` |
| Parcels | `parcel_management` |
| Parking | `vehicle_parking` |
| Finances | `finances` |
| Payment Schedule | `payment_milestones` |
| Construction | `construction_progress` |
| Snag Reports | `snag_management` |
| Inspection | `inspection` |
| Disputes | `disputes` |
| Documents | `construction_progress` |
| Q&A | `construction_progress` |
| Maintenance | `maintenance` |
| Guard Kiosk | `guard_kiosk` |
| Security Verify | `resident_identity_verification` |

### 2. What changes in the code

Each card object in the `cards` array gets an optional `featureKey` field. Before rendering the grid, the array is filtered:

```
const visibleCards = cards.filter(card =>
  !card.featureKey || isFeatureEnabled(card.featureKey)
);
```

Only `visibleCards` is rendered in the grid. Cards without a `featureKey` (like "Society Admin" and "Platform Admin") always show.

### 3. Result

After this fix, when Prestige Tranquility's plan only has 4 features enabled (help_requests, visitor_management, parcel_management, bulletin), the Society Dashboard will only show:
- Visitors (visitor_management)
- Parcels (parcel_management)
- Plus any admin-only cards if the user is an admin

Features like Domestic Help, Parking, Finances, Construction, Snags, Inspection, Disputes, etc. will be hidden from the dashboard because they are not in the plan.

## Technical Details

### Modified File
- `src/pages/SocietyDashboardPage.tsx` -- Add `useEffectiveFeatures` hook, tag each card with its `featureKey`, filter before rendering

### No database changes needed
The feature resolution system (`get_effective_society_features` RPC) already works correctly -- the issue is purely that the dashboard UI ignores it.

