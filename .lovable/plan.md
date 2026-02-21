

# Fix: Email/Phone Uniqueness, Preference Persistence, and Nearby Seller Display

## Issue 1 -- Email and Phone Not Enforced as Unique

**Root cause:** The `profiles` table has no unique indexes on `email` or `phone`. The database allows duplicate values in both columns.

**Fix:** Add unique indexes on `profiles.email` and `profiles.phone` via a database migration:

```sql
CREATE UNIQUE INDEX idx_profiles_email_unique ON public.profiles (email) WHERE email IS NOT NULL AND email != '';
CREATE UNIQUE INDEX idx_profiles_phone_unique ON public.profiles (phone) WHERE phone IS NOT NULL AND phone != '';
```

Partial unique indexes are used so that NULL/empty values don't conflict, but any real email or phone can only belong to one user.

Additionally, add client-side validation in the signup form to show a clear error message when a duplicate is detected (the database will reject it, but the user should see a friendly message).

---

## Issue 2 -- Nearby Society Preferences Not Auto-Saved

**Root cause:** This is actually already implemented correctly. The `SearchPage` reads `browse_beyond_community` and `search_radius_km` from the `profiles` table on mount (lines 109-123), and persists changes via `supabase.from('profiles').update(...)` (lines 125-147). Both columns exist in the database (`browse_beyond_community: boolean NOT NULL`, `search_radius_km: integer NOT NULL`).

However, the `ShopByStoreDiscovery` component on the Home Page does NOT use these persisted preferences. It has its own `useNearbySocietySellers` hook that always uses a hardcoded radius of 10 km and doesn't check the user's `browse_beyond_community` preference. Similarly, the `useNearbySellers` hook takes a radius parameter but is not connected to the profile preference.

**Fix:** Update `ShopByStoreDiscovery` to read the user's `browse_beyond_community` and `search_radius_km` from their profile and use those values to control whether the "Nearby Societies" section renders and what radius it queries.

- In `useStoreDiscovery.ts`, modify `useNearbySocietySellers` to accept `radiusKm` and `enabled` parameters instead of hardcoding `_radius_km: 10`.
- In `ShopByStoreDiscovery`, read the profile preferences and pass them to the hook.

---

## Issue 3 -- Nearby Sellers Not Displayed to Buyers

**Root cause:** Multiple factors are preventing nearby sellers from appearing:

### Factor A -- No approved products
The only cross-society seller ("Sagar's Kitchen" in Prestige Tranquility) has `sell_beyond_community = true` and `delivery_radius_km = 8`, but both of its products have `approval_status = 'draft'`. The `search_nearby_sellers` RPC function explicitly requires `EXISTS (SELECT 1 FROM products WHERE is_available = true AND approval_status = 'approved')`. No approved products means the seller is correctly hidden.

### Factor B -- `browse_beyond_community` defaults to false
The profile column `browse_beyond_community` defaults to `false`. On the Search Page, nearby products only load when `browseBeyond` is `true` (line 197). On the Home Page, `ShopByStoreDiscovery` ignores this preference entirely and always queries for nearby sellers, but they won't appear due to Factor A.

### Factor C -- Distance filtering is double-gated
The `search_nearby_sellers` function requires the distance to be within BOTH the seller's `delivery_radius_km` AND the buyer's requested `_radius_km`. If a buyer's society is 9 km away but the seller's delivery radius is 8 km, the seller won't appear even if the buyer requests 10 km.

**Fix (code-side):**
1. No code changes needed for Factor A -- this is correct behavior (don't show empty stores). The real fix is operational: sellers need to submit products for approval.
2. For Factor B: ensure the "Browse nearby" toggle on the Search Page is more visible and consider defaulting new users to `true` to showcase the feature.
3. For Factor C: no code change needed -- this is intended business logic.

**Recommendation:** The primary reason buyers see no nearby sellers is that no sellers have approved products with `sell_beyond_community = true`. This is a data/operational issue, not a code bug. However, the Home Page `ShopByStoreDiscovery` should respect the user's persisted preferences, which is a code fix.

---

## Technical Implementation

### Migration (Issue 1)

```sql
-- Enforce unique email and phone on profiles
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_unique 
  ON public.profiles (email) WHERE email IS NOT NULL AND email != '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_phone_unique 
  ON public.profiles (phone) WHERE phone IS NOT NULL AND phone != '';
```

### Code Changes

**File: `src/hooks/queries/useStoreDiscovery.ts`**
- Modify `useNearbySocietySellers()` to accept `radiusKm` and `enabled` parameters
- Pass `radiusKm` to the RPC call instead of hardcoded `10`
- Use `enabled` to control whether the query runs

**File: `src/components/home/ShopByStoreDiscovery.tsx`**
- Read `profile.browse_beyond_community` and `profile.search_radius_km` from auth context or a direct profile query
- Pass these to `useNearbySocietySellers(radiusKm, enabled)`
- Only render the "Nearby Societies" section when the user has opted in

**File: `src/pages/AuthPage.tsx` (or signup handler)**
- Add error handling for unique constraint violations on email/phone
- Show user-friendly messages like "This email is already registered" or "This phone number is already in use"

