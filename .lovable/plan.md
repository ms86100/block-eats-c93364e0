

## Default Buyer Search Radius to 10 km

### What Changes

1. **Database: Change column default from 5 to 10**
   - Alter `profiles.search_radius_km` default from `5` to `10`
   - Update all existing buyers who still have `5` (the old default) to `10`

2. **Database: Update the validation trigger**
   - The `validate_search_radius` trigger currently caps `search_radius_km` between 1 and 10. This stays valid since 10 is within range. No trigger change needed.

3. **Frontend: Update fallback values from 5 to 10**
   - `src/pages/SearchPage.tsx` — change `useState(5)` to `useState(10)` and the two `?? 5` fallbacks to `?? 10`
   - `src/hooks/queries/useNearbyProducts.ts` — change `?? 5` fallback to `?? 10`
   - `src/components/home/ShopByStoreDiscovery.tsx` — change `?? 5` fallback to `?? 10`

### Technical Details

**Migration SQL:**
```sql
ALTER TABLE profiles ALTER COLUMN search_radius_km SET DEFAULT 10;
UPDATE profiles SET search_radius_km = 10 WHERE search_radius_km = 5;
```

**Frontend changes (3 files, one-line each):**
- `SearchPage.tsx` line 106: `useState(5)` to `useState(10)`
- `SearchPage.tsx` line 119: `?? 5` to `?? 10`
- `useNearbyProducts.ts` line 20: `?? 5` to `?? 10`
- `ShopByStoreDiscovery.tsx` line 21: `?? 5` to `?? 10`

### Scope
One migration + 4 one-line frontend edits across 3 files. Buyers can still reduce the radius via the slider; the new default is simply 10 km instead of 5.

