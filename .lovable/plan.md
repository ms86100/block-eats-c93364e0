
# Sociva Full Role-Based Dynamic Integrity Audit

## Audit Summary

This audit evaluates every module against five criteria: (1) database-backed, (2) no hardcoded values, (3) proper UI per stakeholder, (4) server-side permission enforcement, (5) dynamic adaptation by role and society config.

---

## MODULE-BY-MODULE ASSESSMENT

### A. FULLY DYNAMIC AND CORRECT

| Module | DB-Backed | Feature-Gated | RLS | Role Check | Notes |
|---|---|---|---|---|---|
| Marketplace (products, sellers, categories) | Yes - `category_config`, `parent_groups`, `system_settings` | Via `SocietyDashboardPage` featureKey | Yes | Yes | Categories, layout types, action types, badges all DB-driven |
| Feature Package Hierarchy | Yes - `platform_features`, `feature_packages`, `feature_package_items`, `builder_feature_packages`, `society_feature_overrides` | `get_effective_society_features` RPC | Yes (SECURITY DEFINER) | Yes - 4-tier cascade | Fully correct |
| Auth / Roles | Yes - `user_roles`, `society_admins`, `builder_members`, `security_staff` | N/A | Yes | `has_role()`, `is_admin()`, `is_society_admin()`, `is_security_officer()` - all SECURITY DEFINER | Correct |
| Society Scoping | Yes - `effectiveSocietyId` with context switching | N/A | Yes - `get_user_society_id()` | Write isolation enforced via `can_write_to_society()` | Correct |
| Order Lifecycle | Yes - status transitions enforced via DB trigger `validate_order_status_transition` | N/A | Yes | Buyer/seller/admin scoped | Correct |
| Construction Progress | Yes | `FeatureGate feature="construction_progress"` | Yes | Society-scoped | Correct |
| Snag Management | Yes | `FeatureGate feature="snag_management"` | Yes | Society-scoped | Correct |
| Community Bulletin | Yes | `FeatureGate feature="bulletin"` | Yes | Society-scoped | Correct |
| Disputes | Yes | `FeatureGate feature="disputes"` | Yes | Submitter + society admin | Correct |
| Finances | Yes | `FeatureGate feature="finances"` | Yes | Society-scoped | Correct |
| Workforce Management | Yes | `FeatureGate feature="workforce_management"` | Yes | Worker validation via `validate_worker_entry()` RPC | Correct |
| Worker Marketplace | Yes | `FeatureGate feature="worker_marketplace"` | Yes | Atomic accept/complete via RPCs | Correct |
| Seller Dashboard | Yes | Role-gated (`isSeller`) | Yes | Own seller_id scoped | Correct |
| Builder Dashboard | Yes | Role-gated (`isBuilderMember`) | Yes | `is_builder_for_society()` | Correct |
| Guard Kiosk | Yes | `SecurityRoute` + `is_security_officer` RPC | Yes | DB-backed security_staff check | Correct |
| System Settings | Yes - `system_settings` table | N/A | Yes | Admin-only writes | Tagline, fees, emails, content all DB-driven |
| Audit Log | Yes - append-only | N/A | Yes | Actor-based insert | Correct |

### B. HARDCODED OR PARTIALLY DYNAMIC AREAS

#### B1. CRITICAL - Hardcoded Status/Type Labels (Frontend-Only Display Maps)

| Item | Location | Issue | Severity |
|---|---|---|---|
| `ORDER_STATUS_MAP` | `src/types/database.ts:321-335` | 13 order statuses with labels and colors are hardcoded as a JS object. If a new status is added to the DB trigger, the UI shows "Unknown" | **Medium** |
| `ITEM_STATUS_LABELS` | `src/types/database.ts:236-243` | Item statuses hardcoded | **Medium** |
| `PAYMENT_STATUS_LABELS` | `src/types/database.ts:343-351` | Payment statuses hardcoded | **Low** |
| `STATUS_BADGES` in `DeliveryMonitoringTab` | `src/components/delivery/DeliveryMonitoringTab.tsx:26` | Delivery statuses hardcoded | **Low** |
| `STATUS_COLORS` in `ResidentJobsList` | `src/components/worker/ResidentJobsList.tsx:18` | Worker job statuses hardcoded | **Low** |
| `PRODUCT_ACTION_TYPES` | `src/types/database.ts:127-136` | Product action types with labels/icons hardcoded | **Medium** |
| `ACTION_CONFIG` | `src/lib/marketplace-constants.ts:8-17` | Duplicate action config, also hardcoded | **Medium** |
| `SORT_OPTIONS` | `src/lib/marketplace-constants.ts:20-27` | Sort options hardcoded | **Low** |

