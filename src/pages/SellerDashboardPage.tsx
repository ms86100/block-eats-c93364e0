import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { SellerProfile } from '@/types/database';
import { Package, Loader2, Eye, Star, Clock, CheckCircle, XCircle, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { friendlyError } from '@/lib/utils';
import { logAudit } from '@/lib/audit';
import { useSystemSettings } from '@/hooks/useSystemSettings';

// Import refactored components
import { StoreStatusCard } from '@/components/seller/StoreStatusCard';
import { SellerVisibilityChecklist } from '@/components/seller/SellerVisibilityChecklist';
import { EarningsSummary } from '@/components/seller/EarningsSummary';
import { DashboardStats } from '@/components/seller/DashboardStats';
import { QuickActions } from '@/components/seller/QuickActions';
import { OrderFilters, OrderFilter } from '@/components/seller/OrderFilters';
import { SellerOrderCard } from '@/components/seller/SellerOrderCard';
import { CouponManager } from '@/components/seller/CouponManager';
import { SellerAnalytics } from '@/components/seller/SellerAnalytics';
import { useSellerOrderStats, useSellerOrdersInfinite, useSellerOrderFilterCounts } from '@/hooks/queries/useSellerOrders';

export default function SellerDashboardPage() {
  const { user, sellerProfiles, currentSellerId } = useAuth();
  const settings = useSystemSettings();
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('all');

  const activeSellerId = currentSellerId || (sellerProfiles.length > 0 ? sellerProfiles[0].id : null);

  // Fetch seller profile
  useEffect(() => {
    if (user && activeSellerId) {
      fetchSellerProfile(activeSellerId);
    } else {
      setIsLoadingProfile(false);
    }
  }, [user, activeSellerId]);

  const fetchSellerProfile = async (sellerId: string) => {
    setIsLoadingProfile(true);
    try {
      const { data: profile } = await supabase
        .from('seller_profiles')
        .select('*')
        .eq('id', sellerId)
        .single();

      setSellerProfile(profile ? (profile as SellerProfile) : null);
    } catch (error) {
      console.error('Error fetching seller profile:', error);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  // Use React Query for stats and orders
  const { data: stats } = useSellerOrderStats(activeSellerId);
  const { data: filterCounts } = useSellerOrderFilterCounts(activeSellerId);
  const {
    data: ordersPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useSellerOrdersInfinite(activeSellerId, orderFilter);

  const allOrders = ordersPages?.pages.flat() || [];

  const toggleAvailability = async () => {
    if (!sellerProfile) return;

    try {
      const { error } = await supabase
        .from('seller_profiles')
        .update({ is_available: !sellerProfile.is_available })
        .eq('id', sellerProfile.id);

      if (error) throw error;

      setSellerProfile({
        ...sellerProfile,
        is_available: !sellerProfile.is_available,
      });

      toast.success(
        sellerProfile.is_available ? 'Store is now closed' : 'Store is now open'
      );

      if (sellerProfile.society_id) {
        logAudit(
          sellerProfile.is_available ? 'store_closed' : 'store_opened',
          'seller_profile',
          sellerProfile.id,
          sellerProfile.society_id
        );
      }
    } catch (error) {
      console.error('Error toggling availability:', error);
      toast.error(friendlyError(error));
    }
  };

  if (isLoadingProfile) {
    return (
      <AppLayout headerTitle="Seller Dashboard" showLocation={false}>
        <div className="p-4 space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  if (!sellerProfile) {
    return (
      <AppLayout headerTitle="Seller Dashboard" showLocation={false}>
        <div className="p-4 text-center py-12">
          <p className="text-muted-foreground mb-2">
            You haven't set up your seller profile yet
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            {settings.sellerEmptyStateCopy}
          </p>
          <Link to="/become-seller">
            <Button>Become a Seller</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout headerTitle="Seller Dashboard" showLocation={false}>
      <div className="p-4 space-y-5">
        {/* ── Store Overview ── */}
        <StoreStatusCard
          sellerProfile={sellerProfile}
          sellerProfiles={sellerProfiles}
          onToggleAvailability={toggleAvailability}
        />

        <SellerVisibilityChecklist sellerId={sellerProfile.id} />

        {/* ── Performance & Earnings ── */}
        <div className="space-y-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Performance</p>
          
          {/* Store Performance Card */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">How buyers see your store</h3>
                <Link to={`/seller/${sellerProfile.id}`}>
                  <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">
                    <Eye size={14} />
                    Preview
                  </Button>
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                  <Star size={16} className="text-warning" />
                  <div>
                    <p className="text-sm font-semibold">{Number(sellerProfile.rating || 0).toFixed(1)} ★</p>
                    <p className="text-[10px] text-muted-foreground">{sellerProfile.total_reviews || 0} reviews</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                  <Clock size={16} className="text-primary" />
                  <div>
                    <p className="text-sm font-semibold">{sellerProfile.avg_response_minutes != null ? `~${sellerProfile.avg_response_minutes} min` : 'N/A'}</p>
                    <p className="text-[10px] text-muted-foreground">Avg response</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                  <CheckCircle size={16} className="text-success" />
                  <div>
                    <p className="text-sm font-semibold">{sellerProfile.completed_order_count || 0}</p>
                    <p className="text-[10px] text-muted-foreground">Orders fulfilled</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                  <XCircle size={16} className="text-destructive" />
                  <div>
                    <p className="text-sm font-semibold">{sellerProfile.cancellation_rate != null ? `${sellerProfile.cancellation_rate}%` : '0%'}</p>
                    <p className="text-[10px] text-muted-foreground">Cancellation</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(sellerProfile.completed_order_count || 0) === 0 && (
                  <Badge variant="secondary" className="text-[10px] bg-secondary text-secondary-foreground">New Seller</Badge>
                )}
                {(sellerProfile.cancellation_rate === 0 || sellerProfile.cancellation_rate === null) && (sellerProfile.completed_order_count || 0) > 2 && (
                  <Badge variant="secondary" className="text-[10px] bg-success/10 text-success">
                    <ShieldCheck size={10} className="mr-0.5" />0% Cancellation
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <EarningsSummary
            todayEarnings={stats?.todayEarnings || 0}
            weekEarnings={stats?.weekEarnings || 0}
            totalEarnings={stats?.totalEarnings || 0}
          />

          <DashboardStats
            totalOrders={stats?.totalOrders || 0}
            pendingOrders={stats?.pendingOrders || 0}
            todayOrders={stats?.todayOrders || 0}
            completedOrders={stats?.completedOrders || 0}
          />
        </div>

        {/* ── Tools & Promotions ── */}
        <div className="space-y-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Tools & Promotions</p>
          <QuickActions />
          <CouponManager />
        </div>
        
        {/* ── Analytics ── */}
        <div className="space-y-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Analytics</p>
          <SellerAnalytics sellerId={sellerProfile.id} />
        </div>

        {/* Orders Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Orders</h3>
          </div>

          <div className="mb-4">
            <OrderFilters
              currentFilter={orderFilter}
              onFilterChange={setOrderFilter}
              counts={filterCounts || { all: 0, today: 0, pending: 0, preparing: 0, ready: 0, completed: 0 }}
            />
          </div>

          {allOrders.length > 0 ? (
            <div className="space-y-3">
              {allOrders.map((order: any) => (
                <SellerOrderCard key={order.id} order={order} />
              ))}
              {hasNextPage && (
                <div className="flex justify-center py-2">
                    <Button variant="secondary" size="default" className="w-full" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                     {isFetchingNextPage ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...</> : 'Load More'}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 bg-muted rounded-xl">
              <Package className="mx-auto text-muted-foreground mb-2" size={32} />
              <p className="text-sm text-muted-foreground">
                No {orderFilter !== 'all' ? orderFilter : ''} orders
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {orderFilter === 'all'
                  ? 'Share your store link with neighbors to get your first order'
                  : 'Orders in this status will appear here as buyers place them'}
              </p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
