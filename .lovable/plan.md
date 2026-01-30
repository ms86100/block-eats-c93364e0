
# Society Super-App Transformation
## Converting BlockEats into a Community Commerce Engine

---

## Vision

Transform BlockEats from a single-purpose food ordering app into a **modular society commerce platform** that supports 12+ service categories while reusing 90% of existing infrastructure.

---

## Architecture Philosophy: Category Behavior Flags

Instead of hardcoding per-category logic, we'll implement a **flexible behavior system** using configuration flags:

```text
Category Behavior Matrix
------------------------
| Flag                    | Food | Services | Rentals | Resale |
|-------------------------|------|----------|---------|--------|
| isPhysicalProduct       |  Yes |    No    |   Yes   |   Yes  |
| requiresPreparation     |  Yes |    No    |    No   |    No  |
| requiresTimeSlot        |   No |   Yes    |   Yes   |    No  |
| requiresDelivery        |  Yes |   Some   |    No   |    No  |
| supportsCart            |  Yes |    No    |    No   |    No  |
| enquiryOnly             |   No |   Some   |   Some  |   Yes  |
| hasQuantity             |  Yes |    No    |    No   |    No  |
| hasDuration             |   No |   Yes    |   Yes   |    No  |
| hasDateRange            |   No |    No    |   Yes   |    No  |
| isNegotiable            |   No |    No    |    No   |   Yes  |
```

---

## Database Schema Changes

### 1. Expand Category System

```sql
-- New ENUM for service categories (extends existing product_category)
CREATE TYPE service_category AS ENUM (
  -- Food & Consumption (existing)
  'home_food', 'bakery', 'snacks', 'groceries', 'beverages',
  -- Child Services
  'tuition', 'daycare', 'coaching',
  -- Classes & Skills
  'yoga', 'dance', 'music', 'art_craft', 'language', 'fitness',
  -- Home Services
  'electrician', 'plumber', 'carpenter', 'ac_service', 'pest_control', 'appliance_repair',
  -- Domestic Help
  'maid', 'cook', 'driver', 'nanny',
  -- Personal Services
  'tailoring', 'laundry', 'beauty', 'mehendi', 'salon',
  -- Professional Services
  'tax_consultant', 'it_support', 'tutoring', 'resume_writing',
  -- Rentals
  'equipment_rental', 'vehicle_rental', 'party_supplies', 'baby_gear',
  -- Buy & Sell
  'furniture', 'electronics', 'books', 'toys', 'kitchen', 'clothing',
  -- Events
  'catering', 'decoration', 'photography', 'dj_music',
  -- Pet Services
  'pet_food', 'pet_grooming', 'pet_sitting', 'dog_walking',
  -- Property
  'flat_rent', 'roommate', 'parking'
);

-- Category configuration table (admin-manageable)
CREATE TABLE category_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category service_category UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  parent_group TEXT NOT NULL, -- 'food', 'services', 'rentals', 'resale', 'events', 'pets', 'property'
  
  -- Behavior flags
  is_physical_product BOOLEAN DEFAULT false,
  requires_preparation BOOLEAN DEFAULT false,
  requires_time_slot BOOLEAN DEFAULT false,
  requires_delivery BOOLEAN DEFAULT false,
  supports_cart BOOLEAN DEFAULT false,
  enquiry_only BOOLEAN DEFAULT false,
  has_quantity BOOLEAN DEFAULT true,
  has_duration BOOLEAN DEFAULT false,
  has_date_range BOOLEAN DEFAULT false,
  is_negotiable BOOLEAN DEFAULT false,
  
  -- Display settings
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for category_config
ALTER TABLE category_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active categories" ON category_config
  FOR SELECT USING (is_active = true OR is_admin(auth.uid()));
CREATE POLICY "Only admins can manage categories" ON category_config
  FOR ALL USING (is_admin(auth.uid()));
```

### 2. Extend Products/Listings Table

```sql
-- Add new columns to products table for service/rental/resale support
ALTER TABLE products ADD COLUMN listing_type TEXT DEFAULT 'product'; -- 'product', 'service', 'rental', 'resale'
ALTER TABLE products ADD COLUMN service_duration_minutes INTEGER; -- For services with time slots
ALTER TABLE products ADD COLUMN deposit_amount NUMERIC; -- For rentals
ALTER TABLE products ADD COLUMN rental_period_type TEXT; -- 'hourly', 'daily', 'weekly', 'monthly'
ALTER TABLE products ADD COLUMN min_rental_duration INTEGER;
ALTER TABLE products ADD COLUMN max_rental_duration INTEGER;
ALTER TABLE products ADD COLUMN condition TEXT; -- For resale: 'new', 'like_new', 'good', 'fair'
ALTER TABLE products ADD COLUMN is_negotiable BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN location_required BOOLEAN DEFAULT false; -- For services that come to you
ALTER TABLE products ADD COLUMN available_slots JSONB; -- For services with scheduling
```

