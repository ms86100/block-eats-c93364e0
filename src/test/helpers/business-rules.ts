/**
 * Shared business logic helpers for testing.
 * These mirror the real logic in app components and can be tested independently.
 */

// ── Feature Gate Logic ──────────────────────────────────────────────────────
export function getFeatureState(
  feature: { source: string; is_enabled: boolean; society_configurable: boolean } | null | undefined,
  hasSocietyContext: boolean
): 'enabled' | 'disabled' | 'locked' | 'unavailable' {
  if (!hasSocietyContext) return 'disabled';
  if (!feature) return 'unavailable';
  if (feature.source === 'core') return 'locked';
  if (!feature.society_configurable) return feature.is_enabled ? 'locked' : 'disabled';
  return feature.is_enabled ? 'enabled' : 'disabled';
}

export function isFeatureAccessible(state: ReturnType<typeof getFeatureState>): boolean {
  return state === 'enabled' || state === 'locked';
}

// ── Route Classification ────────────────────────────────────────────────────
export const PUBLIC_ROUTES = [
  '/welcome', '/auth', '/privacy-policy', '/terms',
  '/community-rules', '/help', '/pricing', '/reset-password',
];

export function isPublicRoute(route: string): boolean {
  return PUBLIC_ROUTES.includes(route);
}

// ── Role-Based Access ───────────────────────────────────────────────────────
export interface RoleContext {
  isAdmin: boolean;
  isSocietyAdmin: boolean;
  isSecurityOfficer: boolean;
  isSeller: boolean;
  isWorker: boolean;
  isBuilderMember: boolean;
}

export function hasGuardAccess(r: Pick<RoleContext, 'isAdmin' | 'isSocietyAdmin' | 'isSecurityOfficer'>): boolean {
  return r.isAdmin || r.isSocietyAdmin || r.isSecurityOfficer;
}

export function hasManagementAccess(r: Pick<RoleContext, 'isAdmin' | 'isSocietyAdmin'>): boolean {
  return r.isAdmin || r.isSocietyAdmin;
}

export function hasProgressManageAccess(r: Pick<RoleContext, 'isAdmin' | 'isSocietyAdmin' | 'isBuilderMember'>): boolean {
  return r.isAdmin || r.isSocietyAdmin || r.isBuilderMember;
}

export function canPostNotice(r: Pick<RoleContext, 'isAdmin' | 'isSocietyAdmin' | 'isBuilderMember'>): boolean {
  return r.isAdmin || r.isSocietyAdmin || r.isBuilderMember;
}

// ── Profile Menu ────────────────────────────────────────────────────────────
export function getProfileMenuItems(isSeller: boolean, isBuilderMember: boolean, isAdmin: boolean): string[] {
  const items: string[] = [];
  items.push(isSeller ? 'Seller Dashboard' : 'Become a Seller');
  if (isBuilderMember) items.push('Builder Dashboard');
  if (isAdmin) items.push('Admin Panel');
  return items;
}

// ── Verification ────────────────────────────────────────────────────────────
export function getVerificationState(profile: { verification_status: string } | null): 'pending' | 'approved' | 'loading' {
  if (!profile) return 'loading';
  return profile.verification_status === 'approved' ? 'approved' : 'pending';
}

// ── Financial Computations ──────────────────────────────────────────────────
export function computeFinanceSummary(
  expenses: { amount: number }[],
  income: { amount: number }[]
): { totalExpenses: number; totalIncome: number; balance: number; colorClass: string } {
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const totalIncome = income.reduce((s, i) => s + i.amount, 0);
  const balance = totalIncome - totalExpenses;
  return { totalExpenses, totalIncome, balance, colorClass: balance >= 0 ? 'text-success' : 'text-destructive' };
}

