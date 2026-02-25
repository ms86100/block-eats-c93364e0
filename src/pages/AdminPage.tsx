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
import { AdminProductApprovals } from '@/components/admin/AdminProductApprovals';
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
function StatCard({ icon: Icon, value, label, color }: { icon: any; value: string | number; label: string; color: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardContent className="p-3 flex items-center gap-3">
          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', color)}>
            <Icon size={16} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold tabular-nums leading-tight">{value}</p>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ── Section Header ── */
function SectionHeader({ icon: Icon, title, count, action }: { icon: any; title: string; count?: number; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon size={14} className="text-primary" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">
          {title}
          {count !== undefined && <span className="text-muted-foreground font-normal ml-1.5">({count})</span>}
        </h3>
      </div>
      {action}
    </div>
  );
}

export default function AdminPage() {
  const admin = useAdminData();

  if (admin.isLoading) {
    return (
      <AppLayout headerTitle="Admin Panel" showLocation={false}>
        <div className="p-4 space-y-4">
          <Skeleton className="h-12 w-48" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
          <Skeleton className="h-10 w-full" />
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout headerTitle="Admin Panel" showLocation={false}>
      <div className="pb-8">
        {/* ═══ HEADER ═══ */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">Dashboard</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Platform overview & management</p>
            </div>
            <EmergencyBroadcastSheet />
          </div>
          <SocietySwitcher />
        </div>

        {/* ═══ STATS GRID ═══ */}
        <div className="px-4 mb-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <StatCard icon={Users} value={admin.stats.users} label="Users" color="bg-blue-500" />
            <StatCard icon={Store} value={admin.stats.sellers} label="Sellers" color="bg-emerald-500" />
            <StatCard icon={Package} value={admin.stats.orders} label="Orders" color="bg-amber-500" />
            <StatCard icon={DollarSign} value={admin.formatPrice(admin.stats.revenue)} label="Revenue" color="bg-violet-500" />
          </div>
          <div className="grid grid-cols-3 gap-2.5 mt-2.5">
            <StatCard icon={Building2} value={admin.stats.societies} label="Societies" color="bg-cyan-500" />
            <StatCard icon={Star} value={admin.stats.reviews} label="Reviews" color="bg-indigo-500" />
            <StatCard icon={Flag} value={admin.stats.pendingReports} label="Reports" color="bg-rose-500" />
          </div>
        </div>

        {/* ═══ TABS ═══ */}
        <div className="px-4">
          <Tabs value={admin.activeTab} onValueChange={admin.setActiveTab}>
            {/* Scrollable tab bar */}
            <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
              <TabsList className="inline-flex w-auto gap-1 bg-muted/50 p-1 rounded-xl">
                {[
                  { value: 'sellers', label: 'Sellers' },
                  { value: 'products', label: 'Products' },
                  { value: 'users', label: 'Users' },
                  { value: 'societies', label: 'Societies' },
                  { value: 'disputes', label: 'Disputes' },
                  { value: 'catalog', label: 'Catalog' },
                  { value: 'reports', label: 'Reports' },
                  { value: 'payments', label: 'Payments' },
                  { value: 'reviews', label: 'Reviews' },
                  { value: 'featured', label: 'Featured' },
                  { value: 'features', label: 'Features' },
                  { value: 'settings', label: 'Settings' },
                  { value: 'navigator', label: 'Navigate' },
                ].map(tab => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="text-xs px-3.5 py-1.5 rounded-lg whitespace-nowrap data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground transition-all"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* ── SELLERS ── */}
            <TabsContent value="sellers" className="mt-4">
              <SellerApplicationReview />
            </TabsContent>

            {/* ── PRODUCTS ── */}
            <TabsContent value="products" className="mt-4">
              <AdminProductApprovals />
            </TabsContent>

            {/* ── USERS ── */}
            <TabsContent value="users" className="mt-4 space-y-2.5">
              <SectionHeader icon={Users} title="Pending Users" count={admin.pendingUsers.length} />
              {admin.pendingUsers.length > 0 ? admin.pendingUsers.map((user) => (
                <Card key={user.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users size={16} className="text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{(user as any).email && `${(user as any).email} • `}{user.phone}</p>
                        <p className="text-[11px] text-muted-foreground">{user.phase && `${user.phase}, `}Block {user.block}, Flat {user.flat_number}</p>
                        {(user as any).society?.name && <p className="text-[11px] text-primary font-medium mt-0.5">{(user as any).society.name}</p>}
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" className="text-destructive h-9 w-9 p-0 rounded-xl hover:bg-destructive/10" onClick={() => admin.updateUserStatus(user.id, 'rejected')}>
                        <X size={15} />
                      </Button>
                      <Button size="sm" className="h-9 w-9 p-0 rounded-xl" onClick={() => admin.updateUserStatus(user.id, 'approved')}>
                        <Check size={15} />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )) : (
                <EmptyState message="No pending users" />
              )}
            </TabsContent>

            {/* ── SOCIETIES ── */}
            <TabsContent value="societies" className="mt-4 space-y-2.5">
              <SectionHeader
                icon={Building2}
                title="Societies"
                count={admin.allSocieties.length}
                action={
                  <Badge variant="outline" className="text-xs">
                    {admin.allSocieties.filter(s => !s.is_verified).length} pending
                  </Badge>
                }
              />
              {admin.allSocieties.map((soc) => (
                <Card key={soc.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-3 h-3 rounded-full shrink-0',
                          soc.is_verified ? 'bg-emerald-500' : 'bg-amber-400'
                        )} />
                        <div>
                          <p className="font-semibold text-sm">{soc.name}</p>
                          <p className="text-xs text-muted-foreground">{[soc.city, soc.state, soc.pincode].filter(Boolean).join(', ')}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-[10px] h-5">{soc.member_count} members</Badge>
                            <Badge variant={soc.is_verified ? 'default' : 'outline'} className="text-[10px] h-5">
                              {soc.is_verified ? 'Verified' : 'Pending'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
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
                      <div className="mt-3 pt-3 border-t border-border/40 flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">Invite Code:</span>
                        {soc.invite_code ? (
                          <div className="flex items-center gap-1.5">
                            <code className="text-xs bg-muted px-2.5 py-1 rounded-lg font-mono font-bold tracking-wider">{soc.invite_code}</code>
                            <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2 text-destructive" onClick={async () => {
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
              ))}
            </TabsContent>

            {/* ── DISPUTES ── */}
            <TabsContent value="disputes" className="mt-4">
              <AdminDisputesTab />
            </TabsContent>

            {/* ── PAYMENTS ── */}
            <TabsContent value="payments" className="mt-4 space-y-2.5">
              <div className="flex items-center justify-between mb-3">
                <SectionHeader icon={CreditCard} title="Payments" />
                <Select value={admin.paymentFilter} onValueChange={admin.setPaymentFilter}>
                  <SelectTrigger className="w-28 h-8 text-xs rounded-lg">
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
                  <Card key={payment.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                            <DollarSign size={16} className="text-emerald-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{(payment as any).seller?.business_name}</p>
                            <p className="text-xs text-muted-foreground">{(payment as any).order?.buyer?.name} • {format(new Date(payment.created_at), 'MMM d, h:mm a')}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-sm">{admin.formatPrice(payment.amount)}</p>
                          <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', statusInfo.color)}>
                            {statusInfo.label}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              }) : <EmptyState message="No payments found" />}
              {admin.hasMorePayments && (
                <Button variant="outline" size="sm" className="w-full rounded-xl" onClick={admin.loadMorePayments} disabled={admin.isLoadingMore}>
                  {admin.isLoadingMore ? 'Loading…' : 'Load More'}
                </Button>
              )}
            </TabsContent>

            {/* ── REPORTS ── */}
            <TabsContent value="reports" className="mt-4 space-y-2.5">
              <SectionHeader icon={Flag} title="Abuse Reports" />
              {admin.reports.length > 0 ? admin.reports.map((report) => {
                const statusColors: Record<string, string> = {
                  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                  reviewed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                  resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                  dismissed: 'bg-muted text-muted-foreground',
                };
                return (
                  <Card key={report.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className="text-[10px] capitalize">{report.report_type}</Badge>
                            <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', statusColors[report.status])}>
                              {report.status}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1.5">
                            Reported by <span className="font-medium text-foreground">{report.reporter?.name || 'Unknown'}</span>
                          </p>
                          {report.reported_seller && (
                            <p className="text-xs text-muted-foreground">
                              Against <span className="font-medium text-destructive">{report.reported_seller.business_name}</span>
                            </p>
                          )}
                          <p className="text-[11px] text-muted-foreground mt-1">{format(new Date(report.created_at), 'MMM d, h:mm a')}</p>
                          {report.description && <p className="text-sm mt-2 line-clamp-2 text-foreground">{report.description}</p>}
                        </div>
                        {report.status === 'pending' && (
                          <Button size="sm" variant="outline" className="rounded-lg text-xs shrink-0" onClick={() => admin.setSelectedReport(report)}>
                            Review
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              }) : <EmptyState message="No reports" />}
              {admin.hasMoreReports && (
                <Button variant="outline" size="sm" className="w-full rounded-xl" onClick={admin.loadMoreReports} disabled={admin.isLoadingMore}>
                  {admin.isLoadingMore ? 'Loading…' : 'Load More'}
                </Button>
              )}
            </TabsContent>

            {/* ── REVIEWS ── */}
            <TabsContent value="reviews" className="mt-4 space-y-2.5">
              <SectionHeader icon={Star} title="Review Moderation" />
              {admin.reviews.map((review) => (
                <Card key={review.id} className={cn('border-0 shadow-sm hover:shadow-md transition-shadow', review.is_hidden && 'opacity-50')}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm truncate">{(review as any).buyer?.name}</p>
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map(s => (
                              <Star key={s} size={11} className={s <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'} />
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">for {(review as any).seller?.business_name}</p>
                        {review.comment && <p className="text-sm mt-1.5 line-clamp-2">{review.comment}</p>}
                        {review.is_hidden && <p className="text-xs text-destructive mt-1 font-medium">Hidden: {review.hidden_reason}</p>}
                      </div>
                      <Button size="sm" variant="ghost" className="h-9 w-9 p-0 rounded-xl" onClick={() => review.is_hidden ? admin.toggleReviewHidden(review, false) : admin.setSelectedReview(review)}>
                        {review.is_hidden ? <Eye size={15} /> : <EyeOff size={15} />}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {admin.hasMoreReviews && (
                <Button variant="outline" size="sm" className="w-full rounded-xl" onClick={admin.loadMoreReviews} disabled={admin.isLoadingMore}>
                  {admin.isLoadingMore ? 'Loading…' : 'Load More'}
                </Button>
              )}
            </TabsContent>

            {/* ── FEATURED ── */}
            <TabsContent value="featured" className="mt-4 space-y-6">
              <AdminBannerManager />
              <div className="border-t pt-5">
                <SectionHeader icon={Award} title="Featured Sellers" />
                <div className="space-y-2">
                  {admin.allSellers.map((seller) => (
                    <Card key={seller.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {seller.is_featured && (
                            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                              <Award size={14} className="text-amber-500" />
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-sm">{seller.business_name}</p>
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
            <TabsContent value="features" className="mt-4">
              <FeatureManagement />
            </TabsContent>

            {/* ── CATALOG ── */}
            <TabsContent value="catalog" className="mt-4">
              <AdminCatalogManager />
            </TabsContent>

            {/* ── SETTINGS ── */}
            <TabsContent value="settings" className="mt-4 space-y-5">
              <PlatformSettingsManager />
              <ApiKeySettings />
              <ResetAndSeedButton />
            </TabsContent>

            {/* ── NAVIGATOR ── */}
            <TabsContent value="navigator" className="mt-4">
              <AppNavigator />
            </TabsContent>
          </Tabs>
        </div>

        {/* ═══ DIALOGS ═══ */}
        <Dialog open={!!admin.selectedReview} onOpenChange={() => admin.setSelectedReview(null)}>
          <DialogContent className="rounded-2xl">
            <DialogHeader><DialogTitle>Hide Review</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Reason for hiding:</p>
                <Input placeholder="e.g., Inappropriate content" value={admin.hideReason} onChange={(e) => admin.setHideReason(e.target.value)} className="rounded-xl" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => admin.setSelectedReview(null)}>Cancel</Button>
                <Button className="flex-1 rounded-xl" onClick={() => admin.selectedReview && admin.toggleReviewHidden(admin.selectedReview, true)}>Hide Review</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!admin.selectedReport} onOpenChange={() => admin.setSelectedReport(null)}>
          <DialogContent className="rounded-2xl">
            <DialogHeader><DialogTitle>Review Report</DialogTitle></DialogHeader>
            {admin.selectedReport && (
              <div className="space-y-4">
                <div className="p-3 bg-muted/50 rounded-xl">
                  <p className="text-sm"><strong>Type:</strong> {admin.selectedReport.report_type}</p>
                  {admin.selectedReport.description && <p className="text-sm mt-1 text-muted-foreground">{admin.selectedReport.description}</p>}
                </div>
                <Textarea placeholder="Admin notes..." value={admin.adminNotes} onChange={(e) => admin.setAdminNotes(e.target.value)} className="rounded-xl" />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 rounded-xl" onClick={() => admin.updateReportStatus(admin.selectedReport!, 'dismissed')}>Dismiss</Button>
                  <Button className="flex-1 rounded-xl" onClick={() => admin.updateReportStatus(admin.selectedReport!, 'resolved')}>Resolve</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!admin.selectedUserForWarning} onOpenChange={() => admin.setSelectedUserForWarning(null)}>
          <DialogContent className="rounded-2xl">
            <DialogHeader><DialogTitle>Issue Warning</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Textarea placeholder="Warning reason..." value={admin.warningReason} onChange={(e) => admin.setWarningReason(e.target.value)} className="rounded-xl" />
              <Select value={admin.warningSeverity} onValueChange={(v) => admin.setWarningSeverity(v as any)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="final_warning">Final Warning</SelectItem>
                </SelectContent>
              </Select>
              <Button className="w-full rounded-xl" onClick={() => admin.selectedUserForWarning && admin.issueWarning(admin.selectedUserForWarning)} disabled={!admin.warningReason}>
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
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
        <ShieldCheck size={20} className="text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
