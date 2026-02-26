

## Problem

When an admin creates a new category through the Category Manager UI, there is **no way to configure the category's transaction behavior**. The form only captures cosmetic fields (name, icon, color, image). All behavioral flags (`supports_cart`, `requires_time_slot`, `enquiry_only`, `has_duration`, etc.) and the critical `transaction_type` column silently default to database defaults — making every new category behave as a basic "Add to Cart" product listing regardless of intent.

The `transaction_type` column is the real driver: a DB trigger (`trg_sync_product_action_type`) reads it to auto-set every product's `action_type`. But no admin UI exposes it.

## Current Database Defaults for New Categories

| Column | Default |
|--------|---------|
| `transaction_type` | `cart_purchase` |
| `supports_cart` | `false` |
| `requires_time_slot` | `false` |
| `enquiry_only` | `false` |
| `has_duration` | `false` |
| `has_date_range` | `false` |
| `is_negotiable` | `false` |
| `layout_type` | `ecommerce` |

## Solution

Add a **"Category Type"** selector to both the **Add Category** and **Edit Category** dialogs that sets `transaction_type` and auto-derives the correct behavior flags. This keeps the UI simple (one dropdown) while correctly configuring all underlying flags.

### Transaction Type Presets

| Preset Label | `transaction_type` | Auto-set flags |
|---|---|---|
| **Product (Add to Cart)** | `cart_purchase` | `supports_cart=true, has_quantity=true, layout_type=ecommerce` |
| **Buy Now** | `buy_now` | `supports_cart=false, has_quantity=true, layout_type=ecommerce` |
| **Bookable Service** | `book_slot` | `requires_time_slot=true, has_duration=true, layout_type=service` |
| **Request Service** | `request_service` | `enquiry_only=true, layout_type=service` |
| **Request Quote** | `request_quote` | `enquiry_only=true, is_negotiable=true, layout_type=service` |
| **Contact Only** | `contact_only` | `enquiry_only=true, layout_type=service` |
| **Schedule Visit** | `schedule_visit` | `requires_time_slot=true, has_date_range=true, layout_type=service` |

### File Changes

**1. `src/hooks/useCategoryManagerData.ts`**
- Expand `addForm` state to include `transaction_type` (default: `cart_purchase`)
- Expand `editForm` state to include `transaction_type`
- In `saveNewCategory`: derive behavior flags from selected `transaction_type` and include them in the insert payload
- In `openEditDialog`: read existing `transaction_type` into form state
- In `saveEditedCategory`: include `transaction_type` and derived flags in the update payload
- Add a helper function `deriveBehaviorFlags(transactionType)` that returns the correct flag object for each preset

**2. `src/components/admin/CategoryManager.tsx`**
- Add a **"Category Type"** `<Select>` dropdown to both the Add Category dialog and the Edit Category dialog
- Position it prominently (after name, before icon) since it determines listing behavior
- Show a brief helper text under the dropdown explaining what the selected type means (e.g., "Products will show 'Book Now' button and require time slot selection")
- The 7 preset options map directly to `transaction_type` values

**3. `src/hooks/useCategoryManagerData.ts` — `CategoryConfigRow` interface**
- Add `transaction_type` field to the interface so TypeScript recognizes it

### UX Details

- The dropdown label will be **"Listing Type"** (more intuitive than "transaction type")
- Each option shows a short description:
  - "Product (Add to Cart)" — "Buyers add items to cart and checkout together"
  - "Buy Now" — "Direct purchase, no cart"
  - "Bookable Service" — "Buyers pick a time slot to book"
  - "Request Service" — "Buyers send a service request to the seller"
  - "Request Quote" — "Buyers request a price quote, negotiable"
  - "Contact Only" — "Buyers contact the seller directly"
  - "Schedule Visit" — "Buyers schedule an in-person visit"
- Default for new categories: **"Product (Add to Cart)"**
- When editing an existing category, the current `transaction_type` is pre-selected

### Safety

- The existing DB trigger `trg_validate_category_rule_change` already blocks unsafe flag changes (e.g., disabling `supports_cart` when items are in carts). This protection continues to work — the admin will see a toast error if a type change conflicts with existing data.
- The `trg_sync_product_action_type` trigger will automatically update all future products' `action_type` based on the new `transaction_type`. Existing products keep their current `action_type` (trigger fires on product insert/update, not on category update).

