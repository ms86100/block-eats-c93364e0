

# Multi-Society Architecture Redesign

## 1. Current State: What's Actually Broken

### What works well already
- `society_id` exists on 18 core tables (profiles, seller_profiles, all society features)
- RLS uses `get_user_society_id()` security definer function for society-scoped isolation
- Signup flow already binds users to societies via Google Maps + edge function
- Data isolation at the query level is mostly correct

### What will break at 10-15 societies

**A. Admin bottleneck (CRITICAL)**
- Only 3 roles exist: `buyer`, `seller`, `admin`
- "Admin" is a global superuser -- there is no concept of "admin of Society X"
- One admin approves ALL users across ALL societies
- One admin manages ALL disputes, ALL seller approvals, ALL expenses across ALL societies
- At 10 societies x 3,000 residents = 30,000 users, this is operationally impossible

**B. Tables missing society_id (DATA LEAK RISK)**
These tables have NO society_id and NO society-scoped RLS:
- `orders` -- a buyer from Society A can order from a seller in Society B (sellers are society-scoped, but orders don't enforce cross-society restriction)
- `cart_items` -- same problem
- `favorites` -- can favorite sellers from other societies
- `reviews` -- reviews span across societies
- `payment_records` -- financial data not society-scoped
- `reports` -- reports span all societies
- `warnings` -- global warnings table
- `featured_items` -- global featured items
- `category_config` / `parent_groups` -- global categories (this is intentional and correct)
- `admin_settings` -- global (correct, but needs per-society overrides)

**C. Admin dashboard is a flat list**
- `AdminPage.tsx` fetches ALL pending users, ALL sellers, ALL payments globally
- No filtering by society
- No delegation capability
- Society tab exists but only for approving/rejecting societies themselves

**D. No builder concept at all**
- No `builder` entity in the database
- No builder-to-society relationship
- No builder dashboard
- No way for a builder to manage only their societies

## 2. Strategic Solution

### Architecture: Society-Scoped Multi-Tenancy with Delegated Admin

NOT separate databases. NOT separate schemas. Row-level security with a **tiered role system**.

```text
Role Hierarchy:
  platform_admin  -- Sociva team (global access)
  builder         -- Real estate company (manages N societies)  
  society_admin   -- Committee member (manages 1 society)
  seller          -- Vendor within a society
  buyer           -- Resident (default role)
```

### Key Design Decisions
1. Roles remain in `user_roles` table (no profile-level role storage)
2. Add a `builders` table linking builder users to their societies
3. Add `society_admin` role that is scoped via a `society_admins` table
4. Existing `admin` role becomes `platform_admin` (or stays `admin` for backward compat with a rename later)
5. `get_user_society_id()` already handles data isolation -- we extend it, not replace it

## 3. Database Schema Changes

### New tables

**`builders`** -- Builder/developer companies
```text
builders (
  id uuid PK,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo_url text,
  contact_email text,
  contact_phone text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)
```

**`builder_members`** -- Users who belong to a builder org
```text
builder_members (
  id uuid PK,
  builder_id uuid FK -> builders,
  user_id uuid FK -> profiles,
  role text DEFAULT 'member' (member, admin),
  created_at timestamptz DEFAULT now(),
  UNIQUE(builder_id, user_id)
)
```

**`builder_societies`** -- Which societies a builder manages
```text
builder_societies (
  id uuid PK,
  builder_id uuid FK -> builders,
  society_id uuid FK -> societies,
  created_at timestamptz DEFAULT now(),
  UNIQUE(builder_id, society_id)
)
```

**`society_admins`** -- Delegated society-level admins (committee members)
```text
society_admins (
  id uuid PK,
  society_id uuid FK -> societies,
  user_id uuid FK -> profiles,
  role text DEFAULT 'admin' (admin, moderator),
  appointed_by uuid FK -> profiles (nullable),
  created_at timestamptz DEFAULT now(),
  UNIQUE(society_id, user_id)
)
```

### Modify existing tables

**`societies`** -- Add builder relationship
- Add column: `builder_id uuid FK -> builders (nullable)`
- Add column: `auto_approve_residents boolean DEFAULT false`
- Add column: `approval_method text DEFAULT 'manual'` (manual, invite_code, email_domain, auto)

**`user_roles`** -- Add new role values
- The existing `user_role` enum needs: `society_admin`, `builder` added
- OR: keep the enum as-is and use the new `society_admins` / `builder_members` tables for scoped checks (cleaner approach -- avoids enum migration headaches)

### New security definer functions

```text
is_society_admin(_user_id uuid, _society_id uuid) -> boolean
  -- checks society_admins table OR is_admin() for platform admins

is_builder_member(_user_id uuid, _builder_id uuid) -> boolean
  -- checks builder_members table

can_manage_society(_user_id uuid, _society_id uuid) -> boolean
  -- true if: is_admin() OR is_society_admin() OR is builder member of a builder that owns this society
```

### RLS Policy Updates

All admin-gated policies currently using `is_admin(auth.uid())` need to be updated to also accept `is_society_admin(auth.uid(), table.society_id)`. Affected tables:
- `profiles` (user approval)
- `seller_profiles` (seller approval)
- `dispute_tickets` (dispute management)
- `snag_tickets` (snag management)
- `society_expenses` (expense management)
- `construction_milestones` (milestone creation)
- `project_documents` (document upload)
- `emergency_broadcasts` (broadcast creation)
- `maintenance_dues` (dues management)
- `warnings` (issuing warnings)
- `reports` (reviewing reports)

## 4. Frontend Changes

### A. Society Admin Dashboard (New Page: `/society/admin`)

A scoped admin panel that society admins see. Contains:
- Pending user approvals (only for their society)
- Pending seller approvals (only for their society)
- Society settings (name, invite code, auto-approve toggle)
- Delegate moderator access to other residents

This replaces the need for society admins to access the global admin panel.

### B. Builder Dashboard (New Page: `/builder`)

For builder organization members:
- List of their societies with key metrics
- Cross-society aggregate stats
- Ability to post milestones/documents to any of their societies
- Resident management across their portfolio

### C. Admin Page Refactor

The existing `AdminPage.tsx` gets filtered:
- Society admins see only their society's data
- Platform admins see everything (with society filter dropdown)
- Builder members see their builder's societies

### D. AuthContext Update

`AuthContext` needs to expose:
- `isSocietyAdmin` -- derived from `society_admins` table
- `isBuilderMember` -- derived from `builder_members` table
- `managedSocieties` -- list of societies the user can manage

### E. Auto-Approval Flow

When a society has `auto_approve_residents = true`:
- The `validate-society` edge function (or a new trigger) sets `verification_status = 'approved'` immediately on profile insert
- Skip the manual approval queue entirely
- Optionally validate via invite code match (already supported) or email domain

## 5. Implementation Phases

### Phase 1: Delegated Society Admin (Highest impact, unblocks scaling)
1. Create `society_admins` table with RLS
2. Create `is_society_admin()` and `can_manage_society()` security definer functions
3. Update RLS policies on all society-scoped tables to accept society admins
4. Build `/society/admin` page with scoped user/seller approval
5. Update `AuthContext` to check `society_admins`
6. Platform admin can appoint society admins from the existing admin panel

### Phase 2: Auto-Approval (Reduces admin workload by 80%)
1. Add `auto_approve_residents` and `approval_method` columns to `societies`
2. Create a database trigger on `profiles` INSERT: if the user's society has `auto_approve_residents = true`, set `verification_status = 'approved'` immediately
3. Add approval method settings to society admin panel
4. Update `validate-society` edge function to return approval method info

### Phase 3: Builder Infrastructure
1. Create `builders`, `builder_members`, `builder_societies` tables
2. Add `builder_id` to `societies`
3. Create `is_builder_member()` function
4. Build `/builder` dashboard page
5. Allow builders to manage multiple societies from one view

### Phase 4: Commerce Isolation Hardening
1. Add society-scoping validation to `orders` -- a trigger or RLS that ensures buyer and seller are in the same society
2. Add `society_id` to `orders` table (derived from seller's society at order creation time)
3. Update `cart_items` validation -- prevent adding products from sellers outside user's society
4. Scope `featured_items` by society_id
5. Scope `reviews`, `reports`, `warnings` by society_id

### Phase 5: Admin Panel Modernization
1. Add society filter dropdown to global admin panel
2. Show aggregate metrics per society
3. Society admin sees only their panel (redirect from `/admin` to `/society/admin`)
4. Builder admin sees builder dashboard

## 6. Files to Create
```text
src/pages/SocietyAdminPage.tsx        -- Scoped admin dashboard
src/pages/BuilderDashboardPage.tsx     -- Builder portfolio view
src/components/admin/SocietyAdminUsersTab.tsx
src/components/admin/SocietyAdminSellersTab.tsx
src/components/admin/SocietySettingsTab.tsx
src/components/admin/AppointAdminSheet.tsx
```

## 7. Files to Modify
```text
src/contexts/AuthContext.tsx           -- Add isSocietyAdmin, managedSocieties
src/App.tsx                            -- New routes /society/admin, /builder
src/pages/AdminPage.tsx                -- Society filter, redirect logic
src/components/layout/BottomNav.tsx    -- Conditional admin badge
src/pages/SocietyDashboardPage.tsx     -- Link to society admin panel
supabase/functions/validate-society/index.ts -- Auto-approve logic
```

## 8. What This Solves

| Problem | Solution |
|---|---|
| Single admin bottleneck | Society admins handle their own approvals |
| Linear admin workload growth | Auto-approval + delegation = near-zero central workload |
| No builder concept | Builder entity with portfolio management |
| Cross-society data leaks | Commerce isolation + society_id on orders |
| Admin panel unusable at scale | Scoped views per role |
| No governance delegation | society_admin + moderator roles |
| 100 societies = chaos | Each society self-governs; platform admin only handles exceptions |

## 9. What Does NOT Change
- Existing `get_user_society_id()` function (still the backbone)
- Existing RLS patterns (extended, not replaced)
- Existing `user_roles` enum (we add parallel tables instead of modifying the enum)
- Category system (remains global by design)
- Marketplace scoping (already works via society_id on seller_profiles)