**Assessment**: These are display-layer mappings. The DB enforces valid values via triggers. Adding a new status to the DB without updating frontend code causes graceful degradation ("Unknown" label via Proxy). This is acceptable for a V1 but not enterprise-grade SaaS.

#### B2. CRITICAL - Hardcoded Domestic Help Types

| Item | Location | Issue | Severity |
|---|---|---|---|
| `HelpType` union | `src/pages/DomesticHelpPage.tsx:24` | `'maid' | 'cook' | 'driver' | 'nanny' | 'gardener' | 'other'` hardcoded | **High** |
| `helpTypeLabels` | `src/pages/DomesticHelpPage.tsx:26-33` | Labels and emojis hardcoded | **High** |

**Assessment**: The workforce management module has DB-driven worker categories via `worker_categories` table, but the legacy `DomesticHelpPage` still uses hardcoded types. This is a **duplicate system** that should be deprecated.

#### B3. CRITICAL - Hardcoded Visitor Types

| Item | Location | Issue | Severity |
|---|---|---|---|
| `VisitorType` union | `src/pages/VisitorManagementPage.tsx:29` | `'guest' | 'delivery' | 'cab' | 'domestic_help' | 'contractor'` hardcoded | **High** |
| `VisitorStatus` union | `src/pages/VisitorManagementPage.tsx:30` | `'expected' | 'checked_in' | 'checked_out' | 'cancelled' | 'expired'` hardcoded | **Medium** |

**Assessment**: No `visitor_types` config table exists. Adding a new visitor type requires a code change.

#### B4. HIGH - Feature Labels Hardcoded in Society Admin

| Item | Location | Issue | Severity |
|---|---|---|---|
| `FEATURE_LABELS` | `src/pages/SocietyAdminPage.tsx:29-48` | 18 feature labels and descriptions hardcoded in frontend | **High** |

**Assessment**: The `platform_features` table exists but does not have `display_name` or `description` columns. The UI falls back to a hardcoded map. If a new feature is added to the DB, the Society Admin page won't show a label for it.

#### B5. MEDIUM - Approval Methods Hardcoded

| Item | Location | Issue | Severity |
|---|---|---|---|
| Approval method options | `src/pages/SocietyAdminPage.tsx:421-424` | `manual`, `invite_code`, `auto` hardcoded in a Select dropdown | **Medium** |

#### B6. LOW - Days of Week Hardcoded

| Item | Location | Issue | Severity |
|---|---|---|---|
| `DAYS_OF_WEEK` / `DAY_LABELS` | `src/types/database.ts:354-365` | Hardcoded but universal constants, acceptable | **Low** |

---

### C. MISSING UI FOR STAKEHOLDERS

#### C1. Delivery Partner - No Dedicated UI

| Issue | Severity |
|---|---|
| `delivery_partner_pool` table exists with RLS, but the `DeliveryPartnerManagementPage` is an admin-facing CRUD, not a delivery partner's own operational UI | **High** |
| No delivery partner login flow, no "my assigned deliveries" view, no delivery completion workflow from the partner's perspective | **High** |
| `delivery_assignments` exist but partners cannot self-serve (accept, update status, navigate) | **High** |

#### C2. Worker - Partial UI

| Issue | Severity |
|---|---|
| Workers can view and accept jobs (`WorkerJobsPage`, `WorkerMyJobsPage`) | Implemented |
| Workers cannot view their own attendance history, leave records, or salary records from their perspective | **Medium** |
| `WorkerAttendancePage`, `WorkerLeavePage`, `WorkerSalaryPage` exist but are admin-facing, not worker-self-service | **Medium** |

#### C3. Resident - Missing Navigation Links

| Issue | Severity |
|---|---|
| `AuthorizedPersonsPage` exists but no link from Profile or Society Dashboard | **Medium** |
| `MyWorkersPage` exists but no link from Society Dashboard | **Medium** |
| `WorkerLeavePage` / `WorkerSalaryPage` exist but no navigation from any resident-facing page | **Medium** |
| `WorkerAttendancePage` has no navigation link | **Medium** |