### 3. Extend Orders for Different Transaction Types

```sql
-- Add booking-specific fields to orders
ALTER TABLE orders ADD COLUMN order_type TEXT DEFAULT 'purchase'; -- 'purchase', 'booking', 'rental', 'enquiry'
ALTER TABLE orders ADD COLUMN scheduled_date DATE;
ALTER TABLE orders ADD COLUMN scheduled_time_start TIME;
ALTER TABLE orders ADD COLUMN scheduled_time_end TIME;
ALTER TABLE orders ADD COLUMN rental_start_date DATE;
ALTER TABLE orders ADD COLUMN rental_end_date DATE;
ALTER TABLE orders ADD COLUMN deposit_paid BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN deposit_refunded BOOLEAN DEFAULT false;

-- Update order_status ENUM to include service-specific statuses
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'enquired';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'quoted';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'scheduled';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'in_progress';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'returned';
```

### 4. Admin API Keys Table

```sql
-- Store admin-configurable API keys
CREATE TABLE admin_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL, -- 'google_maps_api_key', 'twilio_account_sid', etc.
  value TEXT, -- Encrypted in edge function
  is_active BOOLEAN DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins can manage settings" ON admin_settings
  FOR ALL USING (is_admin(auth.uid()));
```

---

## Part 1: Core System Modifications

### File Changes Overview

| Component | Changes Required |
|-----------|------------------|
| `src/types/database.ts` | Add new types, category configs, listing types |
| `src/components/category/CategoryGrid.tsx` | Group categories, expand display |
| `src/components/product/ProductCard.tsx` | Support services/rentals/resale UI variants |
| `src/components/product/ListingCard.tsx` | New unified component for all listing types |
| `src/pages/SellerDetailPage.tsx` | Dynamic tabs based on category behaviors |
| `src/pages/CartPage.tsx` | Conditional cart/booking UI |
| `src/pages/BecomeSellerPage.tsx` | Category group selection |
| `src/hooks/useCart.tsx` | Support booking mode vs cart mode |

### New Components to Create

| Component | Purpose |
|-----------|---------|
| `src/components/booking/TimeSlotPicker.tsx` | Select date + time for services |
| `src/components/booking/DateRangePicker.tsx` | Select date range for rentals |
| `src/components/listing/ServiceCard.tsx` | Display service listings |
| `src/components/listing/RentalCard.tsx` | Display rental listings |
| `src/components/listing/ResaleCard.tsx` | Display buy/sell listings |
| `src/components/listing/EnquiryButton.tsx` | Contact seller without cart |
| `src/pages/CategoryGroupPage.tsx` | Browse by category group |

---

## Part 2: Category-Aware Components

### Unified Listing Card Component

A smart component that renders differently based on category behavior:

```text
ListingCard Variants
--------------------
[Product Mode]
- Shows quantity controls
- Add to cart button
- Price + veg/non-veg badge

[Service Mode]
- Shows "Book Now" button
- Duration display (e.g., "60 min session")
- Time slot availability indicator

[Rental Mode]
- Shows "Rent" button
- Daily/weekly rate display
- Deposit amount display
- Date range selector

[Resale Mode]
- Shows "Contact Seller" button
- Condition badge
- "Negotiable" tag
- Chat-first flow
```

### Dynamic Order Flow

```text
Flow Router Logic
-----------------
IF category.supports_cart:
    → Standard cart flow (Food, Groceries)
ELSE IF category.requires_time_slot:
    → Booking flow with calendar (Classes, Services)
ELSE IF category.has_date_range:
    → Rental flow with date picker (Rentals)
ELSE IF category.enquiry_only:
    → Chat-first flow (Resale, Property)
```

---

## Part 3: Homepage Redesign

### Category Group Navigation

Replace single category row with grouped sections:

```text
+--------------------------------------------------+
| What are you looking for?                        |
+--------------------------------------------------+
| [Food]  [Services]  [Rentals]  [Buy/Sell]        |
|  🍲        🛠️         🚲          📦            |
+--------------------------------------------------+
```

Tapping a group expands to show sub-categories:

```text
[Services] expanded:
+--------------------------------------------------+
| 🏠 Home     | 👶 Child    | 💪 Classes           |
| Services   | Services    |                       |
+--------------------------------------------------+
| 🧹 Domestic | 💇 Personal | 📋 Professional      |
| Help       | Care        | Help                  |
+--------------------------------------------------+
```

---

## Part 4: Admin Configuration Panel

### New Admin Tab: "Categories & Settings"

