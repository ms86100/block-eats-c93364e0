

# Scalability and Architecture Hardening -- 1M+ Users Analysis

## Current State Summary

- 56 tables, all RLS-enabled, ~200 total rows
- 166 RLS policies, 30 SECURITY DEFINER functions, 38 triggers
- Single shared Postgres database (Lovable Cloud / Supabase)
- React SPA with HashRouter, no SSR
- Auth hydration via single RPC (`get_user_auth_context`) at 4.25ms
- Manual code splitting (vendor, ui, supabase chunks)
- PWA with service worker caching
- Realtime used for chat and activity feed

---

## 1. Current Architecture Risk Assessment

### Database Hotspots

| Table | Sequential Scans | Rows | Risk |
|---|---|---|---|
| seller_profiles | 2,956 seq scans | 11 | At 10K rows, each RLS-filtered SELECT becomes expensive |
| profiles | 2,382 seq scans | 5 | `get_user_society_id()` called on every RLS check -- hits this table |
| societies | 873 seq scans | 2 | Referenced by auto_approve trigger on every profile INSERT |
| user_roles | 781 seq scans | 9 | `has_role()` called by `is_admin()` on nearly every RLS policy |
| category_config | 435 seq scans | 55 | Loaded on every HomePage render |

**Critical observation:** `user_roles` already has 22,880 index scans but 781 sequential scans. At 1M users with multiple roles each, `has_role()` will be called millions of times per hour. The current btree index is adequate but the function is called in nearly every RLS policy chain.

### RLS Performance Chain

Every authenticated query triggers:
```text
RLS policy -> is_admin(auth.uid()) -> has_role(uid, 'admin') -> SELECT FROM user_roles
                                                              -> sequential scan at small scale
```

At 1M users, `user_roles` will have ~1.5M rows. The `has_role()` function uses a simple `EXISTS` subquery. With the composite index `idx_user_roles_user_role (user_id, role)`, this remains O(log n) -- **safe if the index is used**.

**Risk:** If Postgres cost planner chooses seq scan at intermediate scale (1K-10K rows), RLS will degrade. Need to verify `idx_user_roles_user_role` is a covering index.

### N+1 Query Patterns Found

| Page | Pattern | Impact |
|---|---|---|
| `HomePage.tsx` | Fetches ALL approved sellers, then filters client-side for "open now", "nearby block", "top rated", "featured" | At 500 sellers per society, downloads 500 rows to show 6 |
| `SellerDashboardPage.tsx` | Fetches ALL orders for seller, filters client-side | At 10K orders per seller over time, downloads entire history |
| `OrdersPage.tsx` | Fetches ALL buyer orders + ALL seller orders, no pagination | Same issue |
| `SocietyAdminPage.tsx` | 3 parallel queries (pending users, pending sellers, admins) | Acceptable but no pagination |

### Client-Side Filtering

`HomePage.tsx` lines 55-74 download all sellers and filter in JavaScript:
- `openNowSellers` = filter by time
- `nearbyBlockSellers` = filter by block
- `topRatedSellers` = filter by rating >= 4
- `featuredSellers` = filter by is_featured

This should be 4 targeted database queries with `LIMIT`, not 1 bulk download with client filtering.

### Society Scoping Assessment

The multi-tenant isolation is structurally sound. The `get_user_society_id()` function returns a single society_id per user, and RLS policies enforce it. However:

- **No connection pooling strategy.** At 100K concurrent connections, Supabase's default connection pool (managed by Supavisor) will need tuning.
- **No read replicas.** All reads and writes hit the same instance.
- **No query result caching.** Dashboard queries re-execute on every page load.

---

## 2. Multi-Tenant Architecture Strategy

### Recommendation: Shared database with strict row-level isolation (current approach)

**Why not schema-per-society:**
- 100+ societies means 100+ schemas -- migration hell
- Cross-society features (builder dashboard, admin panel) require cross-schema queries
- Supabase/Lovable Cloud does not support schema-per-tenant

**Why not hybrid:**
- Unnecessary complexity at this stage
- Adds operational burden with no clear benefit until 10K+ societies

**Current approach is correct.** The shared database with `society_id` column + RLS + SECURITY DEFINER functions is the standard multi-tenant SaaS pattern. It scales to millions of users if properly indexed.

### Strengthening Isolation

