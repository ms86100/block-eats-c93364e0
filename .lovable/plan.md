

# Multi-Society Expansion and Legal Compliance Plan

## Part 1: Expanding Beyond a Single Society

### Current Architecture Limitations

The app is currently hardcoded for "Shriram Greenfield" in multiple places:
- **Auth page**: Hardcoded blocks (A-J), phases (Phase 1, Phase 2), and branding ("Shriram Greenfield Marketplace")
- **Home page**: "Near Block {block}" assumes a single society
- **Profile table**: Stores `block`, `flat_number`, `phase` -- no society reference
- **Seller discovery**: Queries all approved sellers globally with no society scoping
- **No society/community table exists** in the database

---

### Proposed Multi-Society Architecture

#### 1. New Database Entity: `societies`

A new `societies` table becomes the central grouping mechanism:

| Column | Type | Purpose |
|---|---|---|
| id | uuid | Primary key |
| name | text | Display name (e.g., "Shriram Greenfield") |
| slug | text (unique) | URL-friendly identifier |
| address | text | Full address |
| city | text | City name |
| state | text | State |
| pincode | text | PIN code |
| latitude | numeric | GPS latitude |
| longitude | numeric | GPS longitude |
| geofence_radius_meters | integer | Radius for location-based verification (default 500m) |
| is_verified | boolean | Admin-approved society |
| is_active | boolean | Currently accepting users |
| admin_user_id | uuid | Society admin/first verifier |
| created_at | timestamptz | Creation timestamp |
| member_count | integer | Cached count of approved members |
| logo_url | text | Society branding |
| rules_text | text | Community-specific rules |

#### 2. User-Society Relationship

Add `society_id` (uuid, foreign key) to the `profiles` table. Every user belongs to exactly one society. This scopes all marketplace activity.

#### 3. Society Grouping Logic (The "Blinkit Model")

**How users join a society:**

1. During signup, after entering credentials, the user is asked to **search for their society** by name or PIN code
2. If a matching society exists, the user selects it and fills in their block/flat details
3. If no society exists, the user can **request creation** of a new society (enters society name, address, PIN code, and optionally shares GPS location)
4. A platform admin reviews and approves new society requests

**Auto-grouping rule:** All users who select the same society (regardless of tower/block/flat) are grouped together and see only sellers within that society.

**Location verification (optional, Phase 2):**
- Use the browser Geolocation API (or Google Maps API) during signup to verify the user is physically near the society's coordinates
- Compare user's GPS against the society's lat/lng within the `geofence_radius_meters`
- This prevents fraudulent signups from outside the society

#### 4. Data Scoping Changes

Every major query gets a `society_id` filter:
- **Seller discovery**: `WHERE seller.society_id = current_user.society_id`
- **Search**: Only returns results from the user's society
- **Favorites, orders, reviews**: Already user-scoped, but sellers themselves are society-scoped
- **"Near Block" section**: Works within a society context (already does)

The `seller_profiles` table also gets a `society_id` column so sellers are registered within a specific community.

#### 5. Society Verification Methods

| Method | Complexity | Description |
|---|---|---|
| Admin manual approval | Low | Platform admin verifies each society request (current model, extended) |
| GPS geofencing | Medium | Verify user location is within society radius during signup |
| Society code/invite | Low | Society admin shares a unique code; new members enter it to join |
| Document upload | High | Upload utility bill or society ID card (future phase) |

**Recommended approach:** Start with **admin approval + optional society invite code**, then add GPS verification later.

#### 6. UI Changes Required

- **Auth page**: Replace hardcoded block/phase dropdowns with a society search + dynamic block/flat fields
- **Home page**: Replace "Shriram Greenfield" branding with `society.name`
- **Landing page**: Remove society-specific references; make it a generic platform landing
- **Become Seller page**: Auto-associate seller with user's society
- **Admin page**: Add society management section (approve/reject societies, view member counts)
- **Profile page**: Show society name, allow requesting transfer (future)

---

## Part 2: Legal and Compliance Research

### Category-wise Regulatory Requirements (India)

#### Food Categories (home_food, bakery, snacks, beverages, groceries)

| Requirement | Details |
|---|---|
| **FSSAI Registration** | **Mandatory** for all food businesses. Home kitchens with annual turnover under 12 lakhs need basic FSSAI Registration (Form A, fee ~100 INR). Above 12 lakhs requires State License. |
| **FSSAI License Number Display** | Must be displayed on all food packaging/listings. The platform should have a field for sellers to enter their FSSAI number. |
| **Hygiene Standards** | Must comply with Schedule 4 of FSS Act (sanitary conditions, water quality, pest control) |
| **Labeling** | Packaged food must show: ingredients, net quantity, date of manufacture, best before, FSSAI logo + license number |
| **GST** | Food items generally attract 5% GST. Sellers with turnover above 20 lakhs (or 40 lakhs for goods-only in some states) must register for GST |

**Platform obligation:** Display a disclaimer that food sellers must hold valid FSSAI registration. Collect and display FSSAI numbers on seller profiles. Consider making FSSAI number a required field for food category sellers.

#### Home Services (electrician, plumber, carpenter, ac_service, pest_control)

| Requirement | Details |
|---|---|
| **No specific license** for basic services | Electricians, plumbers, carpenters generally don't need government licenses for residential work in India |
| **Pest Control** | Requires a license from the Central Insecticides Board under the Insecticides Act, 1968 |
| **GST** | Services above 20 lakh turnover threshold require GST registration. The platform should collect GSTIN if applicable |
| **Insurance** | No legal mandate, but platform should recommend professional liability insurance |

