import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { SellerProfile, Order } from '@/types/database';
import { Package } from 'lucide-react';
import { toast } from 'sonner';
import { startOfDay, startOfWeek, isAfter, parseISO } from 'date-fns';

// Import refactored components
import { StoreStatusCard } from '@/components/seller/StoreStatusCard';
import { EarningsSummary } from '@/components/seller/EarningsSummary';
import { DashboardStats } from '@/components/seller/DashboardStats';
import { QuickActions } from '@/components/seller/QuickActions';
import { OrderFilters, OrderFilter } from '@/components/seller/OrderFilters';
import { SellerOrderCard } from '@/components/seller/SellerOrderCard';
import { CouponManager } from '@/components/seller/CouponManager';

interface OrderItemWithStatus {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  status?: string;
}

interface OrderWithDetails {
  id: string;
  created_at: string;
  total_amount: number;
  status: string;
  payment_status?: string | null;
  payment_type?: string | null;
  buyer_id?: string | null;
  seller_id?: string | null;
  notes?: string | null;
  buyer?: { name: string; block: string; flat_number: string };
  items?: OrderItemWithStatus[];
}

export default function SellerDashboardPage() {
  const { user, sellerProfiles, currentSellerId } = useAuth();
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null);
  const [allOrders, setAllOrders] = useState<OrderWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('all');

  // Fetch data when user or currentSellerId changes
  useEffect(() => {
    if (user && currentSellerId) {
      fetchSellerData(currentSellerId);
    } else if (user && sellerProfiles.length > 0) {
      fetchSellerData(sellerProfiles[0].id);
    } else {
      setIsLoading(false);
    }
  }, [user, currentSellerId, sellerProfiles]);

  const fetchSellerData = async (sellerId: string) => {
    if (!user) return;
    setIsLoading(true);

    try {
      // Fetch specific seller profile by ID
      const { data: profile } = await supabase
        .from('seller_profiles')
        .select('*')
        .eq('id', sellerId)
        .single();

      if (!profile) {
        setIsLoading(false);
        setSellerProfile(null);
        return;
      }

      setSellerProfile(profile as SellerProfile);

      // Fetch all orders with items including item-level status
      const { data: orders } = await supabase
        .from('orders')
        .select(`
          *,
          buyer:profiles!orders_buyer_id_fkey(name, block, flat_number),
          items:order_items(id, product_name, quantity, unit_price, status)
        `)
        .eq('seller_id', profile.id)
        .order('created_at', { ascending: false });

      setAllOrders((orders as OrderWithDetails[]) || []);
    } catch (error) {
      console.error('Error fetching seller data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate stats using useMemo for performance
  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    const weekStart = startOfWeek(new Date());

    const completedOrders = allOrders.filter((o) => o.status === 'completed');
    const todayOrders = allOrders.filter((o) => isAfter(parseISO(o.created_at), today));
    const todayCompletedOrders = completedOrders.filter((o) =>
      isAfter(parseISO(o.created_at), today)
    );
    const weekCompletedOrders = completedOrders.filter((o) =>
      isAfter(parseISO(o.created_at), weekStart)
    );
    const pendingOrders = allOrders.filter(
      (o) => !['completed', 'cancelled'].includes(o.status)
    );
    const preparingOrders = allOrders.filter((o) => o.status === 'preparing');
    const readyOrders = allOrders.filter((o) => o.status === 'ready');

    return {
      totalOrders: allOrders.length,
      pendingOrders: pendingOrders.length,
      totalEarnings: completedOrders.reduce((sum, o) => sum + Number(o.total_amount), 0),
      todayEarnings: todayCompletedOrders.reduce((sum, o) => sum + Number(o.total_amount), 0),
      weekEarnings: weekCompletedOrders.reduce((sum, o) => sum + Number(o.total_amount), 0),
      todayOrders: todayOrders.length,
      completedOrders: completedOrders.length,
      preparingOrders: preparingOrders.length,
      readyOrders: readyOrders.length,
    };
  }, [allOrders]);

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
    } catch (error) {
      console.error('Error toggling availability:', error);
      toast.error('Failed to update availability');
    }
  };

  // Get filtered orders based on selected filter
  const filteredOrders = useMemo(() => {
    const today = startOfDay(new Date());

    switch (orderFilter) {
      case 'today':
        return allOrders.filter((o) => isAfter(parseISO(o.created_at), today));
      case 'pending':
        return allOrders.filter((o) => o.status === 'placed' || o.status === 'accepted');
      case 'preparing':
        return allOrders.filter((o) => o.status === 'preparing');
      case 'ready':
        return allOrders.filter((o) => o.status === 'ready');
      case 'completed':
        return allOrders.filter((o) => o.status === 'completed');
      default:
        return allOrders;
    }
  }, [allOrders, orderFilter]);

  // Filter counts for the filter buttons
  const filterCounts = useMemo(() => {
    const today = startOfDay(new Date());
    return {
      all: allOrders.length,
      today: allOrders.filter((o) => isAfter(parseISO(o.created_at), today)).length,
      pending: allOrders.filter((o) => o.status === 'placed' || o.status === 'accepted').length,
      preparing: allOrders.filter((o) => o.status === 'preparing').length,
      ready: allOrders.filter((o) => o.status === 'ready').length,
      completed: allOrders.filter((o) => o.status === 'completed').length,
    };
  }, [allOrders]);

  if (isLoading) {
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
          <p className="text-muted-foreground mb-4">
            You haven't set up your seller profile yet
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
      <div className="p-4 space-y-4">
        {/* Store Status */}
        <StoreStatusCard
          sellerProfile={sellerProfile}
          sellerProfiles={sellerProfiles}
          onToggleAvailability={toggleAvailability}
        />

        {/* Earnings Summary */}
        <EarningsSummary
          todayEarnings={stats.todayEarnings}
          weekEarnings={stats.weekEarnings}
          totalEarnings={stats.totalEarnings}
        />

        {/* Stats */}
        <DashboardStats
          totalOrders={stats.totalOrders}
          pendingOrders={stats.pendingOrders}
          todayOrders={stats.todayOrders}
          completedOrders={stats.completedOrders}
        />

        {/* Quick Actions */}
        <QuickActions />

        {/* Promotions & Coupons */}
        <CouponManager />

        {/* Orders Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Orders</h3>
          </div>

          {/* Order Filters */}
          <div className="mb-4">
            <OrderFilters
              currentFilter={orderFilter}
              onFilterChange={setOrderFilter}
              counts={filterCounts}
            />
          </div>

          {/* Orders List */}
          {filteredOrders.length > 0 ? (
            <div className="space-y-3">
              {filteredOrders.slice(0, 10).map((order) => (
                <SellerOrderCard key={order.id} order={order} />
              ))}
              {filteredOrders.length > 10 && (
                <Link to="/orders" className="block text-center text-sm text-primary py-2">
                  View all {filteredOrders.length} orders
                </Link>
              )}
            </div>
          ) : (
            <div className="text-center py-8 bg-muted rounded-xl">
              <Package className="mx-auto text-muted-foreground mb-2" size={32} />
              <p className="text-sm text-muted-foreground">
                No {orderFilter !== 'all' ? orderFilter : ''} orders
              </p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
