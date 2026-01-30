
# Fix Category System & Enhanced Admin Management

## Issues Identified

### Issue 1: Seller Registration Error ("invalid input value for enum product_category")
**Root Cause**: The `seller_profiles.categories` column uses the old `product_category[]` type with only 5 values:
- `home_food`, `bakery`, `snacks`, `groceries`, `other`

But the app is trying to insert values from the new `service_category` enum (50+ categories like `furniture`, `equipment_rental`, `tuition`, etc.).

**Solution**: Update the `seller_profiles.categories` column to use `service_category[]` instead of `product_category[]`.

### Issue 2: Admin Category Management Enhancements
**Current State**: Admin can only toggle individual categories on/off
**Required Features**:
1. Toggle parent category groups on/off (cascading to all subcategories)
2. Full CRUD for subcategories (Create, Read, Update, Delete)

---

## Implementation Plan

### Phase 1: Database Migration to Fix Seller Registration

```text
Migration Steps:
1. Drop the old product_category[] constraint on seller_profiles.categories
2. Create new column with service_category[] type
3. Migrate existing data
4. Drop old column and rename new one
```

**SQL Migration**:
```sql
-- Add new column with correct type
ALTER TABLE seller_profiles ADD COLUMN categories_new service_category[] DEFAULT '{}';

-- Copy existing data where applicable
UPDATE seller_profiles 
SET categories_new = categories::text[]::service_category[]
WHERE categories IS NOT NULL;

-- Drop old column and rename
ALTER TABLE seller_profiles DROP COLUMN categories;
ALTER TABLE seller_profiles RENAME COLUMN categories_new TO categories;
ALTER TABLE seller_profiles ALTER COLUMN categories SET NOT NULL;
ALTER TABLE seller_profiles ALTER COLUMN categories SET DEFAULT '{}';
```

Also update the `products.category` column:
```sql
ALTER TABLE products ALTER COLUMN category TYPE service_category USING category::text::service_category;
```

### Phase 2: Enhance Admin CategoryManager

**New Features**:

#### A. Parent Group Toggle with Cascade
- Add toggle switch for each parent group header
- When a parent group is disabled, all its subcategories are automatically disabled
- When a parent group is enabled, admin can then enable individual subcategories
- Add `is_group_active` tracking (either in database or by checking if all categories in group are disabled)

#### B. CRUD Operations for Subcategories
- **Create**: Add "Add Category" button per parent group
  - Form: display_name, icon (emoji picker), color (preset options)
  - Auto-generate category key from display_name (snake_case)
- **Update**: Click on a category to edit display_name, icon, color
- **Delete**: Soft delete (set is_active = false and add deleted_at flag)
- **Reorder**: Drag and drop to reorder display_order

**Note**: Since the `category` column uses an enum type, we cannot truly create new categories dynamically without a database migration. We'll show this limitation and suggest:
1. Admin can enable/disable existing predefined categories
2. For new category requests, they can contact support
3. Optionally: Use a text type instead of enum for full flexibility (requires migration)

### Phase 3: Update CategoryGroupGrid Filter Logic

Ensure that when a category is disabled:
- It doesn't appear in the homepage category navigation
- Sellers cannot select it during registration
- Existing sellers with that category continue to function

---

## Files to Modify

| File | Changes |
|------|---------|
| New migration | Convert seller_profiles.categories to service_category[] type |
| New migration | Convert products.category to service_category type |
| `src/components/admin/CategoryManager.tsx` | Add parent group toggles, CRUD UI for categories |
| `src/pages/BecomeSellerPage.tsx` | Remove type casting workaround |

## Technical Details

### CategoryManager Enhancements

```text
Enhanced UI Structure:
+--------------------------------------------------+
| Category Management                              |
+--------------------------------------------------+
| [All] [Food] [Classes] [Services] ...            |
+--------------------------------------------------+
|                                                  |
| Food & Groceries                    [Toggle All] |
|   🍛 Home Food                      [✓]         |
|   🧁 Bakery                         [✓]         |
|   🍿 Snacks                         [ ]         |
|   ...                                            |
+--------------------------------------------------+
|                                                  |
| Classes & Learning                  [Toggle All] |
|   📚 Tuition                        [✓]         |
|   🧘 Yoga                           [✓]         |
|   ...                                            |
+--------------------------------------------------+
```

### Parent Group Toggle Logic

When parent toggle is turned OFF:
1. Update all categories in that group: `is_active = false`
2. Show visual indicator that group is disabled
3. Categories become greyed out and unselectable

When parent toggle is turned ON:
1. Categories remain individually controllable
2. Admin can then enable specific subcategories

---

## Expected Outcome

After implementation:
1. Sellers can register for ANY category without enum errors
2. Admin can toggle entire category groups on/off
3. Admin can enable/disable individual subcategories
4. Categories only appear to users if admin has enabled them
5. Existing food sellers continue to work without issues