```text
Admin Panel → Settings
+--------------------------------------------------+
| API Configurations                               |
+--------------------------------------------------+
| Google Maps API Key    [••••••••••]  [✓ Active]  |
| Twilio Account SID     [Not set]     [Configure] |
| Twilio Auth Token      [Not set]     [Configure] |
+--------------------------------------------------+
| Category Management                              |
+--------------------------------------------------+
| [Toggle categories on/off]                       |
| [Reorder category display]                       |
| [Configure category behaviors]                   |
+--------------------------------------------------+
```

---

## Part 5: Launch Categories (Phase 1)

As recommended, start with these 5 category groups:

### 1. Food & Groceries (Existing)
- Home Food, Bakery, Snacks, Beverages, Groceries
- Flow: Cart → Order → Prepare → Pickup/Delivery
- 100% existing code reused

### 2. Classes & Learning (New)
- Yoga, Dance, Music, Art, Tuition, Coaching
- Flow: Browse → Book Slot → Confirm → Attend
- Requires: TimeSlotPicker, booking confirmation

### 3. Home Services (New)
- Electrician, Plumber, Carpenter, AC Service
- Flow: Browse → Request → Quote → Accept → Complete
- Requires: Service request form, quote system

### 4. Buy & Sell (New)
- Furniture, Electronics, Books, Toys, Kitchen Items
- Flow: Browse → Chat → Negotiate → Meet & Pay
- Requires: Chat-first flow, condition badges

### 5. Rentals (New)
- Equipment, Party Supplies, Baby Gear
- Flow: Browse → Select Dates → Reserve → Pay Deposit
- Requires: DateRangePicker, deposit handling

---

## Part 6: Implementation Phases

### Phase A: Foundation (Database + Types)
1. Create migration for new schema
2. Update TypeScript types
3. Create category_config seed data
4. Add admin settings table

### Phase B: Category System
1. Update CategoryGrid for groups
2. Create CategoryGroupPage
3. Update seller profile for new categories
4. Update BecomeSellerPage with category groups

### Phase C: Listing Components
1. Create ListingCard (unified component)
2. Create ServiceCard variant
3. Create RentalCard variant
4. Create ResaleCard variant
5. Create EnquiryButton component

### Phase D: Booking & Rental Flows
1. Create TimeSlotPicker component
2. Create DateRangePicker component
3. Update order creation for bookings
4. Update OrderDetailPage for service status

### Phase E: Admin Configuration
1. Create admin settings UI
2. Create category management UI
3. Add API key configuration
4. Create category toggle system

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/types/categories.ts` | Category types and behavior flags |
| `src/hooks/useCategoryBehavior.ts` | Get behavior flags for a category |
| `src/components/listing/ListingCard.tsx` | Unified smart listing card |
| `src/components/booking/TimeSlotPicker.tsx` | Service booking time selector |
| `src/components/booking/DateRangePicker.tsx` | Rental date range selector |
| `src/components/booking/BookingSheet.tsx` | Bottom sheet for booking flow |
| `src/components/listing/EnquiryButton.tsx` | Chat-first contact button |
| `src/pages/CategoryGroupPage.tsx` | Browse category groups |
| `src/components/admin/CategoryManager.tsx` | Admin category configuration |
| `src/components/admin/ApiKeySettings.tsx` | Admin API key configuration |

## Files to Modify

| File | Changes |
|------|---------|
| `src/types/database.ts` | Add new types and category enum |
| `src/components/category/CategoryGrid.tsx` | Group categories, add tabs |
| `src/components/product/ProductCard.tsx` | Add variant prop for listing types |
| `src/pages/HomePage.tsx` | Category groups, section reorganization |
| `src/pages/SellerDetailPage.tsx` | Dynamic tabs based on seller type |
| `src/pages/CartPage.tsx` | Conditional booking vs cart mode |
| `src/pages/BecomeSellerPage.tsx` | Category group selection |
| `src/pages/AdminPage.tsx` | Add Settings tab with API config |
| `src/hooks/useCart.tsx` | Support booking mode |

---

## Backward Compatibility

All existing food ordering functionality remains unchanged:
- Current sellers continue operating normally
- Existing orders unaffected
- Current cart/checkout flow preserved for food categories
- All existing components remain functional

New categories are additive - they extend the system without breaking it.

---

## Success Metrics

After implementation:
- 12+ service categories available
- 90%+ code reuse from existing food flow
- Category behaviors configurable by admin
- API keys manageable without code changes
- Smooth booking flow for services
- Chat-first flow for resale items
- Date range selection for rentals

---

## Estimated Effort

| Phase | Effort |
|-------|--------|
| Phase A: Foundation | 2 hours |
| Phase B: Category System | 2 hours |
| Phase C: Listing Components | 3 hours |
| Phase D: Booking Flows | 3 hours |
| Phase E: Admin Config | 2 hours |

**Total: ~12 hours of implementation**