// ── Progress Computation ────────────────────────────────────────────────────
export function computeOverallProgress(
  towers: { current_percentage: number }[],
  milestones: { completion_percentage: number }[]
): number {
  if (towers.length > 0) return Math.round(towers.reduce((s, t) => s + t.current_percentage, 0) / towers.length);
  if (milestones.length > 0) return Math.max(...milestones.map(m => m.completion_percentage));
  return 0;
}

// ── Post Sorting ────────────────────────────────────────────────────────────
export function sortByPinAndDate<T extends { is_pinned: boolean; created_at: string }>(posts: T[]): T[] {
  return [...posts].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return b.is_pinned ? 1 : -1;
    return b.created_at.localeCompare(a.created_at);
  });
}

// ── Delivery Fee ────────────────────────────────────────────────────────────
export function computeDeliveryFee(
  orderAmount: number, freeThreshold: number, baseFee: number, fulfillmentType: string
): number {
  if (fulfillmentType !== 'delivery') return 0;
  return orderAmount >= freeThreshold ? 0 : baseFee;
}

// ── Cart Grouping ───────────────────────────────────────────────────────────
export function groupBySeller<T extends { seller_id: string }>(items: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  items.forEach(item => {
    if (!groups.has(item.seller_id)) groups.set(item.seller_id, []);
    groups.get(item.seller_id)!.push(item);
  });
  return groups;
}

// ── Pre-Checkout Validation ─────────────────────────────────────────────────
export function findUnavailableProducts(
  freshProducts: { id: string; is_available: boolean; approval_status: string }[],
  cartProductIds: string[]
): string[] {
  return cartProductIds.filter(pid => {
    const p = freshProducts.find(fp => fp.id === pid);
    return !p || !p.is_available || p.approval_status !== 'approved';
  });
}

// ── SLA Computation ─────────────────────────────────────────────────────────
export function computeSLADeadline(createdAt: Date, slaHours: number): Date {
  return new Date(createdAt.getTime() + slaHours * 60 * 60 * 1000);
}

export function isSLABreached(deadline: Date, now: Date = new Date()): boolean {
  return now > deadline;
}

// ── Absent Workers ──────────────────────────────────────────────────────────
export function computeAbsentWorkers(allWorkerIds: string[], attendanceWorkerIds: string[]): string[] {
  const present = new Set(attendanceWorkerIds);
  return allWorkerIds.filter(id => !present.has(id));
}

// ── Search Filters ──────────────────────────────────────────────────────────
export function hasActiveFilters(
  filters: { minRating: number; isVeg: boolean | null; categories: string[]; sortBy: string | null; priceRange: [number, number] },
  maxPrice: number
): boolean {
  return filters.minRating > 0 || filters.isVeg !== null || filters.categories.length > 0 ||
    filters.sortBy !== null || filters.priceRange[0] > 0 || filters.priceRange[1] < maxPrice;
}

// ── Seller Access ───────────────────────────────────────────────────────────
export function canAccessSellerDetail(params: {
  verificationStatus: string;
  sellerSocietyId: string;
  buyerSocietyId: string | null;
  sellBeyondCommunity: boolean;
}): boolean {
  if (params.verificationStatus !== 'approved') return false;
  if (params.buyerSocietyId && params.sellerSocietyId !== params.buyerSocietyId && !params.sellBeyondCommunity) return false;
  return true;
}

// ── Pagination ──────────────────────────────────────────────────────────────
export function paginationRange(page: number, pageSize: number) {
  return { start: page * pageSize, end: (page + 1) * pageSize - 1 };
}

// ── Notification Title ──────────────────────────────────────────────────────
export function getOrderNotifTitle(status: string, role: 'buyer' | 'seller'): string | null {
  if (role === 'seller') {
    if (status === 'placed') return '🆕 New Order Received!';
    if (status === 'cancelled') return '❌ Order Cancelled';
    return null;
  }
  const map: Record<string, string> = {
    accepted: '✅ Order Accepted!', preparing: '👨‍🍳 Order Being Prepared',
    ready: '🎉 Order Ready!', picked_up: '📦 Order Picked Up',
    delivered: '🚚 Order Delivered', completed: '⭐ Order Completed',
    cancelled: '❌ Order Cancelled', quoted: '💰 Quote Received',
    scheduled: '📅 Booking Confirmed',
  };
  return map[status] || null;
}