1. **Statement-level timeout:** Add `SET statement_timeout = '5s'` to high-risk functions to prevent runaway queries from blocking the pool.
2. **Row-level quotas:** Add a `max_members` column to `societies` and enforce via trigger on `profiles` INSERT. Prevents a single society from consuming disproportionate resources.
3. **Per-society rate limiting:** Edge functions should track request counts per society_id and throttle above threshold.

---

## 3. Database Design and Optimization

### Indexing Strategy

**Immediately needed composite indexes (verify applied):**

| Table | Index | Purpose |
|---|---|---|
| orders | `(society_id, status, created_at DESC)` | Admin dashboard |
| orders | `(buyer_id, created_at DESC)` | Buyer order history |
| orders | `(seller_id, status, created_at DESC)` | Seller dashboard |
| chat_messages | `(order_id, created_at)` | Chat loading |
| user_notifications | `(user_id, is_read, created_at DESC)` | Notification inbox |
| products | `(seller_id, is_available)` | Seller product listing |
| society_activity | `(society_id, created_at DESC)` | Activity feed |

### Pagination Strategy

**Switch from offset to cursor-based pagination for all list views:**

Current pattern (every list page):
```typescript
// BAD: Downloads everything
const { data } = await supabase.from('orders').select('*').eq('buyer_id', user.id)
```

Required pattern:
```typescript
// GOOD: Cursor-based, 20 at a time
const { data } = await supabase
  .from('orders')
  .select('*')
  .eq('buyer_id', user.id)
  .order('created_at', { ascending: false })
  .lt('created_at', lastSeenTimestamp) // cursor
  .limit(20)
```

**Tables requiring cursor pagination:**
- orders (buyer + seller views)
- chat_messages
- bulletin_posts, bulletin_comments
- user_notifications
- society_activity
- audit_log
- products (seller management view)
- reviews

### Archiving Strategy

For tables expected to exceed 10M rows:

| Table | Threshold | Archive Method |
|---|---|---|
| orders | > 90 days completed | Move to `orders_archive` table |
| chat_messages | > 30 days on completed orders | Move to `chat_messages_archive` |
| audit_log | > 1 year | Move to `audit_log_archive` |
| society_activity | > 90 days | Move to `society_activity_archive` |
| user_notifications | > 60 days read | DELETE (not archive) |

**Implementation:** Scheduled edge function running weekly via `pg_cron`.

### Partitioning

At 50M+ orders, partition `orders` by `created_at` (monthly range partitioning). This is a schema migration that should be planned but not executed until the table exceeds 5M rows.

For `chat_messages`, partition by `order_id` hash (16 partitions). This distributes I/O across partitions and prevents any single order's chat from creating hotspots.

**Do not partition now.** Partitioning adds complexity and is premature at current scale. Plan the migration scripts now, execute when approaching 1M rows in any table.

---

## 4. Backend Performance Strategy

### API Rate Limiting

Create an edge function middleware pattern:
```text
Request -> Rate limiter (per user_id + society_id) -> Business logic -> Response
```

Use a `rate_limits` table or in-memory counter per edge function invocation. Track:
- 100 requests/minute per user
- 1000 requests/minute per society
- 10 requests/second for write operations

### Caching Strategy

**Level 1: React Query (already using @tanstack/react-query)**
- Set `staleTime: 5 * 60 * 1000` (5 min) for category_config, parent_groups, societies
- Set `staleTime: 30 * 1000` (30s) for seller_profiles, products
- Set `staleTime: 0` for orders, chat_messages (always fresh)

**Level 2: Supabase API cache (already configured in PWA)**
- `NetworkFirst` strategy for API calls -- correct
- Extend to cache seller profile images with `CacheFirst`

**Level 3: Database-level**
- `get_user_auth_context()` result could be cached in a materialized view refreshed every 5 minutes, but current 4.25ms is acceptable. Revisit at 100K users.

### Background Job Processing

| Job | Current | Required |
|---|---|---|
| Notifications | Synchronous insert | Edge function + queue table |
| Subscription renewals | `process-subscriptions` edge function | Add idempotency key |
| Order SLA timers | Client-side `UrgentOrderTimer` | Move to `pg_cron` + edge function |
| Trust score refresh | Manual | `pg_cron` daily job |
| Auto-archive bulletin | `auto-archive-bulletin` exists | Add error handling + logging |

