

# Marketplace Discovery Redesign: "So Easy a 5-Year-Old Can Find It"

## The Problem

The current search page is a **blank screen with a search bar**. A user must already know what they want and type it in. There is no visual browsing, no category exploration, and no "trending" or "popular" section. This is the opposite of intuitive -- it's like walking into a mall with no signs, no storefronts, and just a blank reception desk.

## The Solution: A Visual-First Marketplace

Transform the search page into a **marketplace home** with three layers of discovery:

1. **Category Bubbles** -- Colorful, tappable icons at the top (pulled from the admin-configured `category_config` table). Tapping one instantly filters results.
2. **Popular / Trending Products** -- On page load (before any search), show a curated grid of products from all categories so users immediately see what's available.
3. **Search + Filter** -- The existing search bar remains, but now it overlays on top of a page that already has content.

Think of it like a kid's app store: big icons, bright colors, instant results.

## What Changes

### 1. Idle State becomes "Browse Everything"

Instead of showing "Search for products across sellers" when the user hasn't typed anything, the page will:
- Show a **scrollable row of category icons** (from `category_config`) at the top
- Tapping a category icon sets a category filter and shows all products in that category
- Below the categories, show a **"Popular Near You"** section with products loaded from the database immediately on mount
- This means the page is never empty -- there's always something to explore

### 2. Category Quick-Filter Row

A horizontally scrollable row of the admin-configured categories with their emoji icons (from `category_config`):
```
[Home Food] [Bakery] [Yoga] [Tuition] [Electrician] [Tailoring] [Pet Grooming] [Rentals] ...
```
- Tapping one filters results to that category
- Tapping again deselects it
- Active category is highlighted with a colored background

### 3. "Popular Near You" Default Results

On page load, fetch products without a search term -- just the top ~20 products from same-society sellers (and cross-society if toggled on), sorted by seller rating. This gives the page instant content.

### 4. Seed Dummy Data for Empty Categories

Currently, 37 categories have zero products. The plan will seed products across the most important empty categories to ensure a rich browsing experience:
- **Services**: Plumber, AC Service, Carpenter, Pest Control, Maid, Cook
- **Personal**: Beauty, Salon, Laundry, Mehendi  
- **Classes**: Dance, Music, Art & Craft, Language, Coaching
- **Events**: Catering, Decoration, DJ & Music
- **Resale**: Toys, Kitchen, Clothing
- **Pets**: Pet Food
- **Rentals**: Vehicle, Baby Gear
- **Professional**: IT Support, Tax Consultant, Tutoring

This requires creating new seller profiles for categories that don't have sellers yet, and adding products to them.

### 5. Product Card Enhancement

Each product card already shows good info. Minor improvements:
- Show the category emoji icon next to the category label for visual scanning
- Make the category label use the `display_name` from `category_config` (dynamic, not hardcoded)

## Technical Details

### Files Modified

**`src/pages/SearchPage.tsx`** (significant changes):
- Import `useCategoryConfigs` hook to get dynamic category list with icons/colors
- Add a `selectedCategory` state that filters products by category
- Add a category icon row component (horizontally scrollable, uses category_config data)
- Modify the idle state: instead of showing a static message, call a new `loadPopularProducts()` function on mount that fetches top-rated products without a search term
- When a category is tapped, set `selectedCategory` and trigger search with empty query but category filter
- Remove hardcoded `CATEGORY_LABELS` map -- use `category_config` display names dynamically
- Update `ProductResultCard` to show category emoji from config

**`loadPopularProducts()` logic:**
- Query `products` table directly (joined with `seller_profiles` and `societies`), filtered by `is_available = true` and `verification_status = 'approved'`
- Scoped to user's society (and nearby if browse-beyond is on)
- Sorted by seller rating descending
- Limited to 30 items
- This replaces the empty idle state

**`category icon row` logic:**
- Uses `useCategoryConfigs()` to get all active categories
- Only shows categories that have at least 1 available product (filter client-side after fetching product counts, or show all and let empty results speak)
- Scrollable horizontal row with emoji + name

### Database Changes (Migration)

**Seed new seller profiles and products** for empty categories. This requires:

1. New seller profiles in Shriram Greenfield (and some in nearby societies) for service categories like plumber, carpenter, beauty, salon, etc.
2. Products for each new seller with realistic names, prices, and Unsplash image URLs
3. Approved seller licenses where needed (food group sellers)

Approximately:
- 8-10 new seller profiles across Shriram Greenfield and nearby societies
- 60-80 new products covering 25+ currently-empty categories
- Each product with a realistic image URL, price, and description

### No Schema Changes Needed
- The `category_config`, `products`, `seller_profiles` tables already support everything needed
- The `search_marketplace` and `search_nearby_sellers` RPCs already support category filtering

### Search Flow After Changes

1. **Page loads** -> Category icons appear at top -> "Popular Near You" products load below (never empty)
2. **User taps a category** (e.g., "Plumber") -> Results filter to plumber services only
3. **User types in search** -> Works as before, but now also respects selected category
4. **User taps category again** -> Deselects, shows all results again
5. **Browse beyond toggle** -> Expands results to include nearby societies (persisted to DB)

