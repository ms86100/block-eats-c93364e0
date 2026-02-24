

## Restore Compact Card Design

### Problem
The `ProductListingCard` was altered during the category page cosmetic transformation. The cards are now nearly double the intended size because:
1. The action button (ADD/BUY) was changed from a small pill overlapping the image bottom-edge to a full-width 38px button at the bottom of the card content area
2. The image area uses full `aspect-square` with generous `p-3` padding, making it oversized
3. The content section has larger spacing (`px-3 pb-3 pt-2.5`) than the original compact layout

### Reference (from screenshot)
The intended card design has:
- A compact square image area with `object-contain`, smaller padding
- A small centered action button (ADD/BUY) **overlapping the bottom edge of the image** (positioned absolutely, translated -50% vertically)
- Below the image: product name (11-12px, 2-line clamp), seller name (9px), discount text, price + MRP strikethrough
- Quantity stepper also overlaps the image bottom when active
- Overall card is tight with minimal internal spacing

### Changes to `src/components/product/ProductListingCard.tsx`

**Image section (lines 212-270):**
- Reduce image padding from `p-3` to `p-2`
- Add the absolute-positioned action button overlapping the image bottom edge (restore the old `ProductGridCard` pattern)

**Action button (lines 338-358):**
- Move the ADD button from inside the content section to overlap the image bottom edge
- Change from full-width `h-[38px]` to a compact centered pill: `px-5 py-1.5 text-[11px]` with border styling
- Quantity stepper also becomes compact centered overlay

**Content section (lines 272-335):**
- Reduce padding from `px-3 pb-3 pt-2.5` to `px-2 pb-2 pt-4` (pt-4 accounts for the overlapping button)
- Reduce product name from `text-sm` to `text-[11px]`
- Reduce price from `text-base` to `text-xs`

### What stays unchanged
- All data, hooks, analytics, cart logic, memo comparator
- Badge system, veg badge, distance badge positioning
- All handler functions
- Type definitions and props interface

### Technical details
The button repositioning uses `absolute -bottom-3 left-1/2 -translate-x-1/2 z-10` on a wrapper div inside the image container (same pattern as the existing `ProductGridCard` component at line 113-128 of that file). The content area gets `pt-4` to account for the button overlap space.

