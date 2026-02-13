

## Fix Plan: Search Box, RLS Error, and Map Pin Address

### Issue 1: Search Box Cut Off

The form content container at line 411 has `overflow-hidden` which clips the search results dropdown and possibly the search input itself on smaller screens. The fix is to remove `overflow-hidden` from the form wrapper or change it to `overflow-visible` so the search results list renders fully.

**File:** `src/pages/AuthPage.tsx`
- Line 411: Change `overflow-hidden` to `overflow-visible` on the form content div.

---

### Issue 2: RLS Error on Society Insert

The network logs show `new row violates row-level security policy for table "societies"` with a **401 status**. The root cause: the user is **not yet authenticated** when they try to insert a new society during signup (both in `handleMapConfirm` and `handleRequestNewSociety`). The RLS policy requires `auth.uid() IS NOT NULL`, but there is no logged-in user at that point.

**Solution:** Move the society creation to the `validate-society` edge function. Instead of inserting directly from the client, send the place details to the edge function which uses the **service role key** to insert the society record. This also improves security since unauthenticated users cannot directly write to the societies table.

However, since the user hasn't signed up yet, they also don't have a JWT token. The cleanest approach is to:

1. **Defer society creation** -- store the Google Place details in local state during signup.
2. **After signup completes** (in `handleSignupComplete`), create the society via the `validate-society` edge function (which already uses the service role).
3. Update the edge function to accept optional society creation data (`new_society` object) alongside `society_id`. If `new_society` is provided and no `society_id` exists, the function creates the society first, then assigns it.

**Files:**
- `src/pages/AuthPage.tsx` -- Remove direct `supabase.from('societies').insert()` calls from `handleMapConfirm` and `handleRequestNewSociety`. Instead, store pending society data in state and process it during `handleSignupComplete`.
- `supabase/functions/validate-society/index.ts` -- Add logic to create a new society (with `is_active: false`, `is_verified: false`) when a `new_society` payload is provided, then assign it to the user.

---

### Issue 3: Map Pin Address Not Updating (Reverse Geocoding)

The `GoogleMapConfirm` component updates coordinates when the pin is dragged but never performs reverse geocoding to update the displayed address.

**Solution:** Add a `google.maps.Geocoder` call on pin drag-end to fetch the new address and display it dynamically.

**File:** `src/components/auth/GoogleMapConfirm.tsx`
- Add state for the displayed address name (initialized from the `name` prop).
- On pin `dragend`, call `new google.maps.Geocoder().geocode()` with the new coordinates.
- Parse the result to update the displayed address text in real-time.
- Pass the updated address back via `onConfirm` so the parent can use it.

---

### Technical Summary of Changes

| File | Change |
|------|--------|
| `src/pages/AuthPage.tsx` | Fix `overflow-hidden`, defer society creation to post-signup via edge function |
| `src/components/auth/GoogleMapConfirm.tsx` | Add reverse geocoding on pin drag to update displayed address |
| `supabase/functions/validate-society/index.ts` | Accept `new_society` payload to create + assign society server-side |