#### Personal Services (beauty, salon, mehendi, tailoring)

| Requirement | Details |
|---|---|
| **Trade License** | May require municipal trade license depending on city |
| **GST** | Standard 18% GST on beauty/salon services above threshold |
| **Product safety** | If beauty products are used, they must be BIS/CDSCO approved |

#### Professional Services (tax_consultant, tutoring)

| Requirement | Details |
|---|---|
| **Professional qualification** | Tax consultants must be registered CAs/tax practitioners |
| **No platform-level licensing** | The platform operates as a marketplace connector |

#### Rentals and Buy/Sell (equipment, furniture, electronics)

| Requirement | Details |
|---|---|
| **No special license** | Peer-to-peer sales within a community don't require special licensing |
| **Consumer Protection Act** | Seller must disclose item condition accurately; platform must provide grievance redressal |
| **E-waste** | Electronics resale must comply with E-Waste Management Rules, 2022 |

---

### Platform-Level Legal Obligations

#### 1. Consumer Protection (E-Commerce) Rules, 2020

As a **marketplace e-commerce entity**, the platform must:

- **Appoint a Grievance Officer** with name, contact details, and designation displayed on the platform
- **Acknowledge complaints within 48 hours** and resolve within 1 month
- **Display seller information**: Name, address, contact details, rating, GSTIN (if applicable)
- **Provide order cancellation mechanism** and refund policy
- **Not manipulate** prices or adopt unfair trade practices
- **Maintain records** of transactions for specified periods
- **Fall-back liability**: If a seller fails to deliver or delivers defective goods, the marketplace may be held liable if it fails to take action

#### 2. GST Obligations for the Platform

- If the platform charges a commission/platform fee, the platform entity itself needs GST registration
- **TCS (Tax Collected at Source)**: E-commerce operators must collect TCS at 1% (0.5% CGST + 0.5% SGST) on net taxable supplies made through the platform, if the operator facilitates the supply
- Individual sellers earning below 20 lakhs may be exempt from GST registration, but the platform must still comply with TCS if applicable

#### 3. Digital Personal Data Protection Act (DPDPA), 2023

- Obtain explicit consent before collecting personal data
- Allow users to request data deletion (already implemented via Delete Account feature)
- Appoint a Data Protection Officer if processing significant volumes
- Data localization: Store Indian users' data within India (Lovable Cloud servers should be checked)

#### 4. Information Technology Act, 2000

- Platform qualifies as an "intermediary" under Section 2(1)(w)
- Must publish Terms of Service and Privacy Policy (already done)
- Must take down unlawful content upon receiving actual knowledge
- Must implement due diligence as per IT Intermediary Guidelines, 2021

---

### Buyer-Seller Account: Same or Separate?

**Recommendation: Keep unified accounts (current approach is correct)**

| Factor | Same Account | Separate Accounts |
|---|---|---|
| User experience | Simple, one login | Friction, users must manage two accounts |
| Legal precedent | Swiggy, Dunzo, Urban Company all allow dual roles | No Indian regulation requires separation |
| Liability | Clear role distinction via `user_roles` table | Adds complexity without legal benefit |
| Data integrity | Already handled via seller_profiles + user_roles | Duplicate profile data, sync issues |
| Community context | Natural -- a neighbor can both buy and sell | Unnatural for a community marketplace |

**Legal note:** There is no Indian regulation requiring buyer and seller accounts to be separate. The Consumer Protection Act distinguishes between "seller" and "e-commerce entity" but places no restriction on a user acting in both capacities. The current architecture with role-based access is legally sound.

---

### Liability and Risk Mitigation

1. **Platform disclaimer**: The platform is a marketplace facilitator, not the seller. Add clear Terms stating the platform does not manufacture, store, or deliver goods.
2. **Seller onboarding declarations**: During seller registration, require sellers to declare:
   - They hold necessary licenses (FSSAI for food, etc.)
   - They are responsible for product quality and safety
   - They will comply with applicable laws
3. **Insurance**: Consider requiring or recommending liability insurance for high-risk categories (food, pest control, electrical work)
4. **Dispute resolution**: Implement a structured grievance mechanism with escalation to the Grievance Officer

---

## Part 3: Technical Implementation Roadmap

### Phase 1 -- Society Infrastructure (Database + Auth)
- Create `societies` table with location, verification, and branding fields
- Add `society_id` to `profiles` and `seller_profiles` tables
- Migrate existing users to a default "Shriram Greenfield" society
- Update signup flow: society search/selection before block/flat entry
- Add RLS policies scoping data access by society

### Phase 2 -- Scoped Marketplace
- Update all seller/product queries to filter by `society_id`
- Update home page, search, and category pages to be society-aware
- Dynamic branding (society name, logo) throughout the app
- Society-specific admin panel for community managers

### Phase 3 -- Verification and Growth
- GPS-based location verification during signup
- Society invite code system
- Society admin role (community manager who approves residents)
- Inter-society visibility toggle (future: browse other societies)

### Phase 4 -- Compliance Features
- FSSAI number field on seller profiles (required for food categories)
- Seller declaration checkbox during onboarding
- Grievance Officer contact display
- TCS calculation engine (if platform charges commission)
- Data export/deletion compliance tools

