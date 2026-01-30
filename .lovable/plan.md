
# Multi-Seller Support & Enhanced Search Implementation

## Analysis Summary

### Issue 1: Single Seller Limitation

**Root Cause**: The database has a `UNIQUE (user_id)` constraint on the `seller_profiles` table:
```sql
UNIQUE (user_id)
```

This means **one user can only have one seller profile**. This was an intentional design choice to keep things simple - one person = one business identity.

**Current Business Logic**: 
- A user creates ONE seller profile with a `primary_group` (e.g., "Food")
- They can add multiple categories within that group via the `categories` array
- To offer different services (e.g., both Food AND Classes), they must use the same profile

**Problem**: Users cannot have separate business identities for different service types (e.g., "Amma's Kitchen" for food AND "Math Tutor Pro" for tutoring).

---

### Issue 2: Search Not Working Dynamically

**Current Behavior**:
- Search only searches `business_name` on `seller_profiles`
- Does not search products/services by name or description
- Minimum 2 characters required to trigger search

**Missing Functionality**:
- No product name search
- No product description search
- No seller description search
- No fuzzy matching or keyword relevance

---

## Proposed Solutions

### Solution for Issue 1: Multi-Seller Support

**Option A: Allow Multiple Seller Profiles (Recommended)**
- Remove the `UNIQUE (user_id)` constraint from `seller_profiles`
- Add a composite unique constraint: `UNIQUE (user_id, primary_group)`
- This allows one user to have multiple businesses in different categories
- Each business has its own name, description, rating, products

**Database Changes**:
```sql
-- Remove existing unique constraint
ALTER TABLE seller_profiles DROP CONSTRAINT seller_profiles_user_id_key;

-- Add new composite constraint (one business per category group per user)
ALTER TABLE seller_profiles ADD CONSTRAINT seller_profiles_user_group_key 
  UNIQUE (user_id, primary_group);
```

**Code Changes**:
- Update `BecomeSellerPage` to check for existing profile in the same `primary_group` only
- Update `AuthContext` to fetch all seller profiles for a user
- Update seller dashboard to show a selector for which business to manage

---

### Solution for Issue 2: Enhanced Dynamic Search

**Current Search** (limited):
```typescript
queryBuilder = queryBuilder.ilike('business_name', `%${query}%`);
```

**Enhanced Search** (proposed):
1. Search across multiple tables: `seller_profiles`, `products`
2. Search multiple fields: `business_name`, `description`, `product name`, `product description`
3. Return sellers who match OR have matching products
4. Rank results by relevance

**Implementation Approach**:
```sql
-- Create a search function or use OR conditions
SELECT DISTINCT sp.*
FROM seller_profiles sp
LEFT JOIN products p ON p.seller_id = sp.id
WHERE 
  sp.verification_status = 'approved' AND (
    sp.business_name ILIKE '%keyword%' OR
    sp.description ILIKE '%keyword%' OR
    p.name ILIKE '%keyword%' OR
    p.description ILIKE '%keyword%'
  )
```

---

## Implementation Plan

### Phase 1: Database Migration for Multi-Seller

| Step | Description |
|------|-------------|
| 1 | Drop `seller_profiles_user_id_key` unique constraint |
| 2 | Add new composite constraint `UNIQUE (user_id, primary_group)` |
| 3 | Update foreign key reference handling (if needed) |

### Phase 2: Update BecomeSellerPage

| Change | Description |
|--------|-------------|
| 1 | Check for existing profile in same `primary_group` only |
| 2 | If found, redirect to that seller's settings |
| 3 | If not found in selected group, allow new registration |
| 4 | Show list of existing businesses for reference |

### Phase 3: Update AuthContext & Navigation

| Change | Description |
|--------|-------------|
| 1 | Fetch all seller profiles for user (not just one) |
| 2 | Add `sellerProfiles` array to context |
| 3 | Add `currentSellerId` state for active business |
| 4 | Add seller switcher component in dashboard |

### Phase 4: Enhanced Search Implementation

| Change | Description |
|--------|-------------|
| 1 | Create database function `search_marketplace(keyword)` |
| 2 | Search across `seller_profiles` and `products` tables |
| 3 | Return sellers with matching products included |
| 4 | Add relevance scoring (exact match > partial match) |
| 5 | Update `SearchPage` to use new search function |
| 6 | Make search trigger on keystroke (debounced) |

---

## Files to Modify

| File | Changes |
|------|---------|
| New migration | Drop unique constraint, add composite constraint |
| New migration | Create `search_marketplace` function |
| `src/contexts/AuthContext.tsx` | Support multiple seller profiles |
| `src/pages/BecomeSellerPage.tsx` | Check per-group instead of globally |
| `src/pages/SearchPage.tsx` | Use enhanced search with products |
| `src/components/seller/SellerSwitcher.tsx` | New component for multi-business users |
| `src/pages/SellerDashboardPage.tsx` | Add seller switcher |

---

## Technical Details

### Multi-Seller Data Model

```text
Before:
  User A → 1 Seller Profile (Amma's Kitchen, categories: [home_food, bakery])

After:
  User A → Seller Profile 1 (Amma's Kitchen, primary_group: food, categories: [home_food, bakery])
        → Seller Profile 2 (Math Tutor Pro, primary_group: classes, categories: [tuition])
```

### Search Algorithm

```text
User types: "biryani"

1. Search seller_profiles.business_name ILIKE '%biryani%'
2. Search seller_profiles.description ILIKE '%biryani%'
3. Search products.name ILIKE '%biryani%'
4. Search products.description ILIKE '%biryani%'

Return: Sellers who match directly OR have matching products
Display: Show matching products under each seller card
```

### Search Function (PostgreSQL)

```sql
CREATE OR REPLACE FUNCTION search_marketplace(search_term text)
RETURNS TABLE (
  seller_id uuid,
  business_name text,
  matching_products jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT 
    sp.id,
    sp.business_name,
    (
      SELECT jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'price', p.price))
      FROM products p
      WHERE p.seller_id = sp.id 
        AND p.is_available = true
        AND (p.name ILIKE '%' || search_term || '%' 
             OR p.description ILIKE '%' || search_term || '%')
    )
  FROM seller_profiles sp
  LEFT JOIN products p ON p.seller_id = sp.id
  WHERE sp.verification_status = 'approved'
    AND (
      sp.business_name ILIKE '%' || search_term || '%'
      OR sp.description ILIKE '%' || search_term || '%'
      OR p.name ILIKE '%' || search_term || '%'
      OR p.description ILIKE '%' || search_term || '%'
    )
  GROUP BY sp.id, sp.business_name;
END;
$$ LANGUAGE plpgsql STABLE;
```

---

## Expected Outcomes

After implementation:

1. **Multi-Seller**: Users can run multiple businesses (e.g., food shop + tutoring service) with separate profiles, names, and ratings
2. **Enhanced Search**: Searching "biryani" finds sellers who make biryani, even if their shop name is "Amma's Kitchen"
3. **Dynamic Results**: Search updates as user types (debounced)
4. **Product Discovery**: Users find products directly, not just seller names
5. **Better UX**: Seller dashboard shows business switcher for multi-business users
