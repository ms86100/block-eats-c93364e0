

## Issue: Admin can't find where to approve the "Paneer" product

**Current State (from database):**
- Seller "Kitchen A SGRF" has `verification_status = 'approved'` (already approved)
- Product "Panner" has `approval_status = 'pending'`

**Where it should appear:**
The admin should go to **Admin → Sellers tab**. The seller should appear there because the pending filter (line 130-134 of `useSellerApplicationReview.ts`) includes sellers with pending products. Since the seller is already approved, per-product Approve/Reject buttons should show (line 222 of `SellerApplicationReview.tsx`).

**However, there's a likely UX issue:** The `AdminProductApprovals` component exists but is **not rendered anywhere** in the AdminPage. This standalone component fetches products with `approval_status = 'pending'` and shows individual approve/reject buttons -- but it was never wired into the admin UI.

### Plan

1. **Add `AdminProductApprovals` to the AdminPage Sellers tab** -- render it below `SellerApplicationReview` so admins have a dedicated "Pending Products" section for post-approval product submissions. This gives admins a clear, focused view of just pending products without needing to expand seller cards.

2. **Verify the Sellers tab filter works** -- The current filter logic should already show "Kitchen A SGRF" in the pending view since it has a pending product. If it's not showing, there may be a data-fetch timing issue. No code change needed if the filter is working.

### Files to modify

1. **`src/pages/AdminPage.tsx`** -- Import and render `AdminProductApprovals` in the Sellers tab content, below `SellerApplicationReview`
