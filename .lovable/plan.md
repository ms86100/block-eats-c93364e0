

## Fix: "Nearby Societies" Default + Toggle Reset Bug

### Problem 1: Default values are wrong
New users get `browse_beyond_community = false` and `search_radius_km = 5` in the database. They should default to `true` and `10`.

### Problem 2: Toggle resets when navigating
The Search page initializes `browseBeyond = false` in local state, then asynchronously loads the real value from the DB. When you navigate away (e.g., tap a category) and return, the component remounts with `false` again, briefly showing the wrong state and fetching wrong data.

### Fix

**Change 1: Database migration** -- Alter column defaults to `true` and `10`, and update all existing profiles that still have the old defaults.

```sql
ALTER TABLE public.profiles
  ALTER COLUMN browse_beyond_community SET DEFAULT true;
ALTER TABLE public.profiles
  ALTER COLUMN search_radius_km SET DEFAULT 10;

-- Update existing users who still have old defaults
UPDATE public.profiles
  SET browse_beyond_community = true
  WHERE browse_beyond_community = false;
UPDATE public.profiles
  SET search_radius_km = 10
  WHERE search_radius_km = 5;
```

**Change 2: SearchPage.tsx** -- Initialize `browseBeyond` from the auth context profile (which is already loaded) instead of starting at `false` and fetching again. This eliminates the remount-reset bug entirely.

- Line 105: Change `useState(false)` to `useState(profile?.browse_beyond_community ?? true)`
- Line 106: Change `useState(10)` to `useState(profile?.search_radius_km ?? 10)`
- Remove the redundant `useEffect` (lines 109-123) that re-fetches from DB -- the auth context `profile` already has this data.

**Change 3: All other components** -- Update fallback defaults from `false`/`5` to `true`/`10` in:
- `src/components/home/ShopByStoreDiscovery.tsx` (line 20): `?? false` to `?? true`
- `src/hooks/queries/useNearbyProducts.ts` (line 19): `=== true` to `!== false` (or just `?? true`)
- `src/pages/CategoriesPage.tsx` (line 34): `?? false` to `?? true`

### Files Changed

1. **Database migration** -- Change column defaults and backfill existing rows
2. **`src/pages/SearchPage.tsx`** -- Use profile from auth context, remove redundant DB fetch, fix initial state
3. **`src/components/home/ShopByStoreDiscovery.tsx`** -- Fix fallback default
4. **`src/hooks/queries/useNearbyProducts.ts`** -- Fix fallback default
5. **`src/pages/CategoriesPage.tsx`** -- Fix fallback default
