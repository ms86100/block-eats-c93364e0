

# Multi-Society Architecture Stress Test -- Critical Evaluation

## Risk Matrix

| Risk | Severity | Likelihood at 100 Societies | Current Mitigation | Gap |
|---|---|---|---|---|
| Privilege escalation via society_admins self-appointment | CRITICAL | High | None | Any society admin can appoint MORE admins with no platform-level approval |
| No audit trail for role changes | CRITICAL | Certain | None | Zero logging of who appointed/removed whom, when |
| RLS function call overhead at scale | HIGH | Medium | Indexes on society_id exist | No composite indexes on hot query paths |
| orders table has no society_id | HIGH | Certain | None | Cross-society commerce possible today |
| society_admins can modify profiles table (user approval) | HIGH | Medium | RLS checks is_society_admin | Society admin from Society A could approve users in Society B if they manipulate society_id parameter |
| Builder dashboard N+1 query pattern | MEDIUM | Certain at 15+ societies | None | Promise.all per-society count queries will timeout |
| No soft delete anywhere | MEDIUM | High | Hard deletes | Data loss on admin removal, no recovery |
| reports/warnings tables still global | MEDIUM | Certain | Only is_admin() gated | Society admins cannot moderate their own society's reports |
| AuthContext makes 5 sequential DB calls per login | MEDIUM | Certain at scale | None | Login latency grows linearly with role complexity |
| validate-society edge function has no rate limiting | MEDIUM | Medium | None | Society creation spam possible |
| No trigger-level cascade on society admin removal | LOW | Medium | None | Removed admin retains cached isSocietyAdmin until page refresh |

---

## 1. Hidden Architectural Risks -- What Will Break

### A. Privilege Escalation: Society Admin Can Self-Replicate (CRITICAL)

**Current code in SocietyAdminPage.tsx line 112-133**: Any society admin can appoint ANY approved resident as another admin or moderator. There is no platform-level approval gate. The RLS policy on `society_admins` INSERT only checks `is_society_admin(auth.uid(), society_id)`.

**Attack vector**: A rogue society admin appoints 10 allies as admins. They now control the society with no oversight. No platform admin is notified. No approval workflow exists.

**Fix required**: Add a `max_admins_per_society` limit enforced by a validation trigger. Require platform admin approval for the first society admin appointment. Log all appointment/removal events to an `audit_log` table.

### B. Cross-Society Profile Approval Attack (HIGH)

The RLS policy on `profiles` UPDATE currently accepts `is_society_admin(auth.uid(), society_id)`. But `society_id` here refers to the **profile's** society_id, not the admin's. If a society admin crafts a direct Supabase call:

```
supabase.from('profiles').update({ verification_status: 'approved' }).eq('id', '<user-from-another-society>')
```

The RLS check evaluates `is_society_admin(auth.uid(), <target-user's-society_id>)`. This correctly blocks cross-society manipulation **only if** the admin is not also an admin of the target society. This is currently safe but fragile -- it depends on the function implementation being exact.

### C. orders Table: Zero Society Isolation (CRITICAL)

`orders` has no `society_id`. RLS only checks `buyer_id = auth.uid()` or seller ownership. A buyer from Society A can order from a seller in Society B if they somehow discover the seller_id (e.g., via shared links, leaked UUIDs). This is a data isolation failure.

**Current state**: No trigger, no column, no validation. This was identified in the plan but NOT implemented.

### D. Trigger Complexity Growth

Currently 7 triggers write to `society_activity`. Each is a SECURITY DEFINER function. As features grow, each new table needs a new trigger. At 20+ triggers, debugging becomes difficult because:
- Triggers execute in undefined order
- Trigger failures are swallowed silently in some Postgres configurations  
- No centralized registry of what triggers exist (the `pg_trigger` query returned empty, suggesting triggers may not be properly registered or are statement-level)

### E. AuthContext: 5 Queries Per Login

Lines 41-106 of `AuthContext.tsx` make 5 separate queries on every auth state change:
1. `profiles` SELECT
2. `societies` SELECT
3. `society_admins` SELECT
4. `user_roles` SELECT
5. `seller_profiles` SELECT
6. `builder_members` SELECT

At 100K users logging in during peak hours, this is 600K queries just for auth hydration. This needs to be a single database function that returns all role data in one call.

---

## 2. RLS at Scale -- Technical Assessment

### Will RLS Introduce Query Latency at 100M+ Rows?

**Yes, conditionally.** RLS policies are evaluated as additional WHERE clauses. The `get_user_society_id()` function is called on every row evaluation unless Postgres can push it down to an index scan. Since this function does a SELECT from `profiles`, it executes once per query (Postgres caches STABLE function results within a transaction), not per row. So the overhead is one extra query per user request, not per row.

