

# Sociva Platform Evolution: 4 Major Features Implementation Plan

## Overview

This plan covers the implementation of 4 high-impact features that will transform Sociva from a marketplace into a full community operating system. Each feature is designed to build incrementally, with the Community Bulletin Board receiving the richest treatment based on your specifications.

---

## Feature Tracker (will be saved to `.lovable/feature-roadmap.md`)

```text
STATUS KEY: [ ] Todo  [~] In Progress  [x] Done

=== FEATURE 1: RECURRING SUBSCRIPTIONS ===
[ ] Database tables: subscriptions, subscription_deliveries
[ ] RLS policies for subscriptions
[ ] SubscriptionSheet component (create/edit)
[ ] Buyer: Subscribe button on seller products
[ ] Buyer: My Subscriptions page
[ ] Seller: Subscription management dashboard
[ ] Auto-order generation edge function (cron)
[ ] Pause/Resume/Cancel functionality
[ ] Push notification for delivery reminders

=== FEATURE 2: COMMUNITY BULLETIN BOARD ===
[ ] Database tables: bulletin_posts, bulletin_comments, bulletin_votes, bulletin_rsvps
[ ] RLS policies (society-scoped)
[ ] Realtime subscription for new posts
[ ] BulletinPage with category tabs (Event/Alert/Maintenance/Poll/Lost & Found)
[ ] CreatePostSheet with category picker + attachments
[ ] PostCard component with vote/comment/RSVP actions
[ ] Poll system with deadline + results visualization
[ ] RSVP system with attendee count
[ ] Attachment support (images via storage bucket)
[ ] Society-level pinning (admin only)
[ ] Auto-archive after 30 days (cron edge function)
[ ] AI summary for long threads (Lovable AI integration)
[ ] "Most Discussed Today" highlight section
[ ] Search and filter within bulletin
[ ] Bottom nav integration (new "Community" tab)

=== FEATURE 3: QUICK HELP REQUESTS (SOS) ===
[ ] Database table: help_requests, help_responses
[ ] RLS policies (society-scoped)
[ ] HelpRequestSheet (create with tags: Borrow/Emergency/Question/Offer)
[ ] Help feed on Community page or dedicated tab
[ ] Auto-expiry after configurable hours (default 24h)
[ ] Private response system (only requester sees responders)
[ ] Push notification for new requests in society

=== FEATURE 4: COMMUNITY TRUST DIRECTORY ===
[ ] Database table: skill_listings, skill_endorsements
[ ] RLS policies
[ ] TrustDirectoryPage with search
[ ] SkillCard component with trust score
[ ] Endorsement/recommendation system
[ ] Integration with existing seller reviews for trust scoring
[ ] Profile badge display
```

---

## Implementation Sequence

We will build in this order for maximum impact:

1. **Community Bulletin Board** (largest, most engaging -- 3 phases)
2. **Quick Help Requests** (lightweight, reuses bulletin infrastructure)
3. **Recurring Subscriptions** (monetization, independent module)
4. **Trust Directory** (enrichment layer, builds on existing data)

---

## FEATURE 1: Community Bulletin Board (Detailed)

### Database Schema

**Table: `bulletin_posts`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| society_id | uuid | FK to societies, scoping |
| author_id | uuid | FK to profiles |
| category | text | event / alert / maintenance / poll / lost_found |
| title | text | Required, max 200 chars |
| body | text | Markdown-supported content |
| attachment_urls | text[] | Array of storage URLs |
| is_pinned | boolean | Admin-only toggle |
| is_archived | boolean | Auto-set after 30 days |
| poll_options | jsonb | For polls: [{id, text, votes: 0}] |
| poll_deadline | timestamptz | When poll voting closes |
| event_date | timestamptz | For events |
| event_location | text | For events |
| rsvp_enabled | boolean | For events |
| comment_count | integer | Denormalized counter |
| vote_count | integer | Denormalized upvote counter |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Table: `bulletin_comments`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| post_id | uuid | FK to bulletin_posts |
| author_id | uuid | FK to profiles |
| body | text | Comment text |
| created_at | timestamptz | |

