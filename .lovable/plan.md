

# End-to-End Cross-Society Marketplace Test Plan

## Overview

This plan sets up a clean-slate test environment with specific test entities to validate society-based visibility, distance-based discovery (4 km and 10 km), and ordering across societies.

---

## Phase 1: Data Reset

Clear all existing data from transactional and entity tables in dependency order to avoid foreign key violations.

**Tables to clear (in order):**
1. Transactional/child tables first: `coupon_redemptions`, `payment_records`, `order_items`, `orders`, `orders_archive`, `cart_items`, `chat_messages`, `reviews`, `favorites`, `subscription_deliveries`, `subscriptions`, `marketplace_events`, `notification_queue`, `user_notifications`, `device_tokens`, `audit_log`, `audit_log_archive`, `trigger_errors`
2. Community modules: `bulletin_votes`, `bulletin_comments`, `bulletin_rsvps`, `bulletin_posts`, `help_responses`, `help_requests`, `dispute_comments`, `dispute_tickets`, `snag_tickets`, `society_activity`, `emergency_broadcasts`, `gate_entries`, `visitor_entries`, `manual_entry_requests`, `parcel_entries`, `parking_violations`, `parking_slots`, `worker_ratings`, `worker_entry_logs`, `worker_flat_assignments`, `worker_job_requests`, `society_workers`, `domestic_help_attendance`, `domestic_help_entries`
3. Marketplace: `products`, `seller_licenses`, `seller_profiles`, `coupons`, `featured_items`
4. Trust/skills: `skill_endorsements`, `skill_listings`, `reports`, `warnings`
5. Finance/progress: `society_expenses`, `society_income`, `expense_flags`, `expense_views`, `maintenance_dues`, `resident_payments`, `payment_milestones`, `project_answers`, `project_questions`, `project_documents`, `milestone_reactions`, `construction_milestones`, `project_towers`, `inspection_items`, `inspection_checklists`, `society_report_cards`, `society_reports`, `collective_escalations`
6. Admin/config: `society_feature_overrides`, `society_features`, `security_staff`, `society_admins`, `builder_feature_packages`, `builder_societies`, `builder_members`, `builders`
7. Core: `user_roles`, `profiles` (cascade will handle auth references)
8. Societies: `societies` (only test ones -- we preserve `category_config`, `parent_groups`, `badge_config`, `system_settings`, `platform_features`, `feature_packages`, `society_worker_categories`, `order_status_config` as configuration data)

**Note:** `category_config`, `parent_groups`, `badge_config`, `system_settings`, and `admin_settings` are configuration tables and will NOT be cleared.

---

## Phase 2: Seed Test Data

### Step 1 -- Create Three Societies with Real Coordinates

Using Bangalore coordinates with known distances:

| Entity | Name | Lat | Lon | Notes |
|--------|------|-----|-----|-------|
| Society B | Green Valley Residency | 12.9716 | 77.5946 | Primary (central Bangalore) |
| Society D | Lakeside Towers | 12.9950 | 77.6150 | ~3.2 km from B (within 4 km) |
| Society E | Hilltop Heights | 13.0350 | 77.6500 | ~8.5 km from B, ~8.0 km from D (within 10 km) |

All societies will be `is_active = true`, `is_verified = true`.

### Step 2 -- Create Auth Users

Create 2 auth users via Supabase auth admin (edge function or direct insert):
- **User A** (customer): `usera@test.sociva.com` -- mapped to Society B
- **User D** (customer): `userd@test.sociva.com` -- mapped to Society D

And 1 seller user:
- **Seller C user**: `sellerc@test.sociva.com` -- mapped to Society B

Additionally, create a seller in Society E for the 10 km radius test:
- **Seller E user**: `sellere@test.sociva.com` -- mapped to Society E

### Step 3 -- Create Profiles and Roles

For each user, insert into `profiles` with their respective `society_id` and `verification_status = 'approved'`. Insert `buyer` role for Users A and D, `seller` role for Seller C and Seller E users.

### Step 4 -- Create Seller Profiles

- **Seller C**: Food seller in Society B, `verification_status = 'approved'`, `sell_beyond_community = true`, `delivery_radius_km = 5` (covers Society D at 3.2 km)
- **Seller E**: Food seller in Society E, `verification_status = 'approved'`, `sell_beyond_community = true`, `delivery_radius_km = 10`

### Step 5 -- Create Products

For **Seller C** (Society B):
- "Butter Chicken" - home_food, price 250, approved
- "Paneer Tikka" - home_food, price 180, approved
- "Fresh Naan" - bakery, price 30, approved

For **Seller E** (Society E):
- "Masala Dosa" - home_food, price 80, approved
- "Filter Coffee" - beverages, price 40, approved

All products: `is_available = true`, `approval_status = 'approved'`, `action_type = 'add_to_cart'`

---

## Phase 3: Validation Scenarios

### Test 1 -- Same-Society Visibility (User A sees Seller C)
- Login as User A
- Navigate to homepage -- Seller C should appear in "Open Now" / "Shop by Store"
- Search for "Butter Chicken" -- product should appear with Add to Cart
- Place an order from Seller C

### Test 2 -- Cross-Society Discovery at 4 km (User D sees Seller C)
- Login as User D
- On Search page, toggle "Browse beyond my community" ON
- Set radius slider to 4 km (default or explicit)
- Seller C (Society B, 3.2 km away) should appear in cross-society results
- User D can view Seller C's food listings and add to cart

### Test 3 -- Expanded Radius to 10 km (User D sees Seller E)
- User D increases search radius to 10 km
- Society E sellers become visible (8.0 km away)
- Seller E's "Masala Dosa" and "Filter Coffee" should appear
- User D can browse and order from Seller E

### Test 4 -- Negative Case
- At 4 km radius, User D should NOT see Seller E (8 km away)
- Sellers without `sell_beyond_community = true` should never appear cross-society

---

## Phase 4: Implementation Approach

Since we cannot create auth users via SQL alone (they live in `auth.users`), the implementation will:

1. **Create an edge function** `seed-test-data` that:
   - Uses the Supabase service role to create auth users
   - Inserts all test data (societies, profiles, roles, sellers, products)
   - Returns credentials for manual login testing

2. **Data reset** will be done via SQL DELETE statements executed through the insert tool (for data operations)

3. **No schema changes** are needed -- all tables and functions already exist

---

## Technical Details

### Edge Function: `seed-test-data`

- Creates auth users with known passwords using `supabase.auth.admin.createUser()`
- Inserts societies with precise lat/lon coordinates
- Inserts profiles, user_roles, seller_profiles, and products
- Returns a summary of created entities and login credentials

### Key Database Functions Already in Place
- `haversine_km()` -- distance calculation
- `search_nearby_sellers()` -- cross-society seller discovery with radius filtering
- `search_marketplace()` -- same-society marketplace search
- Profile fields: `browse_beyond_community`, `search_radius_km`
- Seller fields: `sell_beyond_community`, `delivery_radius_km`

### Files to Create/Modify
1. **New**: `supabase/functions/seed-test-data/index.ts` -- edge function for seeding
2. No frontend changes needed -- all discovery UI already exists

