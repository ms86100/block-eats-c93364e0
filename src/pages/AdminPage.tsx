import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Profile, SellerProfile, Review, PaymentRecord, ChatMessage, VerificationStatus, PaymentStatus, Society } from '@/types/database';
import { useStatusLabels } from '@/hooks/useStatusLabels';
import { Check, X, Users, Store, Package, Star, MessageSquare, Award, Eye, EyeOff, CreditCard, DollarSign, Flag, AlertTriangle, Settings, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { ApiKeySettings } from '@/components/admin/ApiKeySettings';
import { AppNavigator } from '@/components/admin/AppNavigator';
import { CategoryManager } from '@/components/admin/CategoryManager';
import { SubcategoryManager } from '@/components/admin/SubcategoryManager';
import { SellerApplicationReview } from '@/components/admin/SellerApplicationReview';
import { AdminDisputesTab } from '@/components/admin/AdminDisputesTab';
import { EmergencyBroadcastSheet } from '@/components/admin/EmergencyBroadcastSheet';
import { logAudit } from '@/lib/audit';
import { SocietySwitcher } from '@/components/admin/SocietySwitcher';
import { FeatureManagement } from '@/components/admin/FeatureManagement';
import { AdminProductApprovals } from '@/components/admin/AdminProductApprovals';
import { PlatformSettingsManager } from '@/components/admin/PlatformSettingsManager';
import { AdminAttributeBlockManager } from '@/components/admin/AdminAttributeBlockManager';
interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  reported_seller_id: string | null;
  report_type: string;
  description: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  reporter?: { name: string };
  reported_user?: { name: string } | null;
  reported_seller?: { business_name: string } | null;
}

interface Warning {
  id: string;
  user_id: string;
  issued_by: string;
  reason: string;
  severity: string;
  acknowledged_at: string | null;
  created_at: string;
  user?: { name: string };
}