**However**: `is_society_admin()` does a SELECT from `society_admins` AND calls `is_admin()` which does another SELECT from `user_roles`. That's 2-3 subqueries per policy evaluation. On tables where both regular users and admins need access (like `dispute_tickets`), the planner evaluates both branches.

### Missing Indexes (Will Cause Problems at Scale)

Current state of indexes vs what's needed:

| Table | Has society_id Index | Needs Composite Index |
|---|---|---|
| orders | NO (no society_id column) | buyer_id + status, seller_id + status |
| dispute_tickets | NO | society_id + status, society_id + created_at |
| snag_tickets | NO | society_id + status |
| society_expenses | NO | society_id + created_at |
| construction_milestones | NO | society_id + created_at |
| user_roles | NO | user_id + role (composite) |
| society_admins | YES (unique constraint) | Already covered |

### Partitioning by society_id

**Not necessary until 500M+ rows.** Postgres handles 100M rows with proper indexing without partitioning. Partitioning adds operational complexity (partition management, cross-partition queries for platform admins). The ROI is negative at current projected scale.

**When it becomes necessary**: If any single table exceeds 500M rows AND most queries filter by society_id, hash partitioning on society_id would help. This is a 3-5 year concern, not immediate.

### Schema-Per-Society

**Never necessary for this use case.** Schema-per-tenant is for SaaS products where tenants need schema customization. All societies share identical schema. Schema-per-society would make cross-society analytics, platform admin views, and migrations exponentially harder. This is the wrong direction.

### Required Monitoring

- `pg_stat_statements` to track slow queries per RLS policy
- Alert on any query taking >500ms that involves society-scoped tables
- Periodic EXPLAIN ANALYZE on hot paths (activity feed, notification inbox, order listing)

---

## 3. Governance Model Stress Test

### Scenario: Builder Manages 15 Societies

**Current gap**: `BuilderDashboardPage.tsx` line 29 only fetches `managedBuilderIds[0]` -- the FIRST builder. If a user is a member of multiple builders, all others are ignored. This is a hard bug.

**Current gap**: Builder members can SEE their societies but cannot ACT on them. The builder dashboard links to `/society` which shows the user's OWN society, not the clicked society. There is no mechanism to "switch context" to a different society.

### Scenario: Society Admin Resigns

**Current state**: Hard delete from `society_admins`. No record remains. No handoff workflow. If the only admin leaves, the society has zero governance with no alert to platform admins.

**Fix required**: 
- Add `deactivated_at` column instead of DELETE
- Trigger alert to platform admin when last active admin is removed
- Maintain appointment history for audit

### Scenario: Rogue Admin

**Current state**: A society admin can:
- Approve/reject ANY user in their society (correct)
- Appoint unlimited additional admins (dangerous)
- Change society settings like auto-approve (dangerous -- could open the society to spam)
- Update `societies` table directly via RLS (the UPDATE policy on societies still only checks `is_admin()`, not `is_society_admin()` -- so society admins actually CANNOT update society settings through RLS, only through the UI which uses the client. **But the UI call will fail silently because RLS blocks it.**)

**Critical bug found**: `SocietyAdminPage.tsx` line 89-97 calls `supabase.from('societies').update(...)` but the RLS policy on `societies` only allows `is_admin(auth.uid())` for ALL operations. Society admins CANNOT update society settings. The auto-approve toggle will silently fail.

### Audit Trail

**Does not exist.** Zero audit logging for:
- Role changes (admin appointment/removal)
- User approval/rejection decisions  
- Society setting changes
- Seller approval/rejection
- Builder-society assignments

This is unacceptable for a governance platform.

---

## 4. Commerce Isolation Edge Cases

### Seller Changes Society

**Current behavior**: If a seller's profile `society_id` is changed, all their products become visible to the new society. Historical orders from the old society still reference this seller. Old society residents can still view order history with this seller. No mechanism prevents this or migrates data.

### Historical Orders After Society Transfer

Orders have no `society_id`. They reference `seller_id` and `buyer_id`. If the seller moves societies, the order is orphaned from a society context. There is no way to generate a "society report" that includes historical orders because orders are not society-bound.

### Builder Transfers Society

`builder_societies` is a simple junction table. Changing `builder_id` on a society or moving the `builder_societies` row is straightforward. But the old builder loses access instantly, including to historical data they may need for legal/financial records. No grace period, no data export.

---

## 5. Long-Term Maintainability Risks

### Policy Complexity

Current state: **54+ RLS policies** across all tables. Each policy references 1-3 security definer functions. Some policies have nested EXISTS subqueries 3 levels deep (e.g., `dispute_comments` policy checks `dispute_tickets` which checks `get_user_society_id`).

**Risk**: A single function change (e.g., modifying `is_society_admin`) cascades to every policy that references it. There is no test suite for RLS policies. A bug in a security definer function could silently grant or revoke access to millions of rows.

### Security Definer Function Count

