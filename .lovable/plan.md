
# Distance and Nearby Seller Discovery -- Logic Audit Report

## 1. Distance Logic Map

```text
Buyer Profile                         Seller Profile
+-------------------------------+     +----------------------------------+
| browse_beyond_community (bool)|     | sell_beyond_community (bool)     |
| search_radius_km (1-10 int)   |     | delivery_radius_km (1-10 int)    |
| society_id -> society.lat/lon |     | society_id -> society.lat/lon    |
+-------------------------------+     +----------------------------------+
        |                                       |
        v                                       v
+--------------------------------------------------------------------+
| search_nearby_sellers(_buyer_society_id, _radius_km)               |
|                                                                    |
| 1. Lookup buyer society lat/lon (FAIL if NULL)                     |
| 2. Filter sellers WHERE:                                           |
|    a. verification_status = 'approved'                             |
|    b. society_id != buyer_society_id                               |
|    c. sell_beyond_community = true                                 |
|    d. seller society has lat/lon (NOT NULL)                        |
|    e. haversine(buyer, seller) <= seller.delivery_radius_km        |
|    f. haversine(buyer, seller) <= _radius_km (buyer param)         |
|    g. EXISTS at least 1 product: is_available=true,                |
|       approval_status='approved'                                   |
| 3. ORDER BY distance ASC, is_featured DESC, rating DESC            |
+--------------------------------------------------------------------+
        |
        v
+--------------------------------------------------------------------+
| Frontend Consumption                                               |
|                                                                    |
| Home Page (ShopByStoreDiscovery):                                  |
|   - Reads profile.browse_beyond_community (dynamic)                |
|   - Reads profile.search_radius_km (dynamic)                      |
|   - Passes both to useNearbySocietySellers(radiusKm, enabled)      |
|   - Query only fires when browse_beyond_community = true           |
|                                                                    |
| Search Page:                                                       |
|   - Loads prefs from DB on mount (browse_beyond_community,         |
|     search_radius_km)                                              |
|   - Passes searchRadius to search_nearby_sellers RPC               |
|   - Only calls RPC when browseBeyond = true                        |
|                                                                    |
| Orphan Hook (useNearbySellers.ts):                                 |
|   - Accepts radiusKm + enabled params                              |
|   - NOT imported anywhere in the codebase (dead code)              |
+--------------------------------------------------------------------+
```

---

## 2. Hardcoded vs Dynamic Matrix

| Layer | Hardcoded | Dynamic | Notes |
|-------|-----------|---------|-------|
| Buyer radius (Home) | No | Yes | Reads `profile.search_radius_km`, fallback 5 km |
| Buyer radius (Search) | No | Yes | Loads from DB, persists changes, fallback 5 km |
| Buyer browse toggle (Home) | No | Yes | Reads `profile.browse_beyond_community`, fallback `false` |
| Buyer browse toggle (Search) | No | Yes | Loads from DB, persists changes |
| Seller delivery_radius_km | No | Yes | Stored per seller, validated 1-10 km by trigger |
| Seller sell_beyond_community | No | Yes | Boolean per seller |
| SQL RPC _radius_km param | No | Yes | Passed from frontend |
| Distance bands (frontend) | YES | No | Hardcoded: 0-2, 2-5, 5-10 km in `useStoreDiscovery.ts` lines 103-107. If buyer radius is 3 km, the "Within 5 km" and "Within 10 km" bands are rendered but will always be empty. This is cosmetic, not a data issue. |
| Fallback defaults | YES | -- | `browse_beyond_community` defaults to `false`, `search_radius_km` defaults to 5. Both are column defaults in DB and fallback values in frontend. |

---

## 3. Audit Question Answers

### Q1: Buyer Radius Source of Truth

- **Source:** `profiles.search_radius_km` (integer, NOT NULL, default 5, validated 1-10 by trigger)
- **Persisted:** Yes, via Search Page toggle (writes to DB on change)
- **Read by:** Home Page (`ShopByStoreDiscovery`), Search Page -- both read from `profile` in auth context or direct DB query
- **Ignored by:** Nothing. All discovery surfaces now respect it (fixed in the previous round).
- **Conclusion:** Buyer radius is DYNAMIC and consistent across all surfaces.

### Q2: Seller Delivery Radius Logic