export default function AdminPage() {
  const location = useLocation();
  const { getPaymentStatus } = useStatusLabels();
  const tabParam = useMemo(() => new URLSearchParams(location.search).get('tab'), [location.search]);
  const [activeTab, setActiveTab] = useState(tabParam || 'sellers');
  const [pendingUsers, setPendingUsers] = useState<Profile[]>([]);
  const [pendingSellers, setPendingSellers] = useState<SellerProfile[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [allSellers, setAllSellers] = useState<SellerProfile[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [allSocieties, setAllSocieties] = useState<Society[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ users: 0, sellers: 0, orders: 0, reviews: 0, revenue: 0, pendingReports: 0, societies: 0 });
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [selectedUserForWarning, setSelectedUserForWarning] = useState<string | null>(null);
  const [warningReason, setWarningReason] = useState('');
  const [warningSeverity, setWarningSeverity] = useState<'warning' | 'final_warning'>('warning');
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [hideReason, setHideReason] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, sellersRes, reviewsRes, allSellersRes, paymentsRes, reportsRes, warningsRes, societiesRes, statsRes] = await Promise.all([
        supabase.from('profiles').select('*, society:societies!profiles_society_id_fkey(name)').eq('verification_status', 'pending'),
        supabase.from('seller_profiles').select('*, profile:profiles!seller_profiles_user_id_fkey(name, block, flat_number)').eq('verification_status', 'pending'),
        supabase.from('reviews').select('*, buyer:profiles!reviews_buyer_id_fkey(name), seller:seller_profiles(business_name)').order('created_at', { ascending: false }).limit(50),
        supabase.from('seller_profiles').select('*, profile:profiles!seller_profiles_user_id_fkey(name, block)').eq('verification_status', 'approved'),
        supabase.from('payment_records').select('*, seller:seller_profiles(business_name), order:orders(buyer:profiles!orders_buyer_id_fkey(name))').order('created_at', { ascending: false }).limit(100),
        supabase.from('reports').select('*, reporter:profiles!reports_reporter_id_fkey(name), reported_seller:seller_profiles(business_name)').order('created_at', { ascending: false }).limit(50),
        supabase.from('warnings').select('*, user:profiles!warnings_user_id_fkey(name)').order('created_at', { ascending: false }).limit(50),
        supabase.from('societies').select('*').order('created_at', { ascending: false }),
        Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('seller_profiles').select('id', { count: 'exact', head: true }).eq('verification_status', 'approved'),
          supabase.from('orders').select('id', { count: 'exact', head: true }),
          supabase.from('reviews').select('id', { count: 'exact', head: true }),
          supabase.from('payment_records').select('amount').eq('payment_status', 'paid'),
          supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('societies').select('id', { count: 'exact', head: true }),
        ]),
      ]);

      setPendingUsers((usersRes.data as any) || []);
      setPendingSellers((sellersRes.data as any) || []);
      setReviews((reviewsRes.data as any) || []);
      setAllSellers((allSellersRes.data as any) || []);
      setPayments((paymentsRes.data as any) || []);
      setReports((reportsRes.data as any) || []);
      setWarnings((warningsRes.data as any) || []);
      setAllSocieties((societiesRes.data as Society[]) || []);
      
      const totalRevenue = (statsRes[4].data || []).reduce((sum: number, p: any) => sum + Number(p.amount), 0);
      
      setStats({
        users: statsRes[0].count || 0,
        sellers: statsRes[1].count || 0,
        orders: statsRes[2].count || 0,
        reviews: statsRes[3].count || 0,
        revenue: totalRevenue,
        pendingReports: statsRes[5].count || 0,
        societies: statsRes[6].count || 0,
      });
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchChatForOrder = async (orderId: string) => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*, sender:profiles!chat_messages_sender_id_fkey(name)')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });
    
    setChatMessages(data || []);
    setSelectedChat(orderId);
  };

  const updateUserStatus = async (id: string, status: VerificationStatus) => {
    try {
      await supabase.from('profiles').update({ verification_status: status }).eq('id', id);
      await logAudit(`user_${status}`, 'profile', id, '', { status });
      toast.success(`User ${status}`);
      fetchData();
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  const updateSellerStatus = async (id: string, status: VerificationStatus) => {
    try {
      // First get the seller's user_id
      const { data: seller } = await supabase
        .from('seller_profiles')
        .select('user_id')
        .eq('id', id)
        .single();

      if (!seller) throw new Error('Seller not found');

      // Update seller status
      await supabase.from('seller_profiles').update({ verification_status: status }).eq('id', id);
      await logAudit(`seller_${status}`, 'seller_profile', id, '', { status });

      if (status === 'approved') {
        // Grant seller role when approved
        await supabase.from('user_roles').insert({
          user_id: seller.user_id,
          role: 'seller',
        });

        // Auto-approve all pending products for this seller
        await supabase
          .from('products')
          .update({ approval_status: 'approved' } as any)
          .eq('seller_id', id)
          .eq('approval_status', 'pending');

        // Send congratulations notification to seller
        await supabase.from('user_notifications').insert({
          user_id: seller.user_id,
          title: '🎉 Congratulations! Your store is approved!',
          body: 'Your store has been approved and is now live. You can start adding products to your store and begin selling to your neighbors!',
          type: 'seller_approved',
          is_read: false,
        });
      } else if (status === 'rejected' || status === 'suspended') {
        // Remove seller role when rejected or suspended
        await supabase.from('user_roles').delete()
          .eq('user_id', seller.user_id)
          .eq('role', 'seller');
      }

      toast.success(`Seller ${status}`);
      fetchData();
    } catch (error) {
      console.error('Error updating seller status:', error);
      toast.error('Failed to update');
    }
  };

  const toggleSellerFeatured = async (seller: SellerProfile) => {
    try {
      await supabase.from('seller_profiles').update({ is_featured: !seller.is_featured }).eq('id', seller.id);
      toast.success(seller.is_featured ? 'Removed from featured' : 'Added to featured');
      fetchData();
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  const toggleReviewHidden = async (review: Review, hide: boolean) => {
    try {
      await supabase.from('reviews').update({ 
        is_hidden: hide, 
        hidden_reason: hide ? hideReason : null 
      }).eq('id', review.id);
      await logAudit(hide ? 'review_hidden' : 'review_restored', 'review', review.id, '', { reason: hideReason });
      toast.success(hide ? 'Review hidden' : 'Review restored');
      setSelectedReview(null);
      setHideReason('');
      fetchData();
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  const updateReportStatus = async (report: Report, status: string) => {
    try {
      await supabase.from('reports').update({ 
        status, 
        admin_notes: adminNotes || null 
      }).eq('id', report.id);
      await logAudit(`report_${status}`, 'report', report.id, '', { admin_notes: adminNotes });
      toast.success(`Report ${status}`);
      setSelectedReport(null);
      setAdminNotes('');
      fetchData();
    } catch (error) {
      toast.error('Failed to update report');
    }
  };

  const issueWarning = async (userId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      await supabase.from('warnings').insert({
        user_id: userId,
        issued_by: user.id,
        reason: warningReason,
        severity: warningSeverity,
      });
      await logAudit('warning_issued', 'profile', userId, '', { reason: warningReason, severity: warningSeverity });
      
      toast.success('Warning issued');
      setSelectedUserForWarning(null);
      setWarningReason('');
      setWarningSeverity('warning');
      fetchData();
    } catch (error) {
      toast.error('Failed to issue warning');
    }
  };

  const updateSocietyStatus = async (id: string, is_verified: boolean, is_active: boolean) => {
    try {
      await supabase.from('societies').update({ is_verified, is_active }).eq('id', id);
      await logAudit('society_status_changed', 'society', id, '', { is_verified, is_active });
      toast.success(is_verified ? 'Society approved' : 'Society updated');
      fetchData();
    } catch (error) {
      toast.error('Failed to update society');
    }
  };

  const filteredPayments = paymentFilter === 'all'
    ? payments 
    : payments.filter(p => p.payment_status === paymentFilter || p.payment_method === paymentFilter);

  if (isLoading) {
    return (
      <AppLayout headerTitle="Admin Panel" showLocation={false}>
        <div className="p-4 space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout headerTitle="Admin Panel" showLocation={false}>
      <div className="p-4 space-y-4">
        {/* Society Switcher */}
        <SocietySwitcher />

        {/* Emergency Broadcast */}
        <EmergencyBroadcastSheet />

        {/* Stats */}
        <div className="grid grid-cols-7 gap-2">
          <Card><CardContent className="p-2 text-center"><Users className="mx-auto text-primary" size={14} /><p className="text-sm font-bold">{stats.users}</p><p className="text-[8px] text-muted-foreground">Users</p></CardContent></Card>
          <Card><CardContent className="p-2 text-center"><Store className="mx-auto text-success" size={14} /><p className="text-sm font-bold">{stats.sellers}</p><p className="text-[8px] text-muted-foreground">Sellers</p></CardContent></Card>
          <Card><CardContent className="p-2 text-center"><Building2 className="mx-auto text-info" size={14} /><p className="text-sm font-bold">{stats.societies}</p><p className="text-[8px] text-muted-foreground">Societies</p></CardContent></Card>
          <Card><CardContent className="p-2 text-center"><Package className="mx-auto text-warning" size={14} /><p className="text-sm font-bold">{stats.orders}</p><p className="text-[8px] text-muted-foreground">Orders</p></CardContent></Card>
          <Card><CardContent className="p-2 text-center"><Star className="mx-auto text-info" size={14} /><p className="text-sm font-bold">{stats.reviews}</p><p className="text-[8px] text-muted-foreground">Reviews</p></CardContent></Card>
          <Card><CardContent className="p-2 text-center"><DollarSign className="mx-auto text-success" size={14} /><p className="text-sm font-bold">₹{stats.revenue}</p><p className="text-[8px] text-muted-foreground">Revenue</p></CardContent></Card>
          <Card><CardContent className="p-2 text-center"><Flag className="mx-auto text-destructive" size={14} /><p className="text-sm font-bold">{stats.pendingReports}</p><p className="text-[8px] text-muted-foreground">Reports</p></CardContent></Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-6">
            <TabsTrigger value="sellers" className="text-[10px]">Sellers</TabsTrigger>
            <TabsTrigger value="products" className="text-[10px]">Products</TabsTrigger>
            <TabsTrigger value="users" className="text-[10px]">Users</TabsTrigger>
            <TabsTrigger value="societies" className="text-[10px]">Societies</TabsTrigger>
            <TabsTrigger value="disputes" className="text-[10px]">Disputes</TabsTrigger>
            <TabsTrigger value="categories" className="text-[10px]">Categories</TabsTrigger>
          </TabsList>
          <TabsList className="w-full grid grid-cols-8 mt-1">
            <TabsTrigger value="reports" className="text-[10px]">Reports</TabsTrigger>
            <TabsTrigger value="payments" className="text-[10px]">Payments</TabsTrigger>
            <TabsTrigger value="reviews" className="text-[10px]">Reviews</TabsTrigger>
            <TabsTrigger value="featured" className="text-[10px]">Featured</TabsTrigger>
            <TabsTrigger value="features" className="text-[10px]">Features</TabsTrigger>
            <TabsTrigger value="attributes" className="text-[10px]">Attributes</TabsTrigger>
            <TabsTrigger value="settings" className="text-[10px]">Settings</TabsTrigger>
            <TabsTrigger value="navigator" className="text-[10px]">Navigate</TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="mt-4">
            <AdminProductApprovals />
          </TabsContent>

          <TabsContent value="users" className="space-y-2 mt-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Pending Users ({pendingUsers.length})</h3>
            {pendingUsers.length > 0 ? pendingUsers.map((user) => (
              <Card key={user.id}><CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{(user as any).email && `${(user as any).email} • `}{user.phone}</p>
                  <p className="text-xs text-muted-foreground">{user.phase && `${user.phase}, `}Block {user.block}, Flat {user.flat_number}</p>
                  {(user as any).society?.name && <p className="text-xs text-primary font-medium">{(user as any).society.name}</p>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="text-destructive h-8 w-8 p-0" onClick={() => updateUserStatus(user.id, 'rejected')}><X size={14} /></Button>
                  <Button size="sm" className="h-8 w-8 p-0" onClick={() => updateUserStatus(user.id, 'approved')}><Check size={14} /></Button>
                </div>
              </CardContent></Card>
            )) : <p className="text-center text-muted-foreground py-8 text-sm">No pending users</p>}
          </TabsContent>

          <TabsContent value="sellers" className="mt-4">
            <SellerApplicationReview />
          </TabsContent>

          <TabsContent value="disputes" className="mt-4">
            <AdminDisputesTab />
          </TabsContent>

          <TabsContent value="payments" className="space-y-2 mt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Payment Records</h3>
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger className="w-28 h-8 text-xs">
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
            {filteredPayments.length > 0 ? filteredPayments.map((payment) => {
              const statusInfo = getPaymentStatus(payment.payment_status as PaymentStatus);
              return (
                <Card key={payment.id}><CardContent className="p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">{(payment as any).seller?.business_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(payment as any).order?.buyer?.name} • {format(new Date(payment.created_at), 'MMM d, h:mm a')}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Order #{payment.order_id.slice(0, 8)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">₹{payment.amount}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                      <p className="text-[10px] text-muted-foreground mt-1">{payment.payment_method.toUpperCase()}</p>
                    </div>
                  </div>
                </CardContent></Card>
              );
            }) : <p className="text-center text-muted-foreground py-8 text-sm">No payments found</p>}
          </TabsContent>

          <TabsContent value="societies" className="space-y-2 mt-4">
            <h3 className="text-sm font-semibold text-muted-foreground">
              Societies ({allSocieties.length}) • Pending: {allSocieties.filter(s => !s.is_verified).length}
            </h3>
            {allSocieties.length > 0 ? allSocieties.map((soc) => (
              <Card key={soc.id}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${soc.is_verified ? 'bg-success' : 'bg-warning'}`} />
                      <div>
                        <p className="font-medium text-sm">{soc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {[soc.city, soc.state, soc.pincode].filter(Boolean).join(', ')}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Members: {soc.member_count} • {soc.is_verified ? 'Verified' : 'Pending'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!soc.is_verified && (
                        <>
                          <Button size="sm" variant="outline" className="text-destructive h-8 w-8 p-0" onClick={() => updateSocietyStatus(soc.id, false, false)}>
                            <X size={14} />
                          </Button>
                          <Button size="sm" className="h-8 w-8 p-0" onClick={() => updateSocietyStatus(soc.id, true, true)}>
                            <Check size={14} />
                          </Button>
                        </>
                      )}
                      {soc.is_verified && (
                        <Switch
                          checked={soc.is_active}
                          onCheckedChange={(active) => updateSocietyStatus(soc.id, true, active)}
                        />
                      )}
                    </div>
                  </div>
                  {/* Invite Code Management */}
                  {soc.is_verified && (
                    <div className="mt-2 pt-2 border-t flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">Invite Code:</span>
                      {soc.invite_code ? (
                        <div className="flex items-center gap-1">
                          <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{soc.invite_code}</code>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px] px-2"
                            onClick={async () => {
                              await supabase.from('societies').update({ invite_code: null }).eq('id', soc.id);
                              fetchData();
                              toast.success('Invite code removed');
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] px-2"
                          onClick={async () => {
                            const code = Math.random().toString(36).substring(2, 8).toUpperCase();
                            await supabase.from('societies').update({ invite_code: code }).eq('id', soc.id);
                            fetchData();
                            toast.success(`Invite code generated: ${code}`);
                          }}
                        >
                          Generate Code
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )) : <p className="text-center text-muted-foreground py-8 text-sm">No societies yet</p>}
          </TabsContent>

          <TabsContent value="reports" className="space-y-2 mt-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Abuse Reports</h3>
            {reports.length > 0 ? reports.map((report) => {
              const statusColors: Record<string, string> = {
                pending: 'bg-warning/20 text-warning',
                reviewed: 'bg-info/20 text-info',
                resolved: 'bg-success/20 text-success',
                dismissed: 'bg-muted text-muted-foreground',
              };
              return (
                <Card key={report.id}><CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Flag size={12} className="text-destructive" />
                        <span className="text-xs font-medium capitalize">{report.report_type}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusColors[report.status]}`}>
                          {report.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Reported by: <span className="font-medium">{report.reporter?.name || 'Unknown'}</span>
                      </p>
                      {report.reported_seller && (
                        <p className="text-xs text-muted-foreground">
                          Against seller: <span className="font-medium text-destructive">{report.reported_seller.business_name}</span>
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {format(new Date(report.created_at), 'MMM d, h:mm a')}
                      </p>
                      {report.description && <p className="text-sm mt-1 line-clamp-2">{report.description}</p>}
                    </div>
                    {report.status === 'pending' && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => setSelectedReport(report)}
                      >
                        Review
                      </Button>
                    )}
                  </div>
                </CardContent></Card>
              );
            }) : <p className="text-center text-muted-foreground py-8 text-sm">No reports</p>}
          </TabsContent>

          <TabsContent value="reviews" className="space-y-2 mt-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Review Moderation</h3>
            {reviews.map((review) => (
              <Card key={review.id} className={review.is_hidden ? 'opacity-50' : ''}><CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{(review as any).buyer?.name}</p>
                      <div className="flex">
                        {[1,2,3,4,5].map((s) => (
                          <Star key={s} size={10} className={s <= review.rating ? 'fill-warning text-warning' : 'text-muted-foreground'} />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">for {(review as any).seller?.business_name}</p>
                    {review.comment && <p className="text-sm mt-1 line-clamp-2">{review.comment}</p>}
                    {review.is_hidden && <p className="text-xs text-destructive mt-1">Hidden: {review.hidden_reason}</p>}
                  </div>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-8 w-8 p-0"
                    onClick={() => {
                      if (review.is_hidden) {
                        toggleReviewHidden(review, false);
                      } else {
                        setSelectedReview(review);
                      }
                    }}
                  >
                    {review.is_hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                  </Button>
                </div>
              </CardContent></Card>
            ))}
          </TabsContent>

          <TabsContent value="featured" className="space-y-2 mt-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Manage Featured Sellers</h3>
            {allSellers.map((seller) => (
              <Card key={seller.id}><CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {seller.is_featured && <Award size={14} className="text-warning" />}
                  <div>
                    <p className="font-medium text-sm">{seller.business_name}</p>
                    <p className="text-xs text-muted-foreground">⭐ {seller.rating.toFixed(1)} • {seller.total_reviews} reviews</p>
                  </div>
                </div>
                <Switch checked={seller.is_featured} onCheckedChange={() => toggleSellerFeatured(seller)} />
              </CardContent></Card>
            ))}
          </TabsContent>

          <TabsContent value="features" className="mt-4">
            <FeatureManagement />
          </TabsContent>


          <TabsContent value="attributes" className="mt-4">
            <AdminAttributeBlockManager />
          </TabsContent>

          <TabsContent value="categories" className="space-y-4 mt-4">
            <CategoryManager />
            <SubcategoryManager />
          </TabsContent>

          <TabsContent value="settings" className="space-y-4 mt-4">
            <PlatformSettingsManager />
            <ApiKeySettings />
          </TabsContent>

          <TabsContent value="navigator" className="mt-4">
            <AppNavigator />
          </TabsContent>
        </Tabs>

        {/* Hide Review Dialog */}
        <Dialog open={!!selectedReview} onOpenChange={() => setSelectedReview(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Hide Review</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Reason for hiding:</p>
                <Input
                  placeholder="e.g., Inappropriate content"
                  value={hideReason}
                  onChange={(e) => setHideReason(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setSelectedReview(null)}>Cancel</Button>
                <Button className="flex-1" onClick={() => selectedReview && toggleReviewHidden(selectedReview, true)}>Hide Review</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Report Review Dialog */}
        <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Review Report</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Report Type</p>
                <p className="font-medium capitalize">{selectedReport?.report_type}</p>
                {selectedReport?.description && (
                  <>
                    <p className="text-xs text-muted-foreground mt-2">Description</p>
                    <p className="text-sm">{selectedReport.description}</p>
                  </>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Admin Notes (optional):</p>
                <Textarea
                  placeholder="Add notes about this report..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1" 
                  onClick={() => selectedReport && updateReportStatus(selectedReport, 'dismissed')}
                >
                  Dismiss
                </Button>
                <Button 
                  className="flex-1" 
                  onClick={() => selectedReport && updateReportStatus(selectedReport, 'resolved')}
                >
                  Resolve
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Issue Warning Dialog */}
        <Dialog open={!!selectedUserForWarning} onOpenChange={() => setSelectedUserForWarning(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="text-warning" size={18} />
                Issue Warning
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Warning Severity:</p>
                <Select value={warningSeverity} onValueChange={(v: 'warning' | 'final_warning') => setWarningSeverity(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="final_warning">Final Warning (before suspension)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Reason:</p>
                <Textarea
                  placeholder="Explain why this warning is being issued..."
                  value={warningReason}
                  onChange={(e) => setWarningReason(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setSelectedUserForWarning(null)}>Cancel</Button>
                <Button 
                  className="flex-1" 
                  disabled={!warningReason.trim()}
                  onClick={() => selectedUserForWarning && issueWarning(selectedUserForWarning)}
                >
                  Issue Warning
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Chat View Dialog */}
        <Dialog open={!!selectedChat} onOpenChange={() => setSelectedChat(null)}>
          <DialogContent className="max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Chat History</DialogTitle>
            </DialogHeader>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {chatMessages.map((msg) => (
                  <div key={msg.id} className="bg-muted rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-sm">{msg.sender?.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(msg.created_at), 'h:mm a')}
                      </p>
                    </div>
                    <p className="text-sm">{msg.message_text}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

      </div>
    </AppLayout>
  );
}
