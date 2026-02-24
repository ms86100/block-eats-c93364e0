

## Categories Page Redesign

### Problem
The current category cards use oversized single images with a redundant emoji badge overlay. They lack meaningful data enrichment. The visual hierarchy is flat and uninformative for buyers.

### New Design: Rich Info Cards (inspired by reference image)

Each category card will be a **landscape-oriented rich card** showing:
- A **collage of up to 4 product thumbnails** from that category (fetched from existing `useProductsByCategory` data), falling back to the category `imageUrl` or emoji
- Category **icon badge** (small, top-left corner)
- **Product count badge** (top-right, green pill)
- Category **name** (bold, bottom-left overlay)
- **Seller count** (e.g. "3 sellers") and **price range** (e.g. "From ₹49") as small metadata chips below the name
- Subtle **scale-on-tap** animation (already exists, will refine)

### Layout Changes
- Switch from 3-column tall cards (`aspect-[4/5]`) to **2-column wider cards** (`aspect-[3/2]`) for a more spacious, magazine-style feel
- On `md+` screens: 3 columns
- Cards get `rounded-2xl`, subtle shadow, and a refined gradient overlay

### Data Enrichment (all from existing hooks, no new queries)
The `useProductsByCategory` hook already returns products per category. We will compute per-card:
1. **Product count** — already available in `productCountMap`
2. **Seller count** — count distinct `seller_id` from products in each category
3. **Price range** — min price from products (display as "From ₹49")
4. **Collage images** — take up to 4 unique product `image_url` values for a 2x2 grid thumbnail
5. **Has bestseller** — if any product has `is_bestseller: true`, show a small star badge

### Files to Modify

**1. `src/pages/CategoriesPage.tsx`**
- Change grid from `grid-cols-3` to `grid-cols-2 md:grid-cols-3`
- Change card aspect from `aspect-[4/5]` to `aspect-[3/2]`
- Replace the single image/emoji with a collage component (inline, not a separate file)
- Compute `sellerCount`, `minPrice`, `collageImages`, `hasBestseller` from `productCategories` data per category
- Remove the emoji badge overlay (top-left circle)
- Add metadata row: seller count + price range as small text chips at the bottom
- Keep all existing: group headers, filter pills, search bar, empty state, scroll-to-section, motion animations

**2. `src/index.css`** (minor)
- Add a `.category-collage` grid utility for the 2x2 image layout

### What stays unchanged
- All hooks, queries, data fetching logic
- Parent group pills and section headers
- Search bar and placeholder
- Empty state
- Navigation and routing (`/category/${cat.parentGroup}?sub=${cat.category}`)
- All other pages and components

### Technical Details

The collage grid uses CSS Grid `grid-cols-2 grid-rows-2` inside the card image area. Each cell shows a product thumbnail with `object-cover`. If fewer than 4 images are available, the layout gracefully degrades: 1 image = full bleed, 2 images = side-by-side, 3 images = 2+1, 4 images = 2x2 grid.

Price range uses the existing `formatPrice` utility from `src/lib/format-price.ts`. Seller count is computed with `new Set(products.map(p => p.seller_id)).size`.

No new dependencies. No database changes. No new components or files beyond the CSS utility class.

