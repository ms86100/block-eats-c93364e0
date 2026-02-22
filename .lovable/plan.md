
# Delivery Integration: Journey Gap Audit

## Executive Summary

After tracing every buyer and seller touchpoint end-to-end, I found **9 gaps** where the connected dots break. None are "new features" -- they are all places where existing implementation doesn't connect properly or leaves users confused.

---

## Gap 1: Fulfillment type is set AFTER order creation (race condition)

**Where it breaks:** `CartPage.tsx` lines 59-88

The `create_multi_vendor_orders` RPC creates orders with `fulfillment_type = 'self_pickup'` (the DB default). Then, a separate UPDATE sets `fulfillment_type = 'delivery'` and `delivery_fee`. But the DB trigger `trg_auto_assign_delivery` fires on order status change to `ready` -- so this isn't immediately broken. However:

- The `delivery_fee` shown to the buyer (line 36) is calculated client-side (`totalAmount >= 500 ? 0 : 20`), but the server-side `calculate_fee` endpoint exists and is never called.
- If the UPDATE fails silently (network blip), the order is created as `self_pickup` but the buyer saw delivery pricing.

**Fix:** Pass `fulfillment_type` and `delivery_fee` into the `create_multi_vendor_orders` RPC itself so the order is created atomically with the correct type.

---

## Gap 2: Order detail bill summary always says "Delivery: FREE"

**Where it breaks:** `OrderDetailPage.tsx` line 395

The bill summary on the order detail page is hardcoded:
```
<span className="text-primary font-medium">FREE</span>
```

It never reads `order.delivery_fee` or `order.fulfillment_type`. A buyer who paid Rs 20 delivery fee sees "FREE" on their receipt.

**Fix:** Read `order.delivery_fee` and `order.fulfillment_type` to display the actual delivery fee or "Self Pickup".

---

## Gap 3: Orders list page doesn't show delivery badge

**Where it breaks:** `OrdersPage.tsx` -- the `OrderCard` component (line 16-79)

The seller dashboard's `SellerOrderCard` shows delivery/pickup badges. But the buyer's order list (`OrdersPage.tsx > OrderCard`) has no delivery indicator at all. A buyer with 5 orders can't tell which are delivery vs pickup from the list.

**Fix:** Add a small truck/package icon or badge to the buyer's order card when `fulfillment_type === 'delivery'`.

---

## Gap 4: Seller action bar allows "Mark Picked Up" for self-pickup orders

**Where it breaks:** `OrderDetailPage.tsx` lines 142-152

The `statusOrder` array includes `picked_up` and `delivered` for ALL orders. The `getNextStatus()` function blindly suggests the next status in sequence. So for a `self_pickup` order at `ready` status, the seller sees "Mark Picked Up" -- which is semantically wrong. For self-pickup orders, the next status after `ready` should be `completed`.

For delivery orders, the seller should NOT be able to advance past `ready` at all -- the delivery system handles `picked_up` and `delivered`.

**Fix:** Adjust `getNextStatus()` to check `fulfillment_type`:
- `self_pickup` + `ready` -> show "Mark Completed"
- `delivery` + `ready` -> hide action button (delivery system takes over)

---

## Gap 5: Delivery fee not included in total_amount

**Where it breaks:** `CartPage.tsx` lines 59-71 and 80-88

`create_multi_vendor_orders` is called with the subtotal (without delivery fee). Then `delivery_fee` is set separately. But `total_amount` on the order doesn't include the delivery fee. The buyer paid `finalAmount` (which includes delivery fee), but the order's `total_amount` only reflects item cost.

This causes:
- Seller earnings reports show the correct item amount (good)
- But the buyer's order receipt says "Total: Rs X" which doesn't match what they actually paid
- Financial reconciliation breaks

**Fix:** Either (a) update `total_amount` to include delivery fee in the post-creation UPDATE, or (b) show delivery fee as a separate line on OrderDetailPage (currently hardcoded to FREE).

---

## Gap 6: Seller can't see delivery status on their order detail

**Where it breaks:** `OrderDetailPage.tsx` line 274

