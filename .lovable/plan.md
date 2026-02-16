

# Plan: Distance Badge, Discount Display Fix, and AI Product Image Generation

## Overview

Three interconnected improvements to make the marketplace more informative and visually polished.

---

## 1. Distance Badge on Product Cards

**Current state:** The `distance_km` data is already returned from the `search_nearby_sellers` RPC and stored in `ProductSearchResult`, but it is never passed to `ProductListingCard` for display.

**Changes:**

- **`ProductListingCard.tsx`**: Add a distance badge next to seller name or at the top-right of the card. When `distance_km` is present and the product is from a different society, show a small pill like "2.3 km". Also show `society_name` if available.
  
- **`ProductWithSeller` type**: Add `distance_km?: number | null`, `society_name?: string | null`, and `is_same_society?: boolean` fields.

- **`SearchPage.tsx` (`toProductWithSeller` function, ~line 804)**: Pass through `distance_km`, `society_name`, and `is_same_society` from `ProductSearchResult` to `ProductWithSeller`.

---

## 2. Discount/Pricing Display Fix

**Current state:** The seller form already captures `mrp` and `discount_percentage`, and `ProductListingCard` already renders strikethrough pricing and discount badge. However, the `SearchPage`'s data mapping (`toProductWithSeller`) does not pass `mrp` or `discount_percentage`, so discount info never appears in search results.

**Changes:**

- **`ProductSearchResult` type (SearchPage.tsx, ~line 21)**: Add `mrp`, `discount_percentage` fields.

- **Search queries in `SearchPage.tsx`**: The product queries already select `mrp` and `discount_percentage` in the term-search branch (~line 292) but not in `loadPopularProducts` (~line 143) or the category-only branch (~line 384). Add these columns to all product queries.

- **Mapping functions**: Update all `products.push(...)` blocks and `toProductWithSeller` to include `mrp` and `discount_percentage`.

- **Nearby seller products**: The `search_nearby_sellers` RPC returns `matching_products` JSONB. Need to verify the RPC includes `mrp` and `discount_percentage` in that JSON. If not, update the RPC.

---

## 3. AI Product Image Generation

**Current state:** An edge function `generate-category-image` already exists that uses Lovable AI (Gemini flash image model) to generate category images and upload them to storage. The `ImageUpload` component handles manual uploads to an `app-images` bucket.

**Changes:**

### Backend: New Edge Function `generate-product-image`

- Based on the existing `generate-category-image` pattern
- Accepts: `productName`, `categoryName`, `description` (optional)
- Generates a 1:1 product image using Lovable AI with a prompt tailored to the product and its category
- Uploads to the existing `app-images` bucket under `{userId}/products/ai-{timestamp}.png`
- Returns the public URL

### Frontend: Enhanced Image Upload Component

- **New `ProductImageUpload` component** (wraps `ImageUpload`):
  - Two-tab interface: "Upload" and "Generate with AI"
  - Upload tab: existing `ImageUpload` with added validation:
    - Accepted formats: JPG, PNG, WebP
    - Max file size: 5MB (already enforced)
    - Images displayed via `object-cover` in 1:1 aspect ratio (already handled)
  - AI tab: 
    - Button "Generate Image" that calls the edge function
    - Shows loading state during generation
    - Previews generated image before confirming
    - Uses product name + category as context for generation

- **`SellerProductsPage.tsx`**: Replace the existing `ImageUpload` usage with the new `ProductImageUpload` component, passing product name and category for AI context.

### Image Quality Rules

- All product images display in 1:1 aspect ratio with `object-cover` or `object-contain` (already consistent across all card components)
- AI-generated images are produced at 1:1 ratio by prompt instruction
- Upload validation rejects non-image files and files over 5MB (already in place)
- No additional resolution enforcement needed since images are served at responsive sizes and the AI model produces adequate resolution

---

## Technical Details

### Files to Create
1. `supabase/functions/generate-product-image/index.ts` -- new edge function

### Files to Modify
1. `src/pages/SearchPage.tsx` -- pass mrp, discount_percentage, distance_km through all mapping paths
2. `src/components/product/ProductListingCard.tsx` -- add distance badge UI
3. `src/components/ui/image-upload.tsx` -- add AI generation tab
4. `src/pages/SellerProductsPage.tsx` -- integrate AI image option
5. `supabase/config.toml` -- register new edge function

### Database Changes
- Verify `search_nearby_sellers` RPC includes `mrp` and `discount_percentage` in `matching_products` JSONB. If missing, update via migration.