### Critical: Move heavy operations off the request path

1. **Notification dispatch:** Insert into `notification_queue` table, process via scheduled edge function
2. **Trust score calculation:** `calculate_society_trust_score()` runs 12+ subqueries. At scale, this must be pre-computed and cached, not calculated on demand
3. **Rating updates:** `update_seller_rating()` trigger recalculates AVG on every review insert. At 10K reviews per seller, use incremental calculation instead

---

## 5. Frontend Performance and UX at Scale

### Current Issues

1. **No route-level code splitting.** All 30+ pages are imported eagerly in `App.tsx` (lines 16-53). At 1M users, every user downloads code for admin pages, builder dashboard, seller tools.

2. **No virtualized lists.** Order lists, chat messages, bulletin feeds render all items in DOM.

3. **No skeleton/suspense boundaries.** Only manual `isLoading` states.

### Required Changes

**Route-level lazy loading:**
```typescript
const HomePage = lazy(() => import('./pages/HomePage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
// ... all 30 pages
```

This alone could reduce initial bundle by 60-70%.

**Virtualized lists for:**
- Orders list (buyer + seller views)
- Chat messages
- Bulletin feed
- Search results
- Notification inbox
- Activity feed

Use `@tanstack/react-virtual` (lightweight, 3KB).

**Image optimization:**
- Seller cover images loaded as full-size. Need responsive srcset or CDN-based resizing
- Hero banner (`hero-banner.jpg`) loaded on every HomePage visit. Should be lazy-loaded below fold

**State management:**
- Currently using local state (`useState`) in every page with independent `useEffect` fetches
- At scale, this causes redundant network requests when navigating between pages
- React Query is installed but underutilized -- most pages use raw `supabase.from()` calls instead of `useQuery`
- Migrate all data fetching to React Query hooks for automatic caching, deduplication, and background refetching

---

## 6. Real-Time Features Strategy

### Current Implementation

