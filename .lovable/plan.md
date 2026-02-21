

## Add Store Settings Step to Seller Onboarding Wizard

### What's Missing Today

The seller onboarding wizard (5 steps: Category > Specialize > Store Details > Products > Review) collects only basic info in Step 3 -- business name, description, hours, COD, and cross-society toggle. But critical operational settings like **fulfillment mode**, **UPI payments**, **operating days**, and **store images** are only available *after* onboarding in the Seller Settings page. New sellers don't discover these until much later, leading to incomplete store setups.

### Solution: Insert a "Store Settings" Step

Add a new **Step 4: Store Settings** between the current "Store Details" (Step 3) and "Products" (Step 4, becomes Step 5). The wizard becomes 6 steps:

```text
1. Category  >  2. Specialize  >  3. Store Details  >  4. Store Settings  >  5. Products  >  6. Review
```

### What Goes Into the New Step 4

All fields are dynamically rendered -- no hardcoded values. Settings pulled from the same form state that `saveDraft()` already persists:

| Section | Fields | Notes |
|---------|--------|-------|
| Fulfillment Mode | Self Pickup / I Deliver / Both + Delivery Note | RadioGroup, same as SellerSettingsPage |
| Payment Methods | COD toggle (move from Step 3), UPI toggle + UPI ID | Conditional UPI ID field |
| Operating Days | Day selector (Mon-Sun checkboxes) | Currently only in SellerSettingsPage |
| Store Images | Profile photo + Cover image uploads | Optional but encouraged |

**Not included** in onboarding (stays in Seller Settings only):
- Bank account details -- not relevant until payouts start post-approval
- "Pause Shop" toggle -- store isn't live yet during onboarding

### What Gets Shown in Step 6 (Review)

The Review summary card will add new rows showing the seller's configured settings:
- Fulfillment mode label
- Payment methods accepted
- Operating days count
- Whether store images were uploaded

### Technical Changes

**File 1: `src/pages/BecomeSellerPage.tsx`**

1. Update `TOTAL_STEPS` from 5 to 6
2. Update `STEP_META` array -- insert new entry at index 3: `{ label: 'Settings', icon: Settings, title: 'Configure your store', helper: 'Set up how you operate -- delivery, payments, and schedule.' }`
3. Add new form fields to `formData` state:
   - `operating_days` (default: all 7 days from `DAYS_OF_WEEK`)
   - `accepts_upi` (default: false)
   - `upi_id` (default: '')
   - `fulfillment_mode` (default: 'self_pickup')
   - `delivery_note` (default: '')
   - `cover_image_url` (default: null)
   - `profile_image_url` (default: null)
4. Move the COD toggle out of Step 3 into the new Step 4
5. Render the new Step 4 UI with:
   - Fulfillment mode RadioGroup (self_pickup / delivery / both) with conditional delivery note input
   - Payment methods section (COD switch + UPI switch with conditional UPI ID)
   - Operating days row (7 day buttons, same pattern as SellerSettingsPage)
   - Store images section (profile + cover using existing `ImageUpload` component)
6. Shift all step number references: current Step 4 (Products) becomes Step 5, current Step 5 (Review) becomes Step 6
7. Update `saveDraft()` to include the new fields: `operating_days`, `accepts_upi`, `upi_id`, `fulfillment_mode`, `delivery_note`, `cover_image_url`, `profile_image_url`
8. Update `handleSubmit()` similarly
9. Update the Review step (now Step 6) summary card to show fulfillment, payment, and schedule info
10. Update "What's Next" hint on Step 3 to say "Next: Configure delivery, payments, and schedule"
11. Add import for `RadioGroup`, `RadioGroupItem` from radix, and `ImageUpload` component, plus icons (`Truck`, `Smartphone`, `Banknote`, `Clock`)
12. Import `DAYS_OF_WEEK` from `@/types/database`

**No other files are modified.** The SellerSettingsPage remains unchanged -- it continues to be the full settings editor post-onboarding.

### Step-by-Step Testing Plan

1. Navigate to `/become-seller`
2. **Step 1**: Select any category group (e.g., Food and Groceries) -- verify it advances to Step 2
3. **Step 2**: Select a subcategory (e.g., Home Food) -- click Continue
4. **Step 3**: Enter business name and description -- verify the "What's Next" hint mentions settings -- click Continue
5. **Step 4 (NEW)**: Verify all sections render:
   - Fulfillment mode defaults to "Self Pickup Only"
   - Select "I Deliver" -- verify delivery note input appears
   - Toggle UPI on -- verify UPI ID input appears
   - Tap operating days to toggle them on/off
   - Upload a profile image (optional)
   - Click Continue
6. **Step 5**: Add at least one product -- click "Review and Submit"
7. **Step 6**: Verify the review summary shows:
   - Business name, category, subcategories (existing)
   - Fulfillment mode, payment methods, operating days (new)
8. Accept declaration and submit -- verify it completes successfully
9. **Draft resume test**: Start onboarding, reach Step 4, click "Save Draft" -- navigate away -- return to `/become-seller` -- verify the wizard resumes with settings preserved
10. **Back navigation test**: On Step 4, click back arrow -- verify it returns to Step 3 with data intact -- go forward again -- verify Step 4 data is preserved