- **Storage:** `seller_profiles.delivery_radius_km` (integer, default 5, validated 1-10 by trigger)
- **Mandatory:** Has a default (5), so effectively always present
- **Hard constraint:** YES. The RPC filters with `haversine <= delivery_radius_km`. If distance is 9 km and seller radius is 8 km, the seller is excluded even if buyer requests 10 km.
- **`sell_beyond_community`:** Also a hard constraint. If `false`, seller is excluded from cross-society results entirely.
- **Filter order:** `sell_beyond_community` is checked BEFORE distance (it's a WHERE clause, not a subquery). Sellers with `false` are eliminated before distance is even computed.

### Q3: Distance Calculation Implementation

- **Method:** Haversine formula via `public.haversine_km()` SQL function
- **Units:** Kilometers
- **Computed:** In PostgreSQL (inside the `search_nearby_sellers` RPC)
- **Coordinates:** Society-level (`societies.latitude`, `societies.longitude`), NOT individual addresses
- **NULL handling:** If buyer society has NULL lat/lon, the function raises an exception. If seller society has NULL lat/lon, that seller is excluded via WHERE clause (`s.latitude IS NOT NULL AND s.longitude IS NOT NULL`).
- **Conclusion:** Distance calculation is DYNAMIC, server-side, and correctly implemented.

### Q4: Double Gating and Filter Order

The `search_nearby_sellers` WHERE clause applies these filters (in SQL evaluation order):

1. `sp.verification_status = 'approved'` -- Seller must be approved
2. `sp.society_id != _buyer_society_id` -- Must be cross-society
3. `sp.sell_beyond_community = true` -- Seller opted in
4. `s.latitude IS NOT NULL AND s.longitude IS NOT NULL` -- Coordinates exist
5. `haversine <= sp.delivery_radius_km` -- Within seller's delivery reach
6. `haversine <= _radius_km` -- Within buyer's search radius
7. `EXISTS (product: is_available=true AND approval_status='approved')` -- Has at least one live product

**Which filter eliminates most?** Filter 7 (product approval). See root cause analysis below.

### Q5: Frontend Discovery Consumption

| Surface | Hook/Query | Radius Source | Prefs Respected | Consistent |
|---------|-----------|---------------|-----------------|------------|
| Home Page (Nearby Societies) | `useNearbySocietySellers(radiusKm, browseBeyond)` | `profile.search_radius_km` | Yes | Yes |
| Search Page (Popular) | Direct `search_nearby_sellers` RPC | `searchRadius` from DB | Yes | Yes |
| Search Page (Active Search) | Direct `search_nearby_sellers` RPC | `searchRadius` from DB | Yes | Yes |
| `useNearbySellers.ts` | Standalone hook | Accepts params | N/A (dead code) | N/A |

**Conclusion:** All active discovery surfaces are consistent. No hardcoded radius in any active code path.

### Q6: Root Cause -- Why Buyers See No Nearby Sellers

| Rank | Cause | Type | Side | Details |
|------|-------|------|------|---------|
| 1 | **No approved products** | Data readiness | Seller-side | The only cross-society seller ("Sagar's Kitchen" in Prestige Tranquility) has `sell_beyond_community=true` and `delivery_radius_km=8`, but BOTH products ("Chicken", "Paneer") have `approval_status='draft'`. The RPC requires at least one `approved` + `is_available=true` product. This is **intended behavior** -- empty stores should not appear. |
| 2 | **`browse_beyond_community` defaults to `false`** | Intended default | Buyer-side | New users default to `false`, so the nearby query never fires until the buyer explicitly enables it on the Search Page. This is **intended behavior** but means no buyer sees nearby sellers out of the box. |
| 3 | **Distance exceeds seller delivery radius** | Intended logic | Both sides | Prestige Tranquility to Shriram Greenfield = 4.5 km (within 8 km delivery radius). Prestige Tranquility to Hilltop Heights = 10.8 km (exceeds 8 km). Prestige Tranquility to Lakeside Towers = 16.0 km (exceeds 8 km). So even with approved products, only Shriram Greenfield buyers would see this seller. **Intended behavior.** |
| 4 | **No buyers in Shriram Greenfield** | Data readiness | Buyer-side | No profiles are registered in the Shriram Greenfield society (`society_id = '7d69a79d-...'`), so there is literally no buyer who could see the closest cross-society seller. |

**Summary:** The code logic is correct and consistent. The reason buyers see no nearby sellers is entirely a data readiness issue: the only cross-society seller has no approved products, and the only society within its delivery radius has no registered buyers.

---

## 4. Failure Mode Analysis

| Scenario | Seller Excluded? | Reason | Intended? |
|----------|-----------------|--------|-----------|
| Seller has `sell_beyond_community = false` | Yes | Hard filter in RPC | Yes |
| Seller has 0 approved products | Yes | EXISTS check in RPC | Yes |
| Distance > seller's `delivery_radius_km` | Yes | Double-gate filter | Yes |
| Distance > buyer's `search_radius_km` | Yes | Double-gate filter | Yes |
| Buyer has `browse_beyond_community = false` | Yes (query never fires) | Frontend gating | Yes |
| Seller society has NULL lat/lon | Yes | WHERE clause | Yes |
| Buyer society has NULL lat/lon | Error raised | RPC exception | Yes (fail-fast) |
| Buyer radius = 3 km, seller at 4 km but within seller's delivery radius | Yes | Buyer radius is the tighter constraint | Yes |

No unintended exclusions found. All filtering is intentional.

---

## 5. Dead Code Cleanup (Optional, Non-Breaking)

**File:** `src/hooks/queries/useNearbySellers.ts`

This hook is not imported anywhere in the codebase. It duplicates the logic in `useStoreDiscovery.ts > useNearbySocietySellers()`. It can be safely deleted to reduce confusion.

---

## 6. Minor Cosmetic Issue (Optional)

**File:** `src/hooks/queries/useStoreDiscovery.ts` (lines 103-107)

The distance band labels are hardcoded to "Within 2 km", "Within 5 km", "Within 10 km" regardless of the buyer's actual `search_radius_km`. If a buyer sets their radius to 3 km, the "Within 5 km" and "Within 10 km" bands render as empty sections (and are filtered out by line 135). This works correctly but could be refined to only show bands up to the buyer's radius. This is purely cosmetic and low priority.

---

## Final Verdict

The distance logic is **correctly implemented, fully dynamic, and consistently applied** across all active discovery surfaces. There are no hardcoded radius values in any active code path, and all buyer preferences are persisted and respected.

The root cause of "no nearby sellers" is **100% data readiness**: no seller has approved products with cross-society delivery enabled in a reachable distance from any buyer with `browse_beyond_community` turned on.
