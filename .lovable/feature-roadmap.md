# Sociva Feature Roadmap

STATUS KEY: [ ] Todo  [~] In Progress  [x] Done

---

## FEATURE 1: COMMUNITY BULLETIN BOARD
[x] Database tables: bulletin_posts, bulletin_comments, bulletin_votes, bulletin_rsvps
[x] RLS policies (society-scoped)
[x] Realtime subscription for new posts
[x] BulletinPage with category tabs (Event/Alert/Maintenance/Poll/Lost & Found)
[x] CreatePostSheet with category picker + attachments
[x] PostCard component with vote/comment/RSVP actions
[x] Poll system with deadline + results visualization
[x] RSVP system with attendee count
[x] Attachment support (images via storage bucket)
[~] Society-level pinning (admin only) — DB ready, UI toggle needed on admin side
[x] "Most Discussed Today" highlight section
[x] Search and filter within bulletin
[x] Bottom nav integration (new "Community" tab)
[x] PostDetailSheet with comments, polls, RSVP
[ ] Auto-archive after 30 days (cron edge function)
[ ] AI summary for long threads (Lovable AI integration)

## FEATURE 2: QUICK HELP REQUESTS (SOS)
[ ] Database table: help_requests, help_responses
[ ] RLS policies (society-scoped)
[ ] HelpRequestSheet (create with tags: Borrow/Emergency/Question/Offer)
[ ] Help feed on Community page or dedicated tab
[ ] Auto-expiry after configurable hours (default 24h)
[ ] Private response system (only requester sees responders)
[ ] Push notification for new requests in society

## FEATURE 3: RECURRING SUBSCRIPTIONS
[ ] Database tables: subscriptions, subscription_deliveries
[ ] RLS policies for subscriptions
[ ] SubscriptionSheet component (create/edit)
[ ] Buyer: Subscribe button on seller products
[ ] Buyer: My Subscriptions page
[ ] Seller: Subscription management dashboard
[ ] Auto-order generation edge function (cron)
[ ] Pause/Resume/Cancel functionality
[ ] Push notification for delivery reminders

## FEATURE 4: COMMUNITY TRUST DIRECTORY
[ ] Database table: skill_listings, skill_endorsements
[ ] RLS policies
[ ] TrustDirectoryPage with search
[ ] SkillCard component with trust score
[ ] Endorsement/recommendation system
[ ] Integration with existing seller reviews for trust scoring
[ ] Profile badge display
