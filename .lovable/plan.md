

# Search Page Redesign + Preference Persistence

## Problem
1. The "Browse beyond my community" toggle on the Search page does NOT persist to the database (unlike HomePage which already does)
2. The search results show seller-level cards, but when a user searches for an item (e.g., "biryani"), they want to see **product-level results** with trust signals like rating, distance, seller name, price, veg/non-veg badge -- not just grouped under a seller card
3. The current UI is cluttered with too many sections competing for attention

## What Changes

### 1. Persist Browse Preference (SearchPage)
- Add the same `persistPreference` pattern from `HomePage.tsx` to `SearchPage.tsx`
- When user toggles "Browse beyond" or changes radius slider, save to `profiles` table immediately
- Initialize state from `profile.browse_beyond_community` and `profile.search_radius_km`

### 2. Unified Product-First Search
When a user types a search term (e.g., "biryani"), the results should show **individual product cards** (not seller cards) with rich trust/context info:

Each product result card will show:
- Product image, name, price
- Veg/Non-veg badge
- Seller name + seller rating (stars)
- Distance badge (e.g., "1.2 km away") for cross-society sellers, or "Your community" for same-society
- Society name for cross-society items
- Category tag (Food, Education, Pets, etc.)

### 3. Combined Search Logic
When "Browse beyond" is ON and user searches:
- Search **both** same-society sellers (via `search_marketplace` RPC) AND cross-society sellers (via `search_nearby_sellers` RPC with `_search_term`)
- Merge results and flatten to product-level cards
- Sort by relevance, then distance

When "Browse beyond" is OFF:
- Search only same-society sellers (existing behavior)

### 4. Cleaner UI Layout
- Search bar at top (unchanged)
- Filter presets row (unchanged)
- "Browse beyond" toggle as a compact inline chip/toggle, not a giant card
- Results area: product-level cards in a clean list
- Each card is tappable, linking to the seller's page

## Technical Details

### Files Modified

**`src/pages/SearchPage.tsx`** (major rewrite):
- Add `persistPreference` callback (same as HomePage)
- Wrap `setBrowseBeyond` and `setSearchRadius` with DB persistence
- New `searchAll()` function that calls both RPCs when browse-beyond is enabled
- Flatten results into a unified `ProductSearchResult` interface:
  ```
  { product_id, product_name, price, image_url, is_veg, category,
    seller_id, seller_name, seller_rating, seller_reviews,
    society_name, distance_km, is_same_society }
  ```
- New product result card component (inline) showing all trust signals
- Compact browse-beyond toggle (small card, not full-width section)
- Remove the separate "Nearby Sellers" section (merged into search results)

### No Database Changes Needed
- The `search_nearby_sellers` RPC already accepts `_search_term` and `_category` params
- The `search_marketplace` RPC already returns matching products
- `profiles` table already has `browse_beyond_community` and `search_radius_km` columns
- All persistence logic already proven in `HomePage.tsx`

### Search Flow
1. User types "biryani"
2. If browse-beyond OFF: call `search_marketplace('biryani', society_id)` -> flatten matching_products from each seller
3. If browse-beyond ON: call BOTH RPCs in parallel -> merge + deduplicate by product_id -> sort by distance (same society first, then nearest)
4. Display as product cards with seller context

### Product Result Card Design
```
+------------------------------------------+
| [img] Chicken Biryani          ₹180      |
|       Veg badge   |  home_food           |
|       Lakeside Kitchen  * 4.6 (12)       |
|       Prestige Lakeside  |  1.2 km away  |
+------------------------------------------+
```