#### C4. Guard - Redundant Pages

| Issue | Severity |
|---|---|
| `/security/verify` still exists as a separate route even though `GuardKioskPage` has a "Manual" tab. Guard bottom nav still points to `/security/verify` instead of `/guard-kiosk` | **Medium** |

---

### D. BACKEND FEATURES WITHOUT USABLE UI

| DB Feature | Table/Function | UI Status | Severity |
|---|---|---|---|
| `auto_checkout_visitors()` | DB function exists | No manual trigger or status display | **Low** (cron-only) |
| `apply_maintenance_late_fees()` | DB function exists | No UI to view late fees applied, no admin trigger | **Medium** |
| `notify_upcoming_maintenance_dues()` | DB function exists | No cron scheduled, no UI | **Medium** |
| `log_worker_gate_attendance()` | DB function exists | Attendance auto-logged but no attendance analytics UI | **Low** |
| `get_unified_gate_log()` | DB RPC exists | `GuardGateLogTab` calls it - OK | Implemented |
| `auto_create_parcel_on_delivery()` | DB trigger exists | No UI indication that parcels auto-appear | **Low** |
| `society_budgets` table | Table with RLS exists | `BudgetManager` component exists - OK | Implemented |
| `authorized_persons` table | Table with RLS exists | `AuthorizedPersonsPage` exists but unreachable from nav | **Medium** |
| `worker_leave_records` table | Table with RLS exists | Page exists but unreachable | **Medium** |
| `worker_salary_records` table | Table with RLS exists | Page exists but unreachable | **Medium** |

---

### E. PAGES MISSING `FeatureGate`

These pages are feature-dependent but lack `FeatureGate` wrapping:

| Page | Expected Feature Key | Severity |
|---|---|---|
| `MaintenancePage` | `maintenance` | **High** |
| `VisitorManagementPage` | `visitor_management` | **High** |
| `DomesticHelpPage` | `domestic_help` | **High** |
| `VehicleParkingPage` | `vehicle_parking` | **High** |
| `ParcelManagementPage` | `parcel_management` | **High** |
| `InspectionChecklistPage` | `inspection` | **High** |
| `PaymentMilestonesPage` | `payment_milestones` | **High** |
| `SocietyNoticesPage` | (no feature key) | **Medium** |
| `AuthorizedPersonsPage` | `visitor_management` | **Medium** |

**Assessment**: The `SocietyDashboardPage` hides cards based on feature flags, but if a user navigates directly to the URL, they bypass the gate entirely. This is a **visibility-without-enforcement** gap.

---

### F. ROUTE-LEVEL PERMISSION GAPS

| Route | Current Protection | Missing | Severity |
|---|---|---|---|
| `/society/admin` | `ProtectedRoute` only | No `isSocietyAdmin` check at route level (page does internal check but renders before redirect) | **High** |
| `/builder` | `ProtectedRoute` only | No `isBuilderMember` check at route level | **High** |
| `/builder-inspections` | `ProtectedRoute` only | No builder role check | **High** |
| `/builder/analytics` | `ProtectedRoute` only | No builder role check | **High** |
| `/seller` | `ProtectedRoute` only | No seller check (page handles gracefully but renders) | **Medium** |
| `/delivery-partners` | `ProtectedRoute` only | No admin/society admin check | **High** |
| `/worker-attendance` | `ProtectedRoute` only | No admin/society admin check | **High** |
| `/worker-leave` | `ProtectedRoute` only | No admin/society admin check | **Medium** |
| `/worker-salary` | `ProtectedRoute` only | No admin/society admin check | **Medium** |

---

## GAP CLASSIFICATION SUMMARY

### Critical (Breaks Production Credibility)
1. **No FeatureGate on 7+ pages** - Users can directly navigate to disabled features
2. **No route-level guards** for society admin, builder, and management pages
3. **Domestic Help is a duplicate system** with hardcoded types while Workforce Management has DB-driven categories

### High (Breaks Scalability or Role Integrity)
4. Feature labels hardcoded in `SocietyAdminPage` instead of from `platform_features` table
5. Visitor types hardcoded (no config table)
6. Delivery Partner has no self-service UI
7. Created pages (authorized persons, worker leave/salary/attendance) have no navigation links

### Medium (Partial Implementation)
8. Order/payment/item status labels are frontend-only display maps
9. Product action types duplicated between two files
10. Late fee function exists but no UI to view/trigger
11. Guard bottom nav still points to old `/security/verify` route
12. Approval methods hardcoded in dropdown

