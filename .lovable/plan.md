

## Redesigned Seller Onboarding: Guided Step-by-Step Experience

### Problem Summary
The current 5-step flow works functionally, but lacks **contextual guidance**. Steps feel disconnected -- the seller picks a category, then sub-categories, then fills business details without understanding *why* each step matters or *what comes next*. The thin progress bar (5 small dots) gives no sense of journey.

### Design Approach
Improve guidance and continuity **without adding new features**. Every change below restructures existing UI elements for clarity.

---

### Change 1: Named Progress Stepper (replaces anonymous dots)

Replace the 5 anonymous colored bars with a **labeled stepper** showing step names. The seller always knows where they are and what's ahead.

**Current:** 5 thin colored bars with no labels
**New:** Horizontal stepper with icons + labels:
`Category > Specialize > Store Details > Products > Review`

Each step shows its name, a small icon, and completed/active/upcoming state. This gives the seller a mental map of the entire journey.

**File:** `BecomeSellerPage.tsx` -- replace the step indicator section (lines 391-402)

---

### Change 2: Step-Level Context Headers

Replace the generic "Become a Seller" title with **step-specific titles and helper text** that explain what the seller is doing and why.

| Step | Title | Helper Text |
|------|-------|-------------|
| 1 | "What will you offer?" | "This determines your store type and the tools available to you." |
| 2 | "Specialize your store" | "Select the specific categories you'll serve. You can add more later." |
| 3 | "Set up your store" | "These details help buyers find and trust your business." |
| 4 | "Add your first products" | "Buyers will see these once your store is approved. Start with 1-2 items." |
| 5 | "Review and submit" | "Double-check everything. You can edit your store after approval too." |

**File:** `BecomeSellerPage.tsx` -- replace the static header block (lines 380-389)

---

### Change 3: Contextual "What's Next" Hints on Each Step

Add a small muted info line at the **bottom of each step** (above the Continue button) that tells the seller what happens next. This bridges the gap between steps.

- Step 1 bottom: "Next: You'll pick specific categories within [selected group]"
- Step 2 bottom: "Next: You'll name your store and set operating hours"
- Step 3 bottom: "Next: Add at least one product or service to your catalog"
- Step 4 bottom: "Next: Review everything and submit for approval"

**File:** `BecomeSellerPage.tsx` -- add text above each step's Continue button

---

### Change 4: Persistent Context Breadcrumb

Currently, Step 3 shows a summary card of the selected group + subcategories. Extend this pattern to **Steps 4 and 5** as well, so the seller always sees their selections in context. This is already partially done (Step 5 has a summary card) but Steps 4 lacks any reminder of the store name or category.

Add a compact breadcrumb-style bar at the top of Steps 3-5:
`[icon] Food > Bakery, Home Cooking | "Amma's Kitchen"`

**File:** `BecomeSellerPage.tsx` -- extract the summary card into a reusable inline component, render it on steps 3, 4, and 5

---

### Change 5: Encouraging Micro-Copy on Category Selection (Step 1)

When a seller taps a category group in Step 1, instead of immediately jumping to Step 2, show a brief **confirmation moment**: a subtle highlight animation on the selected card with a "Great choice!" micro-interaction before transitioning. This uses framer-motion (already installed) for a 300ms scale + fade transition.

**File:** `BecomeSellerPage.tsx` -- wrap step 1 card click with a short delay and animation

---

### Change 6: Empty State Guidance in Products Step

The DraftProductManager currently shows "Add at least one item to continue" as static text. Enhance this with a friendlier empty state when no products have been added yet:
- Show an illustration-style icon (Package) with encouraging text: "Your catalog is empty. Add your first product -- even one item is enough to get started!"
- Once the first product is added, show a success message: "You're on your way! Add more items or continue to review."

**File:** `DraftProductManager.tsx` -- enhance the empty state UI (before the "Add Product" button)

---

### Technical Implementation Details

All changes are **UI-only** within two existing files:

1. **`src/pages/BecomeSellerPage.tsx`**
   - Replace step indicator with labeled stepper component (inline, not a new file)
   - Replace static header with dynamic step-aware header
   - Add "what's next" helper text above each Continue button
   - Add persistent context breadcrumb to steps 3-5
   - Add brief selection confirmation animation on step 1

2. **`src/components/seller/DraftProductManager.tsx`**
   - Enhance empty state with friendlier guidance copy
   - Add success encouragement after first product is added

No new dependencies, no new files, no database changes. All changes use existing Tailwind classes and framer-motion (already installed).

