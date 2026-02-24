

# Performance Optimization Plan — 18 Key Fixes

## Problem Summary

The application has severe UI sluggishness across all interactions: page navigation, search, product listing scrolling, and general clicks. After a thorough audit of the codebase, I identified **18 concrete performance bottlenecks** grouped into four categories.

---

## Category A: Hook Cascade — Every Card Triggers 4+ DB Queries

**The single biggest problem.** Each `ProductListingCard` independently calls three hooks that each fire their own database query:

- `useCategoryConfigs()` — fetches all category configs
- `useMarketplaceConfig()` — fetches system_settings + admin_settings (2 queries)
- `useBadgeConfig()` — fetches badge_config

On the home page with ~30 product cards, this means React Query deduplicates but still has to **check cache, compare keys, and re-render subscribers** for 3 hooks x 30 cards = **90 hook evaluations per render cycle**.

### Fix 1: Lift shared config hooks out of ProductListingCard

Move `useCategoryConfigs`, `useMarketplaceConfig`, and `useBadgeConfig` to the **parent** component (e.g., `MarketplaceSection`, `SearchPage`) and pass the resolved values as props. The card becomes a pure presentational component.

### Fix 2: Memoize ProductListingCard with React.memo

Wrap the component in `React.memo` with a custom comparator that checks only `product.id`, `quantity`, and layout. Currently every parent re-render re-renders all 30+ cards.

### Fix 3: Remove useCardAnalytics IntersectionObserver per card

Each card creates its own `IntersectionObserver`. With 30 cards that's 30 observers. Replace with a **single shared observer** at the list level that tracks all card refs.

---

## Category B: Redundant & Cascading Data Fetching

### Fix 4: useSearchPlaceholder triggers a full product fetch (limit=200)

`useSearchPlaceholder` calls `useProductsByCategory(200)` just to extract category display names for the typewriter animation. This fires a **200-product query + the nearby sellers RPC** on every page that shows the Header (which is every page). Replace with a lightweight query that fetches only category names from `category_config`.

### Fix 5: useProductsByCategory fires useNearbyProducts internally

`useProductsByCategory` imports and calls `useNearbyProducts()`, which fires `search_nearby_sellers` RPC. Combined with Fix 4, this means the nearby sellers RPC fires **twice** on the home page (once for the header placeholder, once for the marketplace section).

Fix: Extract nearby products call to only run inside `MarketplaceSection`, not inside the shared hook. The hook should only return local products.

### Fix 6: SearchPage loads popular products with raw supabase calls instead of React Query

`SearchPage.loadPopularProducts()` uses `useState` + `useEffect` + raw `supabase.from()` calls instead of `useQuery`. This means:
- No caching — re-fetches on every mount
- No deduplication with existing queries
- Fires **both** a products query AND `search_nearby_sellers` RPC on mount

Fix: Rewrite to use `useQuery` with a dedicated key, or reuse `useProductsByCategory`.

### Fix 7: Duplicate search_nearby_sellers calls across components

The RPC fires from: `useNearbyProducts`, `useNearbySocietySellers`, `SearchPage.loadPopularProducts`, and `SearchPage.runSearch`. On the home page alone it fires 2-3 times.

Fix: Consolidate into a single cached query with `useQuery`, shared across all consumers via the same query key.

### Fix 8: AuthProvider fires get_user_auth_context twice on mount

In `useAuthState`, both `onAuthStateChange` and `getSession()` fire `fetchProfile()`, causing a double-call to the `get_user_auth_context` RPC on every app load. Add a guard flag to skip the redundant call.

---

## Category C: Render Performance & Re-render Storms

### Fix 9: Legacy AuthContext is not memoized

`AuthProvider` creates a new `legacyValue` object on every render (line 54-62, explicitly commented "not memoized"). Since almost every component uses `useAuth()`, **every AuthProvider re-render re-renders the entire app tree**. Memoize it with `useMemo`.

### Fix 10: useTypewriterPlaceholder causes re-renders every 40-80ms

The typewriter hook updates state every 40-80ms (typing/erasing speed). Since it's used in the Header (which wraps every page), this triggers a **re-render of the entire page 12-25 times per second**. The header, all its children, and any non-memoized components re-render.