The `DeliveryStatusCard` is only shown when `isBuyerView` logic matches. The card itself renders for both, but the OTP section (lines 142-151) only shows for `isBuyerView`. This is correct for OTP -- sellers shouldn't see the OTP.

However, sellers need to know if a rider has been assigned, if delivery failed, etc. Currently the card shows for sellers too (good), but the status messages at lines 161-169 only render for `isBuyerView`. Sellers see the card but no contextual message.

**Fix:** Add seller-specific status messages (e.g., "Rider assigned, order will be picked up soon", "Delivery completed").

---

## Gap 7: No way to cancel a delivery order after it's picked up

**Where it breaks:** `OrderCancellation.tsx` line 40

Cancellation is only allowed for `placed` and `accepted` statuses. This is correct for self-pickup orders. But for delivery orders, what happens if:
- Buyer wants to cancel after `picked_up`?
- Delivery fails and buyer wants a refund?

The `failed` delivery status updates the order to `returned`, but there's no UI path for the buyer to see what happens next (refund? re-delivery?). The `DeliveryStatusCard` shows "Delivery could not be completed" but no actionable next step.

**Fix:** When delivery fails, show a help/contact action or automatic dispute creation prompt on the `DeliveryStatusCard`.

---

## Gap 8: Seller order query doesn't fetch fulfillment_type

**Where it breaks:** `useSellerOrders.ts` line 131

The seller orders infinite query fetches `*` from orders, which includes `fulfillment_type`. This works because `*` includes all columns. However, the buyer's order list query in `OrdersPage.tsx` (line 113-118) also uses `*`, so it has `fulfillment_type` available -- it's just not displayed (see Gap 3).

No code fix needed here, just confirming the data is available.

---

## Gap 9: Monitoring dashboard stats are wrong

**Where it breaks:** `DeliveryMonitoringTab.tsx` lines 75-81

The stats (`active`, `delivered`, `failed`) are computed from the FILTERED list, not from the total. So if you're viewing the "active" filter, the stats show active count correctly but delivered = 0 and failed = 0. This is misleading -- stats should always reflect the full picture.

**Fix:** Fetch stats independently (a separate count query without filter), or fetch all deliveries once and derive both stats and filtered list from the same dataset.

---

## Implementation Priority

| Gap | Severity | Effort | Description |
|-----|----------|--------|-------------|
| 1   | High     | Medium | Atomic fulfillment_type in RPC |
| 2   | High     | Low    | Fix hardcoded "FREE" on order detail |
| 4   | High     | Low    | Fix seller action bar for delivery orders |
| 5   | High     | Low    | Delivery fee in total or displayed separately |
| 3   | Medium   | Low    | Add delivery badge to buyer order list |
| 6   | Medium   | Low    | Seller-side delivery status messages |
| 7   | Medium   | Medium | Failed delivery next-step UX |
| 9   | Low      | Low    | Fix monitoring dashboard stats |

## Technical Details

### Gap 1 Fix
Modify `create_multi_vendor_orders` RPC to accept `_fulfillment_type text DEFAULT 'self_pickup'` and `_delivery_fee numeric DEFAULT 0` parameters. Apply them during the INSERT instead of requiring a separate UPDATE call.

### Gap 2 Fix
In `OrderDetailPage.tsx` around line 393-396, replace the hardcoded "FREE" with:
- If `fulfillment_type === 'delivery'` and `delivery_fee > 0`: show the fee
- If `fulfillment_type === 'delivery'` and `delivery_fee === 0`: show "FREE"
- If `fulfillment_type === 'self_pickup'`: show "Self Pickup"

### Gap 4 Fix
In `OrderDetailPage.tsx` `getNextStatus()`, add logic:
- If `order.fulfillment_type === 'delivery'` and `order.status === 'ready'`: return `null` (delivery system handles it)
- If `order.fulfillment_type !== 'delivery'` and `order.status === 'ready'`: return `'completed'`

### Gap 5 Fix
In the `CartPage.tsx` post-creation UPDATE (line 82-88), also update `total_amount` to include delivery fee. Or better: fix via Gap 1 by passing it into the RPC.

### Gap 9 Fix
In `DeliveryMonitoringTab`, run a second unfiltered query for just the counts, or fetch all and filter client-side.
