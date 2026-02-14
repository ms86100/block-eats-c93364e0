

# Sociva Trust Architecture: 4 New Pillars Implementation Plan

## Vision
Transform Sociva from a community marketplace into a **Trust-Rated Living Platform** by adding four new pillars: Enhanced Skill Exchange, Builder Transparency Dashboard, Financial Transparency Engine, and Silent Dispute System -- all unified by a **Society Trust Score**.

---

## What Gets Built

### Pillar 1: Enhanced Skill & Help Exchange (Upgrade Existing)
The current Trust Directory (`/directory`) is basic -- just skill name + endorsement. This upgrade makes it a proper **micro-marketplace for neighbor expertise**.

**New capabilities:**
- **Skill categories**: Professional (Doctor, CA, Lawyer) vs Hobby (Guitar, Cooking) vs Trade (Plumber, Electrician)
- **Rate/pricing field**: Free, Paid (with indicative rate), or "Let's Discuss"
- **Contact request system**: Instead of exposing phone numbers, a "Request Help" button sends a notification; the skill-holder accepts/declines
- **Skill verification badge**: If a resident is also an approved seller in the same domain, auto-badge them as "Verified Provider"
- **Response time tracking**: Average response time displayed on skill cards
- **"Who Can Help?" quick search**: Prominent entry point from Home page

**Database changes:**
- Add columns to `skill_listings`: `category` (professional/hobby/trade), `pricing_type` (free/paid/negotiable), `indicative_rate`, `response_count`, `avg_response_hours`
- New table: `skill_requests` (id, skill_id, requester_id, message, status [pending/accepted/declined/completed], created_at)
- RLS: Society-scoped, only requester and skill-owner can see requests

### Pillar 2: Builder Transparency Dashboard
A **milestone tracker** for under-construction or newly delivered societies. Think "Domino's Pizza Tracker for real estate."

**New capabilities:**
- Society-level "Construction Progress" page (only for societies marked `is_under_construction`)
- Admin/builder uploads milestone updates with photos and RERA stage tags
- Timeline view showing progress: Foundation > Structure > MEP > Finishing > Handover
- Each milestone has: title, description, photos, date, RERA stage tag, completion percentage
- Residents can "react" to milestones (thumbs up/concern flag)
- Push notification when a new milestone is posted
- Public-facing progress page (no auth required) for prospective buyers

**Database changes:**
- Add column to `societies`: `is_under_construction` (boolean, default false)
- New table: `construction_milestones` (id, society_id, title, description, stage [foundation/structure/mep/finishing/handover/completed], photos text[], completion_percentage int, posted_by uuid, created_at)
- New table: `milestone_reactions` (id, milestone_id, user_id, reaction_type [thumbsup/concern], created_at, UNIQUE(milestone_id, user_id))
- RLS: Anyone in society can view; only admins can insert/update milestones

### Pillar 3: Financial Transparency Engine
Replace opaque PDF audits with a **visual spending dashboard** for society maintenance funds.

**New capabilities:**
- Society-level "Finances" page showing monthly spending breakdown as interactive pie chart
- Categories: Security, Water, Electricity, Repairs, Gardening, Lift Maintenance, Staff Salaries, Miscellaneous
- Click any category to see line-item expenses with vendor name, amount, date, and optional invoice image
- Monthly comparison view (bar chart) -- "Are we spending more than last month?"
- Committee members (admin role) can add expense entries with invoice uploads
- Summary card: Total collection vs Total spent vs Balance
- Residents can flag an expense for clarification (creates a private ticket to committee)

**Database changes:**
- New table: `society_expenses` (id, society_id, category, title, amount, vendor_name, invoice_url, expense_date, added_by uuid, created_at)
- New table: `society_income` (id, society_id, source [maintenance/penalty/interest/other], amount, description, income_date, added_by uuid, created_at)
- New table: `expense_flags` (id, expense_id, flagged_by uuid, reason, status [open/resolved], admin_response, created_at)
- RLS: View by society members; insert/update by admins only; expense_flags insertable by any society member, viewable by flagger + admins

### Pillar 4: Silent Dispute System
A **private, ticket-based escalation system** to replace toxic WhatsApp wars.