Fix: Isolate the typewriter into its own tiny component that only re-renders itself, not the parent Header.

### Fix 11: Framer Motion animations on empty state run continuously

The `ProductListings` empty state has a `repeat: Infinity` bounce animation. Even when off-screen or when products load, this animation keeps running.

Fix: Use `whileInView` or conditionally render only when truly empty.

### Fix 12: Console warning — ProductListingCard cannot be given refs

The console shows `Function components cannot be given refs` for `ProductListingCard`. This means the analytics `ref` from `useCardAnalytics` is being passed but the component isn't wrapped in `forwardRef`, causing React to log warnings for every card on every render.

Fix: Use `forwardRef` on `ProductListingCard`, or move the ref attachment inside the component (which it already does via `cardRef` — the issue is the parent trying to pass a ref).

---

## Category D: Network & Query Configuration

### Fix 13: Global staleTime is only 30 seconds

The QueryClient default `staleTime` is 30s (line 110 in App.tsx). This means most queries refetch on every navigation/remount. For config data (categories, settings, badges) that changes rarely, this is far too aggressive.

Fix: Increase global default to 2-5 minutes. Config hooks already have their own staleTime, but any hook that doesn't set one explicitly gets 30s.

### Fix 14: Search fires on 1-character input

`isSearchActive` triggers when `debouncedQuery.length >= 1`. A single character fires a `LIKE '%a%'` query scanning the entire products table. This is extremely slow on larger datasets.

Fix: Increase minimum to 2-3 characters before triggering search.

### Fix 15: Search fetches 80 products + 30 seller-name products sequentially

`runSearch` fires up to 3 sequential queries: product search (limit 80), seller-name search (limit 30), and nearby sellers RPC. These should run in parallel with `Promise.all`.

### Fix 16: Products query uses `select('*')` with full row data

`useProductsByCategory` uses `select('*')` on the products table, fetching all columns including `specifications` JSONB, `description`, `tags`, etc. for every product on the home page. Most of this data is never displayed on the card.

Fix: Select only the columns needed for card rendering.

### Fix 17: No AbortController on popular products load

`SearchPage.loadPopularProducts` has no abort controller, so if `browseBeyond` or `searchRadius` changes rapidly, multiple in-flight requests pile up.

### Fix 18: Multiple realtime subscriptions without cleanup guards

`useAuthState` subscribes to 4 realtime channels (user_roles, security_staff, society_admins, builder_members). The `Header` subscribes to `user_notifications`. Each subscription is a persistent WebSocket listener. Add debounce or consolidate into a single channel with multiple filters.

---

## Implementation Priority

```text
Impact    Fix   Description
──────    ───   ──────────────────────────────────
CRITICAL  #10   Typewriter re-renders entire page 12-25x/sec
CRITICAL  #9    Unmemoized AuthContext re-renders everything
CRITICAL  #4    Search placeholder fetches 200 products on every page
HIGH      #1    Lift config hooks out of ProductListingCard (x30 cards)
HIGH      #5    Decouple nearby products from useProductsByCategory
HIGH      #6    SearchPage uses raw fetches instead of React Query
HIGH      #16   Products query fetches all columns unnecessarily
HIGH      #8    Double auth context fetch on mount
MEDIUM    #2    React.memo on ProductListingCard
MEDIUM    #3    Shared IntersectionObserver for analytics
MEDIUM    #7    Deduplicate search_nearby_sellers calls
MEDIUM    #13   Increase global staleTime default
MEDIUM    #14   Minimum 2-3 chars for search
MEDIUM    #15   Parallelize search queries
LOW       #12   forwardRef warning cleanup
LOW       #11   Framer Motion infinite animation
LOW       #17   AbortController for popular products
LOW       #18   Consolidate realtime subscriptions
```

---

## Technical Detail: Estimated Re-render Count Per Second (Current)

```text
Source                          Frequency    Scope
─────────────────────────────   ──────────   ──────────────────
Typewriter placeholder          12-25/sec    Entire page tree
Auth context (unmemoized)       On any state Entire app tree
ProductListingCard hooks (x30)  Per render   Each card subtree
IntersectionObserver callbacks  Scroll       Each visible card
Total estimated re-renders:     ~500-1000/sec during scroll
```

After fixes, this should drop to under 10/sec during scroll.

