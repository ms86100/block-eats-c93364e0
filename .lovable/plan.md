# Plan: Category-Aware Order Lifecycle with Live Tracking & ETA

## Current State Summary

**What exists:**

- `order_status_config` table: 13 statuses (placed → returned), flat list, no category association
- `category_config` table: 30+ categories with `transaction_type`, `requires_delivery`, `requires_preparation`, `is_physical_product` flags
- `delivery_assignments` table: full rider assignment with OTP, status tracking, timestamps
- `delivery_tracking_logs` table: has `location_lat`, `location_lng`, `source` fields — but NO GPS data ever written
- `DeliveryStatusCard`: shows delivery progress (pending → assigned → picked_up → at_gate → delivered) with Realtime subscription — but NO map, NO ETA, NO distance
- `useOrderDetail.ts`: hardcoded `statusOrder` arrays, seller can push ANY status forward (no constraint enforcement)
- Order detail page: 4-step timeline (placed/accepted/preparing/ready), no post-ready visibility for buyer

**What's broken/missing:**

1. Status flow is hardcoded per order, not driven by category
2. Seller can manually advance to ANY next status (no constraints)
3. No GPS location tracking for delivery partners
4. No ETA calculation
5. No live map on buyer order screen
6. No "arriving soon" / "X meters away" proximity awareness
7. No category-specific status sequences in the database

---

## Implementation Plan (6 Phases)

### Phase 1: Category-Aware Status Flow Configuration (Database)

**New table:** `category_status_flows`

```sql
CREATE TABLE public.category_status_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_group text NOT NULL,           -- 'food', 'services', 'classes', etc.
  transaction_type text NOT NULL,       -- 'cart_purchase', 'request_service', 'book_slot'
  status_key text NOT NULL,             -- references order_status_config.status_key
  sort_order int NOT NULL,
  actor text NOT NULL DEFAULT 'seller', -- 'seller', 'system', 'delivery', 'buyer'
  is_terminal boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(parent_group, transaction_type, status_key)
);
```

Seed rows for 3 flows:

- **Food/Grocery** (cart_purchase + food): placed → accepted → preparing → ready → picked_up → on_the_way → delivered → completed
- **Services** (request_service): enquired → accepted → assigned → on_the_way → arrived → in_progress → completed
- **Classes/Bookings** (book_slot): enquired → accepted → scheduled → in_progress → completed

Add `on_the_way` and `arrived` to `order_status_config` if missing.

**New DB function: `get_allowed_transitions(order_id, actor)**`

- Returns only the next valid status based on category flow + current status + actor role
- Seller cannot advance past `ready` for delivery orders
- System/delivery actor handles `picked_up` → `delivered`

**New trigger: `validate_order_status_transition**`

- BEFORE UPDATE on orders, validates that `NEW.status` is a legal transition from `OLD.status` per the category flow
- Rejects seller attempts to set `picked_up`, `delivered`, `on_the_way` directly

### Phase 2: Seller Constraint Enforcement

**Modify `useOrderDetail.ts`:**

- Replace hardcoded `statusOrder` with a query to `category_status_flows` filtered by the order's category `parent_group` + `transaction_type`
- `getNextStatus()` filters by `actor = 'seller'` — seller only sees seller-actionable transitions
- After `ready` for delivery orders: show "Awaiting delivery pickup" (already partially done)

**Modify `OrderDetailPage.tsx`:**

- Timeline steps driven by category flow, not hardcoded 4 steps
- Show full flow including delivery steps (read-only for seller)

### Phase 3: GPS Location Tracking for Delivery Partners

**New table:** `delivery_locations`

```sql
CREATE TABLE public.delivery_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES delivery_assignments(id),
  partner_id uuid NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  speed_kmh double precision,
  heading double precision,
  accuracy_meters double precision,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_locations;

-- Index for fast lookups
CREATE INDEX idx_delivery_locations_assignment ON delivery_locations(assignment_id, recorded_at DESC);
```

RLS: Buyer of the order + seller of the order + admin can SELECT. Delivery partner can INSERT (own partner_id only).

**New edge function:** `update-delivery-location`