// ── Haversine Distance ──────────────────────────────────────────────────────
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Worker Entry Validation ─────────────────────────────────────────────────
export function validateWorkerEntry(worker: {
  status: string; deactivated_at: string | null; flat_count: number; active_days?: string[];
} | null): { valid: boolean; reason?: string } {
  if (!worker) return { valid: false, reason: 'Worker not found in this society' };
  if (worker.status !== 'active') return { valid: false, reason: `Worker status: ${worker.status}` };
  if (worker.deactivated_at) return { valid: false, reason: 'Worker has been deactivated' };
  if (worker.active_days) {
    const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()];
    if (!worker.active_days.includes(day)) return { valid: false, reason: `Not scheduled for today (${day})` };
  }
  if (worker.flat_count === 0) return { valid: false, reason: 'No active flat assignments' };
  return { valid: true };
}

// ── Coupon Validation ───────────────────────────────────────────────────────
export function isCouponApplicable(coupon: {
  is_active: boolean; society_id: string; expires_at: string | null;
  starts_at: string; usage_limit: number | null; times_used: number;
  per_user_limit: number; min_order_amount: number | null;
}, buyerSocietyId: string, orderAmount: number, userRedemptions: number, now: Date = new Date()): { applicable: boolean; reason?: string } {
  if (!coupon.is_active) return { applicable: false, reason: 'Coupon inactive' };
  if (coupon.society_id !== buyerSocietyId) return { applicable: false, reason: 'Cross-society' };
  if (coupon.expires_at && new Date(coupon.expires_at) <= now) return { applicable: false, reason: 'Expired' };
  if (new Date(coupon.starts_at) > now) return { applicable: false, reason: 'Not started' };
  if (coupon.usage_limit !== null && coupon.times_used >= coupon.usage_limit) return { applicable: false, reason: 'Usage limit reached' };
  if (userRedemptions >= coupon.per_user_limit) return { applicable: false, reason: 'Per-user limit reached' };
  if (coupon.min_order_amount !== null && orderAmount < coupon.min_order_amount) return { applicable: false, reason: 'Below minimum' };
  return { applicable: true };
}

// ── Write Safety (view-as) ──────────────────────────────────────────────────
export function getWriteSocietyId(profileSocietyId: string | null, effectiveSocietyId: string | null): string | null {
  return profileSocietyId || effectiveSocietyId || null;
}

export function getReadSocietyId(effectiveSocietyId: string | null, profileSocietyId: string | null): string | null {
  return effectiveSocietyId || profileSocietyId || null;
}

// ── Milestone Progress ──────────────────────────────────────────────────────
export function computeMilestoneProgress(
  milestones: { amount_percentage: number; status: string }[]
): { totalPercent: number; paidPercent: number; progressPercent: number } {
  const totalPercent = milestones.reduce((s, m) => s + m.amount_percentage, 0);
  const paidPercent = milestones.filter(m => m.status === 'paid').reduce((s, m) => s + m.amount_percentage, 0);
  const progressPercent = totalPercent > 0 ? Math.round((paidPercent / totalPercent) * 100) : 0;
  return { totalPercent, paidPercent, progressPercent };
}

// ── Inspection Score ────────────────────────────────────────────────────────
export function computeInspectionScore(
  items: { status: string }[]
): { checked: number; total: number; passed: number; failed: number; progress: number; score: number } {
  const total = items.length;
  const checked = items.filter(i => i.status !== 'not_checked').length;
  const passed = items.filter(i => i.status === 'pass').length;
  const failed = items.filter(i => i.status === 'fail').length;
  const progress = total > 0 ? Math.round((checked / total) * 100) : 0;
  const score = total > 0 ? Math.round((passed / total) * 100) : 0;
  return { checked, total, passed, failed, progress, score };
}