### Low (Technical Debt)
13. Sort options hardcoded (acceptable for now)
14. Days of week hardcoded (universal constant)
15. Auto-checkout and attendance logging are DB-only with no visibility UI

---

## REMEDIATION PLAN

### Phase 1: Security and Enforcement (Critical)

**1.1 Add FeatureGate to all feature pages**
Wrap these pages: `MaintenancePage`, `VisitorManagementPage`, `DomesticHelpPage`, `VehicleParkingPage`, `ParcelManagementPage`, `InspectionChecklistPage`, `PaymentMilestonesPage`, `AuthorizedPersonsPage`

**1.2 Add route-level guards**
Create `SocietyAdminRoute`, `BuilderRoute`, `SellerRoute` wrappers (similar to existing `AdminRoute` and `SecurityRoute`). Apply to: `/society/admin`, `/builder`, `/builder/*`, `/delivery-partners`, `/worker-attendance`, `/worker-leave`, `/worker-salary`

**1.3 Deprecate DomesticHelpPage**
Redirect `/domestic-help` to `/workforce`. Remove the legacy `domestic_help_entries` path. Worker categories are already DB-driven via `worker_categories`.

### Phase 2: Database-Driven Display (High)

**2.1 Add display metadata to `platform_features`**
Migration: `ALTER TABLE platform_features ADD COLUMN IF NOT EXISTS display_name TEXT, ADD COLUMN IF NOT EXISTS description TEXT, ADD COLUMN IF NOT EXISTS icon_name TEXT;`
Then seed values. Update `SocietyAdminPage` to read from DB instead of `FEATURE_LABELS` constant.

**2.2 Create `visitor_types` config table**
```sql
CREATE TABLE visitor_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID REFERENCES societies(id),
  type_key TEXT NOT NULL,
  label TEXT NOT NULL,
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0
);
```
Update `VisitorManagementPage` to fetch types from DB.

**2.3 Move status labels to a `status_display_config` table or add to system_settings**
This is lower priority since the Proxy pattern provides graceful fallback. Could be done as a JSON value in `system_settings` keyed by domain (order_status, payment_status, etc.).

### Phase 3: Navigation and Discoverability (High)

**3.1 Add missing nav links to Society Dashboard**
Add cards for: Authorized Persons, My Workers, Worker Attendance, Worker Leave, Worker Salary

**3.2 Fix Guard bottom nav**
Change `securityNavItems` to point to `/guard-kiosk` instead of `/security/verify`. Consider removing `/security/verify` route entirely.

**3.3 Add Delivery Partner self-service view**
Create `DeliveryPartnerDashboardPage` showing: assigned deliveries, completion workflow, earnings. Gate behind a `delivery_partner` role or `delivery_partner_pool` membership check.

### Phase 4: Worker Self-Service (Medium)

**4.1 Worker attendance self-view**
Let workers see their own attendance via a filtered view of `worker_attendance`.

**4.2 Worker leave self-request**
Let workers submit leave requests that admins approve.

**4.3 Worker salary self-view**
Let workers see their salary records.

### Phase 5: Cleanup (Low)

**5.1 Deduplicate ACTION_CONFIG**
Remove `PRODUCT_ACTION_TYPES` from `database.ts` (or make it reference `ACTION_CONFIG`).

**5.2 Consider moving sort options to system_settings**
Only if multi-tenant customization of sort behavior is needed.

**5.3 Add late fee visibility**
Show late fee column in `MaintenancePage` table. Add admin button to manually trigger `apply_maintenance_late_fees()`.

---

## POST-REMEDIATION STATE

After implementing Phases 1-3:
- Every feature page is gated by `FeatureGate` (UI) and route guards (navigation)
- Every role has a clear, navigable workflow
- All display labels for features come from the database
- Visitor types are configurable per society
- The duplicate Domestic Help system is eliminated
- New pages are reachable from the main navigation
- Guard console is the single entry point for all gate operations
- Delivery partners have a self-service operational view

The system will then meet the standard of a configurable enterprise SaaS platform where:
- A new society creation inherits all feature defaults dynamically
- A new role introduction only requires DB entries, not code changes (for feature access)
- Feature package changes cascade automatically
- No business logic is embedded in frontend display constants that affect behavior
