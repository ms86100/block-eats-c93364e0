import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PaymentStatus } from '@/types/database';
import { Check, X, Users, Store, Package, Star, Award, Eye, EyeOff, DollarSign, Flag, Building2 } from 'lucide-react';
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
import { ResetAndSeedButton } from '@/components/admin/ResetAndSeedButton';
import { useAdminData } from '@/hooks/useAdminData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function AdminPage() {
  const admin = useAdminData();

  if (admin.isLoading) {
    return <AppLayout headerTitle="Admin Panel" showLocation={false}><div className="p-4 space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div></AppLayout>;
  }

  return (
    <AppLayout headerTitle="Admin Panel" showLocation={false}>
      <div className="p-4 space-y-4">
        <SocietySwitcher />
        <EmergencyBroadcastSheet />

        {/* Stats */}
        <div className="grid grid-cols-7 gap-2">
          <Card><CardContent className="p-2 text-center"><Users className="mx-auto text-primary" size={14} /><p className="text-sm font-bold">{admin.stats.users}</p><p className="text-[8px] text-muted-foreground">Users</p></CardContent></Card>
          <Card><CardContent className="p-2 text-center"><Store className="mx-auto text-success" size={14} /><p className="text-sm font-bold">{admin.stats.sellers}</p><p className="text-[8px] text-muted-foreground">Sellers</p></CardContent></Card>
          <Card><CardContent className="p-2 text-center"><Building2 className="mx-auto text-info" size={14} /><p className="text-sm font-bold">{admin.stats.societies}</p><p className="text-[8px] text-muted-foreground">Societies</p></CardContent></Card>
          <Card><CardContent className="p-2 text-center"><Package className="mx-auto text-warning" size={14} /><p className="text-sm font-bold">{admin.stats.orders}</p><p className="text-[8px] text-muted-foreground">Orders</p></CardContent></Card>
          <Card><CardContent className="p-2 text-center"><Star className="mx-auto text-info" size={14} /><p className="text-sm font-bold">{admin.stats.reviews}</p><p className="text-[8px] text-muted-foreground">Reviews</p></CardContent></Card>
          <Card><CardContent className="p-2 text-center"><DollarSign className="mx-auto text-success" size={14} /><p className="text-sm font-bold">{admin.formatPrice(admin.stats.revenue)}</p><p className="text-[8px] text-muted-foreground">Revenue</p></CardContent></Card>
          <Card><CardContent className="p-2 text-center"><Flag className="mx-auto text-destructive" size={14} /><p className="text-sm font-bold">{admin.stats.pendingReports}</p><p className="text-[8px] text-muted-foreground">Reports</p></CardContent></Card>
        </div>

        <Tabs value={admin.activeTab} onValueChange={admin.setActiveTab}>
          <TabsList className="w-full grid grid-cols-6"><TabsTrigger value="sellers" className="text-[10px]">Sellers</TabsTrigger><TabsTrigger value="products" className="text-[10px]">Products</TabsTrigger><TabsTrigger value="users" className="text-[10px]">Users</TabsTrigger><TabsTrigger value="societies" className="text-[10px]">Societies</TabsTrigger><TabsTrigger value="disputes" className="text-[10px]">Disputes</TabsTrigger><TabsTrigger value="catalog" className="text-[10px]">Catalog</TabsTrigger></TabsList>
          <TabsList className="w-full grid grid-cols-7 mt-1"><TabsTrigger value="reports" className="text-[10px]">Reports</TabsTrigger><TabsTrigger value="payments" className="text-[10px]">Payments</TabsTrigger><TabsTrigger value="reviews" className="text-[10px]">Reviews</TabsTrigger><TabsTrigger value="featured" className="text-[10px]">Featured</TabsTrigger><TabsTrigger value="features" className="text-[10px]">Features</TabsTrigger><TabsTrigger value="settings" className="text-[10px]">Settings</TabsTrigger><TabsTrigger value="navigator" className="text-[10px]">Navigate</TabsTrigger></TabsList>

          <TabsContent value="products" className="mt-4"><AdminProductApprovals /></TabsContent>
          <TabsContent value="users" className="space-y-2 mt-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Pending Users ({admin.pendingUsers.length})</h3>
            {admin.pendingUsers.length > 0 ? admin.pendingUsers.map((user) => (
              <Card key={user.id}><CardContent className="p-3 flex items-center justify-between"><div><p className="font-medium text-sm">{user.name}</p><p className="text-xs text-muted-foreground">{(user as any).email && `${(user as any).email} • `}{user.phone}</p><p className="text-xs text-muted-foreground">{user.phase && `${user.phase}, `}Block {user.block}, Flat {user.flat_number}</p>{(user as any).society?.name && <p className="text-xs text-primary font-medium">{(user as any).society.name}</p>}</div><div className="flex gap-2"><Button size="sm" variant="outline" className="text-destructive h-8 w-8 p-0" onClick={() => admin.updateUserStatus(user.id, 'rejected')}><X size={14} /></Button><Button size="sm" className="h-8 w-8 p-0" onClick={() => admin.updateUserStatus(user.id, 'approved')}><Check size={14} /></Button></div></CardContent></Card>
            )) : <p className="text-center text-muted-foreground py-8 text-sm">No pending users</p>}
          </TabsContent>
          <TabsContent value="sellers" className="mt-4"><SellerApplicationReview /></TabsContent>
          <TabsContent value="disputes" className="mt-4"><AdminDisputesTab /></TabsContent>

          <TabsContent value="payments" className="space-y-2 mt-4">
            <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold text-muted-foreground">Payment Records</h3><Select value={admin.paymentFilter} onValueChange={admin.setPaymentFilter}><SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="failed">Failed</SelectItem><SelectItem value="upi">UPI</SelectItem><SelectItem value="cod">COD</SelectItem></SelectContent></Select></div>
            {admin.payments.length > 0 ? admin.payments.map((payment) => { const statusInfo = admin.getPaymentStatus(payment.payment_status as PaymentStatus); return (
              <Card key={payment.id}><CardContent className="p-3"><div className="flex items-start justify-between"><div><p className="font-medium text-sm">{(payment as any).seller?.business_name}</p><p className="text-xs text-muted-foreground">{(payment as any).order?.buyer?.name} • {format(new Date(payment.created_at), 'MMM d, h:mm a')}</p></div><div className="text-right"><p className="font-semibold">{admin.formatPrice(payment.amount)}</p><span className={`text-[10px] px-2 py-0.5 rounded-full ${statusInfo.color}`}>{statusInfo.label}</span></div></div></CardContent></Card>
            ); }) : <p className="text-center text-muted-foreground py-8 text-sm">No payments found</p>}
            {admin.hasMorePayments && <Button variant="outline" size="sm" className="w-full" onClick={admin.loadMorePayments} disabled={admin.isLoadingMore}>{admin.isLoadingMore ? 'Loading…' : 'Load More Payments'}</Button>}
          </TabsContent>

          <TabsContent value="societies" className="space-y-2 mt-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Societies ({admin.allSocieties.length}) • Pending: {admin.allSocieties.filter(s => !s.is_verified).length}</h3>
            {admin.allSocieties.map((soc) => (
              <Card key={soc.id}><CardContent className="p-3"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className={`w-2 h-2 rounded-full ${soc.is_verified ? 'bg-success' : 'bg-warning'}`} /><div><p className="font-medium text-sm">{soc.name}</p><p className="text-xs text-muted-foreground">{[soc.city, soc.state, soc.pincode].filter(Boolean).join(', ')}</p><p className="text-[10px] text-muted-foreground">Members: {soc.member_count} • {soc.is_verified ? 'Verified' : 'Pending'}</p></div></div><div className="flex gap-2">{!soc.is_verified && <><Button size="sm" variant="outline" className="text-destructive h-8 w-8 p-0" onClick={() => admin.updateSocietyStatus(soc.id, false, false)}><X size={14} /></Button><Button size="sm" className="h-8 w-8 p-0" onClick={() => admin.updateSocietyStatus(soc.id, true, true)}><Check size={14} /></Button></>}{soc.is_verified && <Switch checked={soc.is_active} onCheckedChange={(active) => admin.updateSocietyStatus(soc.id, true, active)} />}</div></div>
                {soc.is_verified && <div className="mt-2 pt-2 border-t flex items-center gap-2"><span className="text-[10px] text-muted-foreground">Invite Code:</span>{soc.invite_code ? <div className="flex items-center gap-1"><code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{soc.invite_code}</code><Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={async () => { await supabase.from('societies').update({ invite_code: null }).eq('id', soc.id); admin.fetchData(); toast.success('Invite code removed'); }}>Remove</Button></div> : <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={async () => { const code = Math.random().toString(36).substring(2, 8).toUpperCase(); await supabase.from('societies').update({ invite_code: code }).eq('id', soc.id); admin.fetchData(); toast.success(`Invite code generated: ${code}`); }}>Generate Code</Button>}</div>}
              </CardContent></Card>
            ))}
          </TabsContent>

          <TabsContent value="reports" className="space-y-2 mt-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Abuse Reports</h3>
            {admin.reports.length > 0 ? admin.reports.map((report) => {
              const statusColors: Record<string, string> = { pending: 'bg-warning/20 text-warning', reviewed: 'bg-info/20 text-info', resolved: 'bg-success/20 text-success', dismissed: 'bg-muted text-muted-foreground' };
              return <Card key={report.id}><CardContent className="p-3"><div className="flex items-start justify-between gap-2"><div className="flex-1 min-w-0"><div className="flex items-center gap-2"><Flag size={12} className="text-destructive" /><span className="text-xs font-medium capitalize">{report.report_type}</span><span className={`text-[10px] px-2 py-0.5 rounded-full ${statusColors[report.status]}`}>{report.status}</span></div><p className="text-xs text-muted-foreground mt-1">Reported by: <span className="font-medium">{report.reporter?.name || 'Unknown'}</span></p>{report.reported_seller && <p className="text-xs text-muted-foreground">Against: <span className="font-medium text-destructive">{report.reported_seller.business_name}</span></p>}<p className="text-[10px] text-muted-foreground mt-1">{format(new Date(report.created_at), 'MMM d, h:mm a')}</p>{report.description && <p className="text-sm mt-1 line-clamp-2">{report.description}</p>}</div>{report.status === 'pending' && <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => admin.setSelectedReport(report)}>Review</Button>}</div></CardContent></Card>;
            }) : <p className="text-center text-muted-foreground py-8 text-sm">No reports</p>}
            {admin.hasMoreReports && <Button variant="outline" size="sm" className="w-full" onClick={admin.loadMoreReports} disabled={admin.isLoadingMore}>{admin.isLoadingMore ? 'Loading…' : 'Load More Reports'}</Button>}
          </TabsContent>

          <TabsContent value="reviews" className="space-y-2 mt-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Review Moderation</h3>
            {admin.reviews.map((review) => (
              <Card key={review.id} className={review.is_hidden ? 'opacity-50' : ''}><CardContent className="p-3"><div className="flex items-start justify-between gap-2"><div className="flex-1 min-w-0"><div className="flex items-center gap-2"><p className="font-medium text-sm truncate">{(review as any).buyer?.name}</p><div className="flex">{[1,2,3,4,5].map((s) => <Star key={s} size={10} className={s <= review.rating ? 'fill-warning text-warning' : 'text-muted-foreground'} />)}</div></div><p className="text-xs text-muted-foreground">for {(review as any).seller?.business_name}</p>{review.comment && <p className="text-sm mt-1 line-clamp-2">{review.comment}</p>}{review.is_hidden && <p className="text-xs text-destructive mt-1">Hidden: {review.hidden_reason}</p>}</div><Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => review.is_hidden ? admin.toggleReviewHidden(review, false) : admin.setSelectedReview(review)}>{review.is_hidden ? <Eye size={14} /> : <EyeOff size={14} />}</Button></div></CardContent></Card>
            ))}
            {admin.hasMoreReviews && <Button variant="outline" size="sm" className="w-full" onClick={admin.loadMoreReviews} disabled={admin.isLoadingMore}>{admin.isLoadingMore ? 'Loading…' : 'Load More Reviews'}</Button>}
          </TabsContent>

          <TabsContent value="featured" className="space-y-2 mt-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Manage Featured Sellers</h3>
            {admin.allSellers.map((seller) => <Card key={seller.id}><CardContent className="p-3 flex items-center justify-between"><div className="flex items-center gap-2">{seller.is_featured && <Award size={14} className="text-warning" />}<div><p className="font-medium text-sm">{seller.business_name}</p><p className="text-xs text-muted-foreground">⭐ {seller.rating.toFixed(1)} • {seller.total_reviews} reviews</p></div></div><Switch checked={seller.is_featured} onCheckedChange={() => admin.toggleSellerFeatured(seller)} /></CardContent></Card>)}
          </TabsContent>

          <TabsContent value="features" className="mt-4"><FeatureManagement /></TabsContent>
          <TabsContent value="catalog" className="mt-4"><AdminCatalogManager /></TabsContent>
          <TabsContent value="settings" className="space-y-4 mt-4"><PlatformSettingsManager /><ApiKeySettings /><ResetAndSeedButton /></TabsContent>
          <TabsContent value="navigator" className="mt-4"><AppNavigator /></TabsContent>
        </Tabs>

        {/* Hide Review Dialog */}
        <Dialog open={!!admin.selectedReview} onOpenChange={() => admin.setSelectedReview(null)}>
          <DialogContent><DialogHeader><DialogTitle>Hide Review</DialogTitle></DialogHeader><div className="space-y-4"><div><p className="text-sm text-muted-foreground mb-2">Reason for hiding:</p><Input placeholder="e.g., Inappropriate content" value={admin.hideReason} onChange={(e) => admin.setHideReason(e.target.value)} /></div><div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => admin.setSelectedReview(null)}>Cancel</Button><Button className="flex-1" onClick={() => admin.selectedReview && admin.toggleReviewHidden(admin.selectedReview, true)}>Hide Review</Button></div></div></DialogContent>
        </Dialog>

        {/* Review Report Dialog */}
        <Dialog open={!!admin.selectedReport} onOpenChange={() => admin.setSelectedReport(null)}>
          <DialogContent><DialogHeader><DialogTitle>Review Report</DialogTitle></DialogHeader>{admin.selectedReport && <div className="space-y-4"><p className="text-sm"><strong>Type:</strong> {admin.selectedReport.report_type}</p>{admin.selectedReport.description && <p className="text-sm">{admin.selectedReport.description}</p>}<Textarea placeholder="Admin notes..." value={admin.adminNotes} onChange={(e) => admin.setAdminNotes(e.target.value)} /><div className="flex gap-2"><Button variant="outline" onClick={() => admin.updateReportStatus(admin.selectedReport!, 'dismissed')}>Dismiss</Button><Button onClick={() => admin.updateReportStatus(admin.selectedReport!, 'resolved')}>Resolve</Button></div></div>}</DialogContent>
        </Dialog>

        {/* Issue Warning Dialog */}
        <Dialog open={!!admin.selectedUserForWarning} onOpenChange={() => admin.setSelectedUserForWarning(null)}>
          <DialogContent><DialogHeader><DialogTitle>Issue Warning</DialogTitle></DialogHeader><div className="space-y-4"><Textarea placeholder="Warning reason..." value={admin.warningReason} onChange={(e) => admin.setWarningReason(e.target.value)} /><Select value={admin.warningSeverity} onValueChange={(v) => admin.setWarningSeverity(v as any)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="warning">Warning</SelectItem><SelectItem value="final_warning">Final Warning</SelectItem></SelectContent></Select><Button onClick={() => admin.selectedUserForWarning && admin.issueWarning(admin.selectedUserForWarning)} disabled={!admin.warningReason}>Issue Warning</Button></div></DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