Currently 6 security definer functions for access control alone. This will grow to 10+ as features expand. Each function bypasses RLS, creating a privilege surface area. Any bug in a SECURITY DEFINER function runs with superuser privileges.

### Developer Onboarding

A new developer would need to understand:
- 6 security definer functions and their call hierarchy
- 54+ RLS policies across 30+ tables
- 7+ database triggers
- The relationship between `user_roles`, `society_admins`, `builder_members` (3 separate authorization tables)
- Why some tables use `is_admin()` and others use `is_society_admin()`

**No documentation exists for any of this.**

---

## 6. Observability Gaps

### Zero Operational Monitoring

- No query performance tracking per society
- No alert when a society has 0 admins
- No alert when approval queue exceeds threshold
- No RLS policy test suite
- No way to detect if a trigger silently fails
- No dashboard showing "societies with misconfigured settings"

### Debugging Cross-Society Issues

If a user reports "I can't see my orders," debugging requires:
1. Check their `profiles.society_id`
2. Check their `user_roles`
3. Check seller's `society_id`
4. Check RLS policies on `orders` (which don't scope by society)
5. Check if any triggers failed

There is no consolidated view. No admin tool. No logging.

---

## 7. Future-Proofing Assessment

### Cross-Society Marketplace
**Blocked.** Every RLS policy hardcodes `society_id = get_user_society_id()`. To allow cross-society commerce, you'd need to add a `visibility` column and rewrite every SELECT policy. The current architecture makes this a 2-week migration, not a feature flag.

### Society Federation
**Partially supported.** `builder_societies` could serve as a federation layer. But the UI has no concept of "viewing another society's data." The entire frontend assumes `profile.society_id` is the only context.

### Paid SaaS Tiers Per Society
**Not blocked but not supported.** No `subscription_tier` on `societies`. No feature gating mechanism. Would need a `society_features` table and middleware to check feature access.

### Builder-Level Analytics
**Blocked by N+1 pattern.** The builder dashboard fetches counts per society sequentially. At 15+ societies this will timeout. Needs a database function that returns aggregates in one call.

---

## 8. Structural Changes Required NOW

### Priority 1: Audit Log Table (Before any more governance features)

```text
audit_log (
  id uuid PK,
  actor_id uuid FK -> profiles,
  action text (e.g., 'admin_appointed', 'user_approved', 'settings_changed'),
  target_type text (e.g., 'profile', 'society_admin', 'society'),
  target_id uuid,
  society_id uuid,
  metadata jsonb,
  created_at timestamptz
)
```

Every governance action must write here. Non-negotiable for a trust platform.

### Priority 2: Fix societies RLS for Society Admins

Society admins currently cannot update society settings (auto-approve, approval method) because RLS blocks them. Add UPDATE policy:

```text
CREATE POLICY "Society admins can update their society"
ON societies FOR UPDATE
USING (is_society_admin(auth.uid(), id))
WITH CHECK (is_society_admin(auth.uid(), id));
```

### Priority 3: Add society_id to orders

Add `society_id` column. Populate via trigger on INSERT (derive from seller's society_id). Add index. Update RLS to scope admin views by society.

### Priority 4: Consolidate Auth Hydration

Replace 5 separate queries in AuthContext with a single database function:

```text
get_user_auth_context(_user_id uuid) RETURNS jsonb
-- Returns: { profile, society, roles, seller_profiles, society_admin_role, builder_ids }
```

One query instead of six. Critical at scale.

### Priority 5: Admin Appointment Controls

- Add `max_society_admins` column to societies (default 5)
- Add validation trigger on `society_admins` INSERT
- Require platform admin approval for first admin appointment per society
- Log all changes to audit_log

### Priority 6: Missing Composite Indexes

```sql
CREATE INDEX idx_dispute_tickets_society_status ON dispute_tickets(society_id, status);
CREATE INDEX idx_snag_tickets_society_status ON snag_tickets(society_id, status);
CREATE INDEX idx_society_expenses_society_created ON society_expenses(society_id, created_at DESC);
CREATE INDEX idx_construction_milestones_society ON construction_milestones(society_id, created_at DESC);
CREATE INDEX idx_user_roles_user_role ON user_roles(user_id, role);
```

### Priority 7: RLS Policy Documentation

Create a living document mapping every table to its policies, the functions they reference, and the intended access pattern. Without this, the system is unmaintainable at 10+ developers.

---

## Verdict: Can This Scale for 5-10 Years?

**With the 7 changes above: Yes.**
**Without them: It will break at 10-15 societies.**

The core architectural decision (row-level security with tiered roles via parallel tables) is sound and will scale. The problems are all in execution gaps:
- Missing audit trail
- Missing indexes  
- Broken RLS on societies table for society admins
- N+1 query patterns in dashboards
- No commerce isolation on orders
- Auth hydration inefficiency

None of these require architectural redesign. They require discipline and hardening. The foundation is correct. The walls have holes.

