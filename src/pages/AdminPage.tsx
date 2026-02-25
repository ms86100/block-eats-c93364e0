import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { PaymentStatus } from '@/types/database';
import {
  Check, X, Users, Store, Package, Star, Award, Eye, EyeOff,
  DollarSign, Flag, Building2, TrendingUp, ShieldCheck, CreditCard,
  Layers, Settings2, LayoutGrid, AlertCircle, Megaphone, Navigation,
} from 'lucide-react';
import { format } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { ApiKeySettings } from '@/components/admin/ApiKeySettings';
import { AppNavigator } from '@/components/admin/AppNavigator';
import { SellerApplicationReview } from '@/components/admin/SellerApplicationReview';
import { AdminDisputesTab } from '@/components/admin/AdminDisputesTab';
import { EmergencyBroadcastSheet } from '@/components/admin/EmergencyBroadcastSheet';
import { SocietySwitcher } from '@/components/admin/SocietySwitcher';
import { FeatureManagement } from '@/components/admin/FeatureManagement';
import { PlatformSettingsManager } from '@/components/admin/PlatformSettingsManager';
import { AdminCatalogManager } from '@/components/admin/AdminCatalogManager';
import { AdminBannerManager } from '@/components/admin/AdminBannerManager';
import { ResetAndSeedButton } from '@/components/admin/ResetAndSeedButton';
import { useAdminData } from '@/hooks/useAdminData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/* ── Stat Card ── */
function StatCard({ icon: Icon, value, label, color, delay = 0 }: { icon: any; value: string | number; label: string; color: string; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.4, delay }}>
      <Card className="border-0 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-md)] transition-all duration-300 rounded-2xl group">
        <CardContent className="p-3.5 flex items-center gap-3">
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110', color)}>
            <Icon size={17} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-extrabold tabular-nums leading-tight tracking-tight">{value}</p>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">{label}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ── Section Header ── */
function SectionHeader({ icon: Icon, title, count, action, color = 'bg-primary/10 text-primary' }: { icon: any; title: string; count?: number; action?: React.ReactNode; color?: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', color.split(' ')[0])}>
          <Icon size={15} className={color.split(' ')[1] || 'text-primary'} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground tracking-tight">
            {title}
            {count !== undefined && <span className="text-muted-foreground font-normal ml-1.5 text-xs">({count})</span>}
          </h3>
        </div>
      </div>
      {action}
    </div>
  );
}

const TAB_CONFIG = [
  { value: 'sellers', label: 'Sellers', icon: Store },
  { value: 'users', label: 'Users', icon: Users },
  { value: 'societies', label: 'Societies', icon: Building2 },
  { value: 'disputes', label: 'Disputes', icon: AlertCircle },
  { value: 'catalog', label: 'Catalog', icon: LayoutGrid },
  { value: 'reports', label: 'Reports', icon: Flag },
  { value: 'payments', label: 'Payments', icon: CreditCard },
  { value: 'reviews', label: 'Reviews', icon: Star },
  { value: 'featured', label: 'Featured', icon: Megaphone },
  { value: 'features', label: 'Features', icon: Layers },
  { value: 'settings', label: 'Settings', icon: Settings2 },
  { value: 'navigator', label: 'Navigate', icon: Navigation },
];

