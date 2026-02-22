

## Fix: Products and Category Tabs Not Appearing on Category Group Page

### Root Cause

The same PostgREST join ambiguity bug that was just fixed in `useSellerHealth.ts` also exists in two other query hooks:

1. **`useCategoryProducts`** in `src/hooks/queries/usePopularProducts.ts` (line 69) -- used by `CategoryGroupPage` (the `/category/food?sub=snacks` page)
2. **`fetchProducts`** in `src/pages/CategoryPage.tsx` (line 65) -- used by the individual category detail page

Both use `seller_profiles!inner(...)` without specifying the foreign key name. PostgREST can return a 406 error or empty results when the FK relationship is ambiguous, causing:
- Zero products returned, so the grid is empty
- Zero products means the `activeCategorySet` is empty, so the category tabs (All, Home Food, Bakery, Snacks) are all filtered out

Meanwhile, the Home page works fine because `useProductsByCategory` already uses the correct explicit FK: `seller_profiles!products_seller_id_fkey`.

### Fix

#### File 1: `src/hooks/queries/usePopularProducts.ts`

**Line 69** -- Change:
```
seller:seller_profiles!inner(
```
To:
```
seller:seller_profiles!products_seller_id_fkey(
```

The `!inner` modifier is not needed here because the query already filters out products with null sellers via the `.eq('seller.verification_status', 'approved')` filter. The explicit FK name resolves the ambiguity.

#### File 2: `src/pages/CategoryPage.tsx`

**Line 65** -- Change:
```
seller:seller_profiles!products_seller_id_fkey(id, business_name, rating, society_id, verification_status, fulfillment_mode, delivery_note)
```

Also **remove line 69** (`.eq('seller.verification_status', 'approved')`) and instead filter in JavaScript after the query (line 79 already does `filter((p: any) => p.seller != null)`), adding a verification_status check there. This avoids the PostgREST embedded filter issue that silently nullifies rows.

### Why This Fixes Both Issues

- Products will be returned correctly, populating the grid
- With products present, the `activeCategorySet` will contain "snacks", "home_food", "bakery" etc.
- The sub-category tab filter `subCategories.filter(c => activeCategorySet.has(c.category))` will now find matches, so the tabs "All", "Home Food", "Bakery", "Snacks" will appear

### Scope

Two files, two lines changed each. No schema or UI changes needed.