**Table: `bulletin_votes`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| post_id | uuid | FK to bulletin_posts |
| user_id | uuid | |
| poll_option_id | text | If voting on a poll option |
| vote_type | text | 'upvote' for posts, 'poll' for poll votes |
| created_at | timestamptz | |
| UNIQUE | | (post_id, user_id, vote_type) |

**Table: `bulletin_rsvps`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| post_id | uuid | FK to bulletin_posts |
| user_id | uuid | |
| status | text | 'going' / 'maybe' / 'not_going' |
| created_at | timestamptz | |
| UNIQUE | | (post_id, user_id) |

### RLS Policies

All tables scoped to user's society via `get_user_society_id(auth.uid())`:
- SELECT: Users can view posts in their society
- INSERT: Authenticated users can create posts/comments in their society
- UPDATE: Authors can edit their own posts; admins can pin/archive any post
- DELETE: Authors can delete their own posts; admins can delete any

### Realtime

Enable realtime on `bulletin_posts` and `bulletin_comments` for live feed updates.

### UI Components

1. **BulletinPage** (`src/pages/BulletinPage.tsx`)
   - Category filter tabs: All | Event | Alert | Maintenance | Poll | Lost & Found
   - "Most Discussed Today" hero section (top 3 by comment_count in last 24h)
   - Floating "+" button to create new post
   - Search bar for filtering posts
   - Pinned posts always shown at top

2. **CreatePostSheet** (`src/components/bulletin/CreatePostSheet.tsx`)
   - Category selector (icons for each type)
   - Title + Body fields
   - Image attachment upload (max 4 images, uses `app-images` bucket)
   - Poll builder (add options, set deadline) -- shown when category = "poll"
   - Event fields (date, location, enable RSVP) -- shown when category = "event"

3. **PostCard** (`src/components/bulletin/PostCard.tsx`)
   - Category badge with color coding
   - Author name + block + time ago
   - Title + truncated body
   - Image carousel if attachments exist
   - Action bar: Upvote | Comment count | Share
   - Poll results bar chart (if poll)
   - RSVP buttons (if event with rsvp_enabled)
   - Pin indicator for admins

4. **PostDetailSheet** (`src/components/bulletin/PostDetailSheet.tsx`)
   - Full post content
   - Comment thread
   - AI Summary button (for posts with 10+ comments)
   - Poll voting UI with real-time results

5. **AI Summary** (`supabase/functions/summarize-thread/index.ts`)
   - Edge function using Lovable AI (google/gemini-2.5-flash)
   - Takes post body + all comments, returns 2-3 sentence summary
   - Cached in post metadata to avoid repeated calls

### Auto-Archive Cron

Edge function `auto-archive-bulletin` runs daily:
```sql
UPDATE bulletin_posts 
SET is_archived = true 
WHERE created_at < now() - interval '30 days' 
  AND is_archived = false 
  AND is_pinned = false;
```

### Navigation Changes

- Add "Community" tab to BottomNav (using `MessageSquare` or `Users` icon)
- Route: `/community`
- Positioned between "Orders" and "Profile" (or "Seller")

---

## FEATURE 2: Quick Help Requests (SOS)

### Database Schema

**Table: `help_requests`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| society_id | uuid | Scoping |
| author_id | uuid | |
| title | text | Short description |
| description | text | Details |
| tag | text | borrow / emergency / question / offer |
| status | text | open / fulfilled / expired |
| expires_at | timestamptz | Auto-set to created_at + 24h |
| response_count | integer | Denormalized |
| created_at | timestamptz | |

**Table: `help_responses`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| request_id | uuid | FK |
| responder_id | uuid | |
| message | text | |
| created_at | timestamptz | |

### UI

- Integrated as a tab within the Community/Bulletin page ("Help" tab)
- HelpRequestCard with tag badge, time remaining, response count
- Only the requester can see who responded (privacy)
- Auto-expire cron reuses the bulletin archive function