// ── Report Metrics ──────────────────────────────────────────────────────────
export function computeDisputeResolutionRate(opened: number, resolved: number): number {
  return opened > 0 ? Math.round((resolved / opened) * 100) : 0;
}

export function computeMaintenanceCollectionRate(collected: number, pending: number): number {
  const total = collected + pending;
  return total > 0 ? Math.round((collected / total) * 100) : 0;
}

export function categorizeResponseTime(hours: number): 'up' | 'neutral' | 'down' {
  if (hours <= 24) return 'up';
  if (hours <= 48) return 'neutral';
  return 'down';
}

// ── Society Dashboard Search ────────────────────────────────────────────────
export function dashboardItemMatchesSearch(
  item: { label: string; stat?: string; keywords?: string[] },
  query: string
): boolean {
  const haystack = [item.label, item.stat || '', ...(item.keywords || [])].join(' ').toLowerCase();
  return haystack.includes(query.toLowerCase());
}

// ── Seller Stats ────────────────────────────────────────────────────────────
export function computeCancellationRate(completed: number, cancelled: number): number {
  const total = completed + cancelled;
  return total > 0 ? Math.round((cancelled / total) * 100 * 10) / 10 : 0;
}

// ── Gate Token Logic ────────────────────────────────────────────────────────
export function isTokenExpired(issuedAtMs: number, ttlMs: number = 60_000, nowMs: number = Date.now()): boolean {
  return nowMs > issuedAtMs + ttlMs;
}

export function isNonceDuplicate(nonce: string, seenNonces: Set<string>): boolean {
  return seenNonces.has(nonce);
}

export function getSecurityModeStatus(mode: string): 'confirmed' | 'awaiting_confirmation' {
  return mode === 'basic' ? 'confirmed' : 'awaiting_confirmation';
}

// ── Manual Entry Validation ─────────────────────────────────────────────────
export function validateManualEntry(flatNumber: string, visitorName: string): { valid: boolean; reason?: string } {
  if (!flatNumber.trim()) return { valid: false, reason: 'Flat number is required' };
  if (!visitorName.trim()) return { valid: false, reason: 'Visitor name is required' };
  return { valid: true };
}

export const MANUAL_ENTRY_TRANSITIONS: Record<string, string[]> = {
  pending: ['approved', 'denied', 'expired'],
  approved: [],
  denied: [],
  expired: [],
};

// ── Visitor Management ──────────────────────────────────────────────────────
export const VISITOR_TRANSITIONS: Record<string, string[]> = {
  expected: ['checked_in', 'cancelled'],
  checked_in: ['checked_out'],
  checked_out: [],
  cancelled: [],
};

export function isOTPValid(otp: string): boolean {
  return /^\d{6}$/.test(otp);
}

export function isOTPExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt < now;
}

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── Parcel Management ───────────────────────────────────────────────────────
export function canLogParcel(residentId: string, authUid: string, isAdmin: boolean): boolean {
  return residentId === authUid || isAdmin;
}

export function filterParcelsByStatus<T extends { status: string }>(parcels: T[], status: string): T[] {
  return parcels.filter(p => p.status === status);
}

// ── Security Audit Metrics ──────────────────────────────────────────────────
export function computePercentage(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

export function computeAverageMs(times: number[]): number {
  return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
}

// ── Guard Confirmation Poller ───────────────────────────────────────────────
export function decrementCountdown(remaining: number, step: number = 1): number {
  return Math.max(remaining - step, 0);
}

export function isPollingIntervalValid(intervalMs: number): boolean {
  return intervalMs >= 4000 && intervalMs <= 5000;
}
