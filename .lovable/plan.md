

## Add "Add Another Business" to Seller Dashboard and Fix Profile Menu

### Problem
1. Once a user becomes a seller, the Profile page still shows "Become a Seller" -- but it links to the same onboarding flow. There is no clear "Add Another Business" option on the Seller Dashboard.
2. Non-sellers see "Become a Seller" in the profile menu, which is correct, but sellers should see "Seller Dashboard" instead -- and currently the logic may not reflect the right label consistently.

### Changes

#### 1. Profile Page (`src/pages/ProfilePage.tsx`)
- Update the menu items logic:
  - If the user **is a seller**: show "Seller Dashboard" linking to `/seller`
  - If the user **is not a seller**: show "Become a Seller" linking to `/become-seller`
- Remove the duplicate/confusing entry so only one of the two appears (this is already partially done but we will ensure it is clean).

#### 2. Seller Dashboard - Quick Actions (`src/components/seller/QuickActions.tsx`)
- Add a third action card: **"Add Another Business"** that links to `/become-seller`
- This gives existing sellers a clear, visible way to register a second store under a different category group
- Will use a `StorePlus` or similar icon with descriptive text like "Register new store"

#### 3. Layout adjustment
- Change QuickActions from a 2-column grid to a 3-column grid to accommodate the new card, keeping it compact on mobile

### Technical Details

**ProfilePage.tsx** -- menu items array change:
```
// Replace the current conditional with:
isSeller
  ? { icon: Store, label: 'Seller Dashboard', to: '/seller' }
  : { icon: Store, label: 'Become a Seller', to: '/become-seller' }
```

**QuickActions.tsx** -- add third card:
```
// Add "Add Another Business" card linking to /become-seller
// with a PlusCircle icon and subtitle "Register new store"
// Change grid to grid-cols-3
```