export default function AdminPage() {
  const admin = useAdminData();

  if (admin.isLoading) {
    return (
      <AppLayout headerTitle="Admin Panel" showLocation={false}>
        <div className="p-4 space-y-5">
          <Skeleton className="h-14 w-56 rounded-2xl" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[76px] w-full rounded-2xl" />)}
          </div>
          <Skeleton className="h-10 w-full rounded-xl" />
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout headerTitle="Admin Panel" showLocation={false}>
      <div className="pb-8">
        {/* ═══ HEADER ═══ */}
        <div className="px-4 pt-5 pb-4">
          <div className="flex items-center justify-between mb-4">
            <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
              <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Dashboard</h1>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">Platform overview & management</p>
            </motion.div>
            <EmergencyBroadcastSheet />
          </div>
          <SocietySwitcher />
        </div>

        {/* ═══ STATS GRID ═══ */}
        <div className="px-4 mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={Users} value={admin.stats.users} label="Users" color="bg-blue-500" delay={0} />
            <StatCard icon={Store} value={admin.stats.sellers} label="Sellers" color="bg-emerald-500" delay={0.05} />
            <StatCard icon={Package} value={admin.stats.orders} label="Orders" color="bg-amber-500" delay={0.1} />
            <StatCard icon={DollarSign} value={admin.formatPrice(admin.stats.revenue)} label="Revenue" color="bg-violet-500" delay={0.15} />
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3">
            <StatCard icon={Building2} value={admin.stats.societies} label="Societies" color="bg-cyan-500" delay={0.2} />
            <StatCard icon={Star} value={admin.stats.reviews} label="Reviews" color="bg-indigo-500" delay={0.25} />
            <StatCard icon={Flag} value={admin.stats.pendingReports} label="Reports" color="bg-rose-500" delay={0.3} />
          </div>
        </div>

        {/* ═══ TABS ═══ */}
        <div className="px-4">
          <Tabs value={admin.activeTab} onValueChange={admin.setActiveTab}>
            <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2">
              <TabsList className="inline-flex w-auto gap-0.5 bg-muted/60 p-1 rounded-2xl backdrop-blur-sm">
                {TAB_CONFIG.map(tab => {
                  const TabIcon = tab.icon;
                  return (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="text-[11px] px-3 py-2 rounded-xl whitespace-nowrap gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-[var(--shadow-sm)] data-[state=active]:text-foreground data-[state=active]:font-semibold transition-all duration-200"
                    >
                      <TabIcon size={12} />
                      {tab.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            {/* ── SELLERS ── */}
            <TabsContent value="sellers" className="mt-5">
              <SellerApplicationReview />
            </TabsContent>


            {/* ── USERS ── */}
            <TabsContent value="users" className="mt-5 space-y-3">
              <SectionHeader icon={Users} title="Pending Users" count={admin.pendingUsers.length} color="bg-blue-500/10 text-blue-600" />
              {admin.pendingUsers.length > 0 ? admin.pendingUsers.map((user) => (
                <motion.div key={user.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="border-0 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-md)] transition-all duration-300 rounded-2xl">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-blue-500/10 flex items-center justify-center">
                          <Users size={17} className="text-blue-600" />
                        </div>
                        <div>
                          <p className="font-bold text-sm">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{(user as any).email && `${(user as any).email} • `}{user.phone}</p>
                          <p className="text-[11px] text-muted-foreground">{user.phase && `${user.phase}, `}Block {user.block}, Flat {user.flat_number}</p>
                          {(user as any).society?.name && <p className="text-[11px] text-primary font-semibold mt-0.5">{(user as any).society.name}</p>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="text-destructive h-9 w-9 p-0 rounded-xl hover:bg-destructive/10 transition-colors" onClick={() => admin.updateUserStatus(user.id, 'rejected')}>
                          <X size={15} />
                        </Button>
                        <Button size="sm" className="h-9 w-9 p-0 rounded-xl shadow-sm" onClick={() => admin.updateUserStatus(user.id, 'approved')}>
                          <Check size={15} />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )) : (
                <EmptyState message="No pending users" />
              )}
            </TabsContent>

            {/* ── SOCIETIES ── */}
            <TabsContent value="societies" className="mt-5 space-y-3">
              <SectionHeader
                icon={Building2}
                title="Societies"
                count={admin.allSocieties.length}
                color="bg-cyan-500/10 text-cyan-600"
                action={
                  <Badge variant="outline" className="text-xs rounded-lg font-semibold">
                    {admin.allSocieties.filter(s => !s.is_verified).length} pending
                  </Badge>
                }
              />
              {admin.allSocieties.map((soc) => (
                <motion.div key={soc.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="border-0 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-md)] transition-all duration-300 rounded-2xl">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'w-3 h-3 rounded-full shrink-0 ring-4',
                            soc.is_verified ? 'bg-emerald-500 ring-emerald-500/20' : 'bg-amber-400 ring-amber-400/20'
                          )} />
                          <div>
                            <p className="font-bold text-sm">{soc.name}</p>
                            <p className="text-xs text-muted-foreground">{[soc.city, soc.state, soc.pincode].filter(Boolean).join(', ')}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <Badge variant="secondary" className="text-[10px] h-5 rounded-md font-semibold">{soc.member_count} members</Badge>
                              <Badge variant={soc.is_verified ? 'default' : 'outline'} className="text-[10px] h-5 rounded-md">
                                {soc.is_verified ? '✓ Verified' : 'Pending'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {!soc.is_verified && (
                            <>
                              <Button size="sm" variant="outline" className="text-destructive h-9 w-9 p-0 rounded-xl" onClick={() => admin.updateSocietyStatus(soc.id, false, false)}>
                                <X size={14} />
                              </Button>
                              <Button size="sm" className="h-9 w-9 p-0 rounded-xl" onClick={() => admin.updateSocietyStatus(soc.id, true, true)}>
                                <Check size={14} />
                              </Button>
                            </>
                          )}
                          {soc.is_verified && (
                            <Switch checked={soc.is_active} onCheckedChange={(active) => admin.updateSocietyStatus(soc.id, true, active)} />
                          )}
                        </div>
                      </div>
                      {soc.is_verified && (
                        <div className="mt-3 pt-3 border-t border-border/30 flex items-center gap-2">
                          <span className="text-[11px] text-muted-foreground font-medium">Invite Code:</span>
                          {soc.invite_code ? (
                            <div className="flex items-center gap-2">
                              <code className="text-xs bg-muted px-3 py-1 rounded-lg font-mono font-bold tracking-[0.2em]">{soc.invite_code}</code>
                              <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2 text-destructive rounded-lg" onClick={async () => {
                                await supabase.from('societies').update({ invite_code: null }).eq('id', soc.id);
                                admin.fetchData();
                                toast.success('Invite code removed');
                              }}>Remove</Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="outline" className="h-7 text-[10px] px-3 rounded-lg" onClick={async () => {
                              const code = Math.random().toString(36).substring(2, 8).toUpperCase();
                              await supabase.from('societies').update({ invite_code: code }).eq('id', soc.id);
                              admin.fetchData();
                              toast.success(`Invite code generated: ${code}`);
                            }}>Generate Code</Button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </TabsContent>

            {/* ── DISPUTES ── */}
            <TabsContent value="disputes" className="mt-5">
              <AdminDisputesTab />
            </TabsContent>

            {/* ── PAYMENTS ── */}
            <TabsContent value="payments" className="mt-5 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <SectionHeader icon={CreditCard} title="Payments" color="bg-emerald-500/10 text-emerald-600" />
                <Select value={admin.paymentFilter} onValueChange={admin.setPaymentFilter}>
                  <SelectTrigger className="w-28 h-8 text-xs rounded-xl border-border/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="cod">COD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {admin.payments.length > 0 ? admin.payments.map((payment) => {
                const statusInfo = admin.getPaymentStatus(payment.payment_status as PaymentStatus);
                return (
                  <Card key={payment.id} className="border-0 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-md)] transition-all duration-300 rounded-2xl">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                            <DollarSign size={16} className="text-emerald-600" />
                          </div>
                          <div>
                            <p className="font-bold text-sm">{(payment as any).seller?.business_name}</p>
                            <p className="text-xs text-muted-foreground">{(payment as any).order?.buyer?.name} • {format(new Date(payment.created_at), 'MMM d, h:mm a')}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-extrabold text-sm">{admin.formatPrice(payment.amount)}</p>
                          <span className={cn('text-[10px] px-2.5 py-0.5 rounded-full font-semibold', statusInfo.color)}>
                            {statusInfo.label}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              }) : <EmptyState message="No payments found" />}
              {admin.hasMorePayments && (
                <Button variant="outline" size="sm" className="w-full rounded-xl h-10 font-semibold" onClick={admin.loadMorePayments} disabled={admin.isLoadingMore}>
                  {admin.isLoadingMore ? 'Loading…' : 'Load More'}
                </Button>
              )}
            </TabsContent>

            {/* ── REPORTS ── */}
            <TabsContent value="reports" className="mt-5 space-y-3">
              <SectionHeader icon={Flag} title="Abuse Reports" color="bg-rose-500/10 text-rose-600" />
              {admin.reports.length > 0 ? admin.reports.map((report) => {
                const statusColors: Record<string, string> = {
                  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                  reviewed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                  resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                  dismissed: 'bg-muted text-muted-foreground',
                };
                return (
                  <Card key={report.id} className="border-0 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-md)] transition-all duration-300 rounded-2xl">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className="text-[10px] capitalize rounded-md">{report.report_type}</Badge>
                            <span className={cn('text-[10px] px-2.5 py-0.5 rounded-full font-semibold', statusColors[report.status])}>
                              {report.status}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Reported by <span className="font-semibold text-foreground">{report.reporter?.name || 'Unknown'}</span>
                          </p>
                          {report.reported_seller && (
                            <p className="text-xs text-muted-foreground">
                              Against <span className="font-semibold text-destructive">{report.reported_seller.business_name}</span>
                            </p>
                          )}
                          <p className="text-[11px] text-muted-foreground mt-1">{format(new Date(report.created_at), 'MMM d, h:mm a')}</p>
                          {report.description && <p className="text-sm mt-2 line-clamp-2 text-foreground">{report.description}</p>}
                        </div>
                        {report.status === 'pending' && (
                          <Button size="sm" variant="outline" className="rounded-xl text-xs shrink-0 font-semibold" onClick={() => admin.setSelectedReport(report)}>
                            Review
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              }) : <EmptyState message="No reports" />}
              {admin.hasMoreReports && (
                <Button variant="outline" size="sm" className="w-full rounded-xl h-10 font-semibold" onClick={admin.loadMoreReports} disabled={admin.isLoadingMore}>
                  {admin.isLoadingMore ? 'Loading…' : 'Load More'}
                </Button>
              )}
            </TabsContent>

            {/* ── REVIEWS ── */}
            <TabsContent value="reviews" className="mt-5 space-y-3">
              <SectionHeader icon={Star} title="Review Moderation" color="bg-amber-500/10 text-amber-600" />
              {admin.reviews.map((review) => (
                <Card key={review.id} className={cn('border-0 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-md)] transition-all duration-300 rounded-2xl', review.is_hidden && 'opacity-50')}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm truncate">{(review as any).buyer?.name}</p>
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map(s => (
                              <Star key={s} size={11} className={s <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'} />
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">for {(review as any).seller?.business_name}</p>
                        {review.comment && <p className="text-sm mt-2 line-clamp-2">{review.comment}</p>}
                        {review.is_hidden && <p className="text-xs text-destructive mt-1 font-semibold">Hidden: {review.hidden_reason}</p>}
                      </div>
                      <Button size="sm" variant="ghost" className="h-9 w-9 p-0 rounded-xl hover:bg-muted" onClick={() => review.is_hidden ? admin.toggleReviewHidden(review, false) : admin.setSelectedReview(review)}>
                        {review.is_hidden ? <Eye size={15} /> : <EyeOff size={15} />}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {admin.hasMoreReviews && (
                <Button variant="outline" size="sm" className="w-full rounded-xl h-10 font-semibold" onClick={admin.loadMoreReviews} disabled={admin.isLoadingMore}>
                  {admin.isLoadingMore ? 'Loading…' : 'Load More'}
                </Button>
              )}
            </TabsContent>

            {/* ── FEATURED ── */}
            <TabsContent value="featured" className="mt-5 space-y-6">
              <AdminBannerManager />
              <div className="border-t border-border/30 pt-5">
                <SectionHeader icon={Award} title="Featured Sellers" color="bg-amber-500/10 text-amber-600" />
                <div className="space-y-2.5">
                  {admin.allSellers.map((seller) => (
                    <Card key={seller.id} className="border-0 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-md)] transition-all duration-300 rounded-2xl">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {seller.is_featured && (
                            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                              <Award size={15} className="text-amber-500" />
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-sm">{seller.business_name}</p>
                            <p className="text-xs text-muted-foreground">⭐ {seller.rating.toFixed(1)} • {seller.total_reviews} reviews</p>
                          </div>
                        </div>
                        <Switch checked={seller.is_featured} onCheckedChange={() => admin.toggleSellerFeatured(seller)} />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* ── FEATURES ── */}
            <TabsContent value="features" className="mt-5">
              <FeatureManagement />
            </TabsContent>

            {/* ── CATALOG ── */}
            <TabsContent value="catalog" className="mt-5">
              <AdminCatalogManager />
            </TabsContent>

            {/* ── SETTINGS ── */}
            <TabsContent value="settings" className="mt-5 space-y-5">
              <PlatformSettingsManager />
              <ApiKeySettings />
              <ResetAndSeedButton />
            </TabsContent>

            {/* ── NAVIGATOR ── */}
            <TabsContent value="navigator" className="mt-5">
              <AppNavigator />
            </TabsContent>
          </Tabs>
        </div>

        {/* ═══ DIALOGS ═══ */}
        <Dialog open={!!admin.selectedReview} onOpenChange={() => admin.setSelectedReview(null)}>
          <DialogContent className="rounded-2xl">
            <DialogHeader><DialogTitle className="font-bold">Hide Review</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2 font-medium">Reason for hiding:</p>
                <Input placeholder="e.g., Inappropriate content" value={admin.hideReason} onChange={(e) => admin.setHideReason(e.target.value)} className="rounded-xl" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 rounded-xl h-10" onClick={() => admin.setSelectedReview(null)}>Cancel</Button>
                <Button className="flex-1 rounded-xl h-10 font-semibold" onClick={() => admin.selectedReview && admin.toggleReviewHidden(admin.selectedReview, true)}>Hide Review</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!admin.selectedReport} onOpenChange={() => admin.setSelectedReport(null)}>
          <DialogContent className="rounded-2xl">
            <DialogHeader><DialogTitle className="font-bold">Review Report</DialogTitle></DialogHeader>
            {admin.selectedReport && (
              <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-xl">
                  <p className="text-sm"><strong>Type:</strong> {admin.selectedReport.report_type}</p>
                  {admin.selectedReport.description && <p className="text-sm mt-1.5 text-muted-foreground">{admin.selectedReport.description}</p>}
                </div>
                <Textarea placeholder="Admin notes..." value={admin.adminNotes} onChange={(e) => admin.setAdminNotes(e.target.value)} className="rounded-xl" />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 rounded-xl h-10" onClick={() => admin.updateReportStatus(admin.selectedReport!, 'dismissed')}>Dismiss</Button>
                  <Button className="flex-1 rounded-xl h-10 font-semibold" onClick={() => admin.updateReportStatus(admin.selectedReport!, 'resolved')}>Resolve</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!admin.selectedUserForWarning} onOpenChange={() => admin.setSelectedUserForWarning(null)}>
          <DialogContent className="rounded-2xl">
            <DialogHeader><DialogTitle className="font-bold">Issue Warning</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Textarea placeholder="Warning reason..." value={admin.warningReason} onChange={(e) => admin.setWarningReason(e.target.value)} className="rounded-xl" />
              <Select value={admin.warningSeverity} onValueChange={(v) => admin.setWarningSeverity(v as any)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="final_warning">Final Warning</SelectItem>
                </SelectContent>
              </Select>
              <Button className="w-full rounded-xl h-10 font-semibold" onClick={() => admin.selectedUserForWarning && admin.issueWarning(admin.selectedUserForWarning)} disabled={!admin.warningReason}>
                Issue Warning
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

/* ── Empty State ── */
function EmptyState({ message }: { message: string }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-muted/80 flex items-center justify-center mb-3">
        <ShieldCheck size={22} className="text-muted-foreground/60" />
      </div>
      <p className="text-sm text-muted-foreground font-medium">{message}</p>
    </motion.div>
  );
}