- Accepts `{ assignment_id, latitude, longitude, speed_kmh, heading, accuracy_meters }`
- Validates partner owns the assignment
- Inserts into `delivery_locations`
- Calculates ETA based on distance to buyer society + speed
- Updates `delivery_assignments` with computed `eta_minutes` and `distance_meters` (new columns)
- Auto-transitions status to `arriving_soon` when < 500m, updates to `nearby` when < 50m (future-ready)

**New columns on** `delivery_assignments`**:**

```sql
ALTER TABLE delivery_assignments
  ADD COLUMN eta_minutes int,
  ADD COLUMN distance_meters int,
  ADD COLUMN last_location_lat double precision,
  ADD COLUMN last_location_lng double precision,
  ADD COLUMN last_location_at timestamptz;
```

### Phase 4: Live Buyer Tracking UI

**New component: `LiveDeliveryTracker.tsx**`

- Replaces static `DeliveryStatusCard` when delivery is in transit
- Shows: rider name, phone, ETA countdown, distance
- Google Maps embed showing rider's live position (using existing `@types/google.maps` dependency)
- Realtime subscription on `delivery_locations` for the assignment
- Proximity messages: "X km away", "Arriving in X min", "At your doorstep"

**Modify `OrderDetailPage.tsx`:**

- When order status is `picked_up` / `on_the_way` / `at_gate`: render `LiveDeliveryTracker` instead of static card
- Full category-aware timeline replacing the 4-dot static timeline

**New hook: `useDeliveryTracking(assignmentId)**`

- Subscribes to Realtime on `delivery_locations` filtered by `assignment_id`
- Subscribes to Realtime on `delivery_assignments` for status/ETA changes
- Returns `{ riderLocation, eta, distance, status, riderName, riderPhone }`

### Phase 5: Notification Triggers for New Statuses

**Update `enqueue_order_status_notification` DB trigger:**

- Add notification templates for new statuses: `on_the_way`, `arriving_soon`, `arrived`, `assigned`
- Buyer messages: "🛵 Your order is on the way!", "📍 Arriving in X minutes", "🏠 Delivery partner has arrived"

**Update `order-notification-titles.ts`:**

- Add matching client-side title map entries

**ETA-based notifications (via edge function):**

- `update-delivery-location` triggers push when ETA drops below 5 min (once per delivery)
- Triggered at < 200m distance: "Almost there!"

### Phase 6: Edge Cases & Fallbacks

**Idle/stopped detection:**

- If no location update for 3+ minutes during `picked_up`/`on_the_way`: mark assignment `stalled` flag, notify buyer "Delivery partner may be delayed"

**GPS signal lost:**

- Show "Last seen X min ago" with last known location on map
- Graceful degradation: hide map, show text-only status

**Order returned/failed:**

- `delivery_assignments.status = 'failed'` already handled in UI
- Add `returned` status to delivery flow for physical goods

**Partial delivery:** 

- Future-ready via existing `order_items.status` per-item tracking

---

## Technical Notes

- **No polling for tracking:** All live data uses Supabase Realtime subscriptions on `delivery_locations` and `delivery_assignments`
- **ETA calculation:** Haversine distance / current speed, with 1.3x road factor. Computed server-side in edge function.
- **Google Maps:** Already have `@types/google.maps` installed. Will need `GOOGLE_MAPS_API_KEY` added as a secret for the embed.
- **Status transition enforcement** is at the DB trigger level — cannot be bypassed from any client.

## Files to Create/Modify


| Action | File                                                                        |
| ------ | --------------------------------------------------------------------------- |
| Create | `supabase/migrations/xxx_category_status_flows.sql`                         |
| Create | `supabase/functions/update-delivery-location/index.ts`                      |
| Create | `src/hooks/useDeliveryTracking.ts`                                          |
| Create | `src/hooks/useCategoryStatusFlow.ts`                                        |
| Create | `src/components/delivery/LiveDeliveryTracker.tsx`                           |
| Modify | `src/hooks/useOrderDetail.ts` — dynamic status flow                         |
| Modify | `src/pages/OrderDetailPage.tsx` — category-aware timeline + live tracker    |
| Modify | `src/components/delivery/DeliveryStatusCard.tsx` — integrate with live data |
| Modify | `src/lib/order-notification-titles.ts` — new status titles                  |
| Modify | `supabase/config.toml` — new edge function entry                            |