- **Chat:** Supabase Realtime (postgres_changes) per order -- correct pattern
- **Activity feed:** Supabase Realtime per society -- correct pattern
- **No presence tracking** (who's online)

### Scale Concerns

At 50K concurrent connections:

| Feature | Current | At Scale |
|---|---|---|
| Chat | 1 channel per open order | OK -- channels are per-order, naturally sharded |
| Activity feed | 1 channel per society | At 100 societies with 1K concurrent users each = 100K subscriptions. Supabase Realtime handles this via multiplexing |
| Order status updates | Not realtime | Should add -- sellers need instant notification of new orders |

### Recommendations

1. **Keep Supabase Realtime** for chat and activity (already implemented correctly)
2. **Add order status realtime** -- subscribe to `orders` table changes filtered by `seller_id`
3. **Do not add presence tracking** -- unnecessary for this use case
4. **Fallback:** PWA push notifications (already implemented via `send-push-notification` edge function) serve as fallback for missed realtime events

---

## 7. Observability and Monitoring

### Already Implemented
- `trigger_errors` table for trigger failure logging
- `governance-health-check` edge function for abuse detection
- `check-trigger-health` edge function for trigger monitoring
- `pg_stat_statements` enabled
- `audit_log` with 12 action types

### Still Needed

| Component | Implementation | Priority |
|---|---|---|
| Slow query alerting | Edge function reading `pg_stat_statements` for queries > 500ms | HIGH |
| Error tracking (frontend) | Integrate error reporting service via edge function | MEDIUM |
| Uptime monitoring | External ping to `/` endpoint every 5 minutes | MEDIUM |
| API latency tracking | Edge function middleware logging response times | LOW |
| User session analytics | Already tracking via Lovable analytics | DONE |

### Health Check Endpoint

Create a `/health` edge function that returns:
```json
{
  "db": "ok",
  "auth": "ok",
  "realtime": "ok",
  "trigger_errors_24h": 0,
  "orphaned_societies": 0,
  "avg_query_time_ms": 4.2
}
```

---

## 8. Fault Tolerance and Reliability

### Current State

- **Single database instance** (Supabase managed)
- **No manual backup strategy** (Supabase provides daily backups on Pro plan)
- **No retry logic** on failed API calls
- **No idempotency** on payment operations

### Required

1. **Retry logic:** Wrap all `supabase.from()` calls in a retry wrapper (3 attempts with exponential backoff) for network failures
2. **Idempotent orders:** Add `idempotency_key` column to `orders` with unique constraint. Frontend generates UUID before submission. Prevents duplicate orders on retry.
3. **Idempotent payments:** `payment_records` should have `idempotency_key` from Razorpay transaction ID. Already partially done via `razorpay_order_id`.
4. **Graceful degradation:** If Realtime disconnects, fall back to polling (already handled by Supabase client automatically)
5. **Edge function timeouts:** Set explicit timeouts in all edge functions (currently no timeout configuration)

---

## 9. Security and Data Isolation

### Already Hardened
- 166 RLS policies across 56 tables
- `is_society_admin()` checks `deactivated_at IS NULL`
- Products scoped to user's society
- Append-only audit log
- Last admin protection trigger
- Admin limit enforcement trigger

### Additional Measures for Scale

1. **Request signing:** For payment webhooks (`razorpay-webhook`), verify HMAC signature (already implemented -- good)
2. **Input validation:** Edge functions should validate all input against Zod schemas before processing
3. **SQL injection:** Using Supabase client (parameterized queries) -- safe
4. **XSS:** React auto-escapes -- safe. But verify `dangerouslySetInnerHTML` is never used
5. **CSRF:** Not applicable (API-based auth with JWT)
6. **Rate limiting on auth:** Supabase provides built-in rate limiting on auth endpoints

---

## 10. Migration Strategy (Phased)

### Phase 1: Frontend Performance (Week 1-2, no backend changes)
- Add `React.lazy()` to all 30 route imports in `App.tsx`
- Add `Suspense` boundaries with skeleton fallbacks
- Migrate HomePage data fetching from bulk download to targeted queries with limits
- Migrate SellerDashboardPage and OrdersPage to paginated queries
- Wrap all data fetching in React Query hooks

### Phase 2: Database Optimization (Week 3-4)
- Verify all 51 composite indexes are applied and used
- Add missing indexes (chat_messages, user_notifications, products)
- Add cursor-based pagination to all list endpoints
- Add `statement_timeout` to long-running functions
- Add `max_members` quota enforcement to societies

### Phase 3: Caching and Background Jobs (Week 5-6)
- Configure React Query staleTime for all data categories
- Create notification queue table + processing edge function
- Move trust score calculation to scheduled background job
- Implement incremental seller rating calculation

### Phase 4: Observability (Week 7-8)
- Create `/health` edge function
- Add slow query alerting edge function
- Add frontend error tracking
- Create operational dashboard for platform admins

### Phase 5: Resilience (Week 9-10)
- Add retry wrapper for all Supabase calls
- Add idempotency keys to orders and payments
- Add rate limiting middleware to edge functions
- Create data archiving scheduled jobs

---

## What to Change Today

If designing for the next 10 years, these are the changes to make immediately:

1. ~~**Lazy load all routes**~~ ✅ DONE (2026-02-14) -- All 30+ routes lazy-loaded with Suspense
2. **Stop downloading all sellers on HomePage** -- 1 hour of work, prevents the first scalability wall
3. ~~**Add cursor pagination to orders**~~ ✅ DONE (2026-02-14) -- OrdersPage refactored with cursor-based pagination (20 per page)
4. **Migrate all data fetching to React Query** -- 1-2 days, eliminates redundant requests and adds caching
5. ~~**Add `statement_timeout` to SECURITY DEFINER functions**~~ ✅ DONE (2026-02-14) -- 5s timeout on 4 high-risk functions

## Completed Implementations

### 2026-02-14: Phase 1+2 Partial
- **Lazy loading**: All 30+ routes converted to `React.lazy()` with `Suspense` + skeleton fallback
- **Composite indexes**: 14 new indexes on orders, chat_messages, user_notifications, products, society_activity, bulletin_posts, audit_log, reviews, seller_profiles, dispute_tickets, snag_tickets
- **Statement timeouts**: 5s timeout added to `calculate_society_trust_score`, `search_marketplace`, `get_user_auth_context`, `get_builder_dashboard`
- **Health endpoint**: `/health` edge function returning DB status, trigger errors, orphaned societies, table counts
- **Cursor pagination**: OrdersPage refactored with cursor-based "Load More" (20 orders per page)