---

## FEATURE 3: Recurring Subscriptions

### Database Schema

**Table: `subscriptions`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| buyer_id | uuid | |
| seller_id | uuid | |
| product_id | uuid | |
| frequency | text | daily / weekly / monthly |
| quantity | integer | |
| delivery_days | text[] | For weekly: ['Mon','Wed','Fri'] |
| status | text | active / paused / cancelled |
| next_delivery_date | date | |
| pause_until | date | null if not paused |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Table: `subscription_deliveries`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| subscription_id | uuid | FK |
| order_id | uuid | FK to orders (auto-generated) |
| scheduled_date | date | |
| status | text | pending / delivered / skipped |
| created_at | timestamptz | |

### Edge Function: `process-subscriptions` (daily cron)

- Queries active subscriptions where `next_delivery_date = today`
- Creates orders automatically
- Updates `next_delivery_date` based on frequency
- Sends push notification to both buyer and seller

### UI

- "Subscribe" button on product cards (alongside "Add to Cart")
- SubscriptionSheet: frequency picker, quantity, delivery days
- My Subscriptions page (accessible from Profile)
- Seller subscription management in Seller Dashboard

---

## FEATURE 4: Community Trust Directory

### Database Schema

**Table: `skill_listings`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | |
| society_id | uuid | |
| skill_name | text | e.g. "Plumbing", "Math Tutoring" |
| description | text | |
| availability | text | |
| trust_score | numeric | Computed from endorsements + reviews |
| endorsement_count | integer | |
| created_at | timestamptz | |

**Table: `skill_endorsements`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| skill_id | uuid | FK |
| endorser_id | uuid | |
| comment | text | Optional recommendation |
| created_at | timestamptz | |
| UNIQUE | | (skill_id, endorser_id) |

### UI

- TrustDirectoryPage (`/directory`)
- Searchable grid of skill cards
- "Endorse" button for neighbors
- Trust score badge on profile pages
- Accessible from Profile page menu

---

## Routing Changes Summary

| Route | Page | Nav |
|-------|------|-----|
| `/community` | BulletinPage | Bottom nav "Community" tab |
| `/community/:id` | PostDetailSheet (or page) | -- |
| `/subscriptions` | MySubscriptionsPage | Profile menu |
| `/directory` | TrustDirectoryPage | Profile menu |

---

## Files to Create

```text
src/pages/BulletinPage.tsx
src/pages/MySubscriptionsPage.tsx
src/pages/TrustDirectoryPage.tsx
src/components/bulletin/CreatePostSheet.tsx
src/components/bulletin/PostCard.tsx
src/components/bulletin/PostDetailSheet.tsx
src/components/bulletin/PollBuilder.tsx
src/components/bulletin/PollResults.tsx
src/components/bulletin/RsvpButtons.tsx
src/components/bulletin/CategoryFilter.tsx
src/components/bulletin/MostDiscussedSection.tsx
src/components/bulletin/HelpRequestCard.tsx
src/components/bulletin/CreateHelpSheet.tsx
src/components/subscription/SubscriptionSheet.tsx
src/components/subscription/SubscriptionCard.tsx
src/components/directory/SkillCard.tsx
src/components/directory/EndorseButton.tsx
supabase/functions/summarize-thread/index.ts
supabase/functions/auto-archive-bulletin/index.ts
supabase/functions/process-subscriptions/index.ts
.lovable/feature-roadmap.md
```

## Files to Modify

```text
src/App.tsx -- add new routes
src/components/layout/BottomNav.tsx -- add Community tab
src/types/database.ts -- add new type interfaces
```

---

## Implementation Priority

We will start with **Feature 2: Community Bulletin Board** (Phase 1) which includes:
1. Database migration (all bulletin tables + RLS + realtime)
2. BulletinPage with category tabs
3. CreatePostSheet
4. PostCard component
5. Bottom nav update
6. Pinning + basic interactions

Then iterate with polls, RSVP, AI summary, auto-archive, and the remaining features.

