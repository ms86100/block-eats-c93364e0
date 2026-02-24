

# Where `action_type = 'book'` Is Defined

The `action_type` on products is **not set manually by sellers**. It is **auto-derived from the category's `transaction_type`** via a database trigger. Here is the full chain:

---

## 1. Category Config Table (`category_config`)

Each category row has a `transaction_type` column. When a category's `transaction_type` is set to `'book_slot'`, every product in that category automatically gets `action_type = 'book'`.

This is configured by **admins** in the Admin Panel via the **Catalog Manager** (CategoryManager / SubcategoryManager components). Categories like `yoga`, `coaching`, etc. have `transaction_type = 'book_slot'`.

---

## 2. Database Trigger: `trg_sync_product_action_type`

Defined in migration `20260215111305`:

```text
ON INSERT OR UPDATE OF category ON products
→ Looks up category_config.transaction_type
→ Maps:
    'cart_purchase' → 'add_to_cart'
    'buy_now'       → 'buy_now'
    'book_slot'     → 'book'          ← THIS ONE
    'request_service' → 'request_service'
    'request_quote'   → 'request_quote'
    'contact_only'    → 'contact_seller'
    'schedule_visit'  → 'schedule_visit'
→ Overwrites products.action_type with the derived value
```

So when a seller creates a product in the "Yoga" category (whose `transaction_type = 'book_slot'`), the trigger automatically sets `action_type = 'book'` on that product row.

---

## 3. Cart Guard Trigger (Migration `20260215083247`)

A second trigger on `cart_items` checks the product's `action_type` before allowing insertion:

```text
IF action_type NOT IN ('add_to_cart', 'buy_now') THEN
  RAISE EXCEPTION 'This product does not support cart purchases.
    The seller has configured it for: %. Use the appropriate flow instead.'
```

This is what produces the error you saw — the product's `action_type` is `'book'`, so the cart insert is rejected.

---

## 4. Seed Data

The test seed function (`reset-and-seed-scenario/index.ts`) explicitly sets `action_type: "book_slot"` on yoga and coaching products — but at the DB level the trigger would override it to `'book'` anyway based on category config.

---

## Summary

```text
Admin sets category_config.transaction_type = 'book_slot'
         ↓
Trigger maps to products.action_type = 'book'
         ↓
Cart guard rejects 'book' products from cart_items
         ↓
UI error: "This product does not support cart purchases"
```

**The fix location is the UI**: `ProductListingCard` currently shows the "ADD" (cart) button for ALL products regardless of `action_type`. It should check `product.action_type` and render the correct button — "Book" for `book`, "Request" for `request_service`, etc. — and route to the booking/enquiry sheet instead of calling `addItem()`.