**New capabilities:**
- "Raise a Concern" button accessible from Profile menu and Community page
- Private ticket form: category (Noise, Parking, Pet, Maintenance, Other), description, optional photo evidence
- Tickets visible ONLY to the submitter and committee (admins)
- SLA timer: 48 hours for committee acknowledgment, 7 days for resolution
- Status flow: Submitted > Acknowledged > Under Review > Resolved / Escalated
- Committee can add private notes, request more info, or mark resolved
- Anonymous mode option: Committee sees the complaint but not who filed it (for sensitive issues)
- Dashboard for committee showing open tickets, SLA breaches, resolution stats

**Database changes:**
- New table: `dispute_tickets` (id, society_id, submitted_by uuid, category, description, photo_urls text[], is_anonymous boolean, status [submitted/acknowledged/under_review/resolved/escalated/closed], sla_deadline timestamptz, acknowledged_at, resolved_at, created_at)
- New table: `dispute_comments` (id, ticket_id, author_id uuid, body text, is_committee_note boolean, created_at)
- RLS: Submitter can see own tickets + comments; admins see all tickets in their society; anonymous tickets hide submitted_by from non-admin queries

---

## Pillar 5 (Unifying Layer): Society Trust Score

A computed, weighted score displayed on every society's profile and Home page.

**Formula:**
- **Vibrancy** (25%): Active skill listings + help requests answered in last 30 days
- **Transparency** (25%): Number of financial entries posted + milestone updates in last 90 days
- **Governance** (25%): Dispute resolution rate + average resolution time
- **Community** (25%): Bulletin engagement (posts + comments + votes in last 30 days)

**Implementation:**
- Database function `calculate_society_trust_score(society_id)` that computes the score
- Add column to `societies`: `trust_score` (numeric, default 0)
- Cron job or trigger to recalculate daily
- Display as a badge on Home page header and society profile
- Score range: 0-10 with labels (Below 3: "Getting Started", 3-5: "Growing", 5-7: "Active", 7-9: "Thriving", 9+: "Model Community")

---

## New Routes

| Route | Page | Access |
|-------|------|--------|
| `/directory` | Enhanced Trust Directory (upgrade) | Bottom nav / Profile menu |
| `/society/progress` | Builder Transparency Dashboard | Society members + public |
| `/society/finances` | Financial Transparency Engine | Society members only |
| `/disputes` | My Dispute Tickets | Authenticated residents |
| `/admin` (new tabs) | Dispute Management + Finance Admin | Admin only |

---

## New Files to Create

```text
src/pages/SocietyProgressPage.tsx
src/pages/SocietyFinancesPage.tsx
src/pages/DisputesPage.tsx
src/components/directory/SkillRequestSheet.tsx
src/components/progress/MilestoneCard.tsx
src/components/progress/ProgressTimeline.tsx
src/components/finances/SpendingPieChart.tsx
src/components/finances/ExpenseList.tsx
src/components/finances/AddExpenseSheet.tsx
src/components/finances/IncomeVsExpenseChart.tsx
src/components/disputes/CreateDisputeSheet.tsx
src/components/disputes/DisputeTicketCard.tsx
src/components/disputes/DisputeDetailSheet.tsx
src/components/trust/SocietyTrustBadge.tsx
```

## Files to Modify

```text
src/pages/TrustDirectoryPage.tsx -- add categories, pricing, request system
src/pages/HomePage.tsx -- add Trust Score badge, "Who Can Help?" quick link
src/pages/ProfilePage.tsx -- add Disputes + Finances menu items
src/pages/AdminPage.tsx -- add Disputes tab + Finances tab
src/App.tsx -- add new routes
src/components/layout/BottomNav.tsx -- no change needed (existing nav sufficient)
.lovable/feature-roadmap.md -- update with new features
```

---

## Implementation Sequence

**Phase 1**: Silent Dispute System (highest immediate pain relief, relatively simple)
**Phase 2**: Financial Transparency Engine (high trust impact, uses recharts already installed)
**Phase 3**: Enhanced Skill Exchange (upgrade existing directory)
**Phase 4**: Builder Transparency Dashboard (niche but high-value for under-construction societies)
**Phase 5**: Society Trust Score (unifying layer, depends on all above)

---

## Technical Notes

- All new tables use society-scoped RLS via existing `get_user_society_id()` function
- Photo uploads use existing `app-images` storage bucket
- Charts use `recharts` (already installed)
- Push notifications use existing `send-push-notification` edge function
- Trust Score calculation uses a `SECURITY DEFINER` function to aggregate across tables
- Anonymous dispute mode implemented via RLS policy that hides `submitted_by` when `is_anonymous = true` for non-admin users
- SLA deadlines set via Postgres default: `now() + interval '48 hours'` for acknowledgment

