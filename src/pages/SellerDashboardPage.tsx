import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { SellerProfile, Order, ORDER_STATUS_LABELS } from '@/types/database';
import { Package, Plus, Settings, DollarSign, Clock, ChevronRight, TrendingUp, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfDay, startOfWeek, isAfter, parseISO } from 'date-fns';

export default function SellerDashboardPage() {
  const { user } = useAuth();
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [orderFilter, setOrderFilter] = useState<'all' | 'today' | 'pending' | 'completed'>('all');
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    totalEarnings: 0,
    todayEarnings: 0,
    weekEarnings: 0,
    todayOrders: 0,
  });

  useEffect(() => {
    if (user) {
      fetchSellerData();
    }
  }, [user]);

  const fetchSellerData = async () => {
    if (!user) return;

    try {
      // Fetch seller profile
      const { data: profile } = await supabase
        .from('seller_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!profile) {
        setIsLoading(false);
        return;
      }

      setSellerProfile(profile as SellerProfile);

      // Fetch all orders
      const { data: orders } = await supabase
        .from('orders')
        .select(`
          *,
          buyer:profiles!orders_buyer_id_fkey(name, block, flat_number),
          items:order_items(*)
        `)
        .eq('seller_id', profile.id)
        .order('created_at', { ascending: false });

      const orderList = (orders as any) || [];
      setAllOrders(orderList);

      // Calculate stats
      const today = startOfDay(new Date());
      const weekStart = startOfWeek(new Date());

      const completedOrders = orderList.filter((o: Order) => o.status === 'completed');
      const todayOrders = orderList.filter((o: Order) => 
        isAfter(parseISO(o.created_at), today)
      );
      const todayCompletedOrders = completedOrders.filter((o: Order) =>
        isAfter(parseISO(o.created_at), today)
      );
      const weekCompletedOrders = completedOrders.filter((o: Order) =>
        isAfter(parseISO(o.created_at), weekStart)
      );
      const pendingOrders = orderList.filter(
        (o: Order) => !['completed', 'cancelled'].includes(o.status)
      );

      setStats({
        totalOrders: orderList.length,
        pendingOrders: pendingOrders.length,
        totalEarnings: completedOrders.reduce((sum: number, o: Order) => sum + Number(o.total_amount), 0),
        todayEarnings: todayCompletedOrders.reduce((sum: number, o: Order) => sum + Number(o.total_amount), 0),
        weekEarnings: weekCompletedOrders.reduce((sum: number, o: Order) => sum + Number(o.total_amount), 0),
        todayOrders: todayOrders.length,
      });
    } catch (error) {
      console.error('Error fetching seller data:', error);
    } finally {
      setIsLoading(false);
    }
  };

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

  const getFilteredOrders = () => {
    const today = startOfDay(new Date());
    
    switch (orderFilter) {
      case 'today':
        return allOrders.filter((o) => isAfter(parseISO(o.created_at), today));
      case 'pending':
        return allOrders.filter((o) => !['completed', 'cancelled'].includes(o.status));
      case 'completed':
        return allOrders.filter((o) => o.status === 'completed');
      default:
        return allOrders;
    }
  };

  const filteredOrders = getFilteredOrders();

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

  const isPending = sellerProfile.verification_status === 'pending';

  return (
    <AppLayout headerTitle="Seller Dashboard" showLocation={false}>
      <div className="p-4 space-y-4">
        {/* Store Status */}
        {isPending ? (
          <div className="bg-warning/10 border border-warning/20 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Clock className="text-warning" size={24} />
              <div>
                <h3 className="font-semibold">Verification Pending</h3>
                <p className="text-sm text-muted-foreground">
                  Your seller profile is being reviewed by admin
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-card rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{sellerProfile.business_name}</h3>
                <p className="text-sm text-muted-foreground">
                  {sellerProfile.is_available ? '🟢 Open for orders' : '🔴 Currently closed'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  {sellerProfile.is_available ? 'Open' : 'Closed'}
                </span>
                <Switch
                  checked={sellerProfile.is_available}
                  onCheckedChange={toggleAvailability}
                />
              </div>
            </div>
          </div>
        )}

        {/* Earnings Summary */}
        <div className="bg-gradient-to-r from-success/10 to-success/5 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="text-success" size={20} />
            <h3 className="font-semibold">Earnings Summary</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Today</p>
              <p className="text-lg font-bold text-success">₹{stats.todayEarnings}</p>
            </div>
            <div className="bg-white/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">This Week</p>
              <p className="text-lg font-bold text-success">₹{stats.weekEarnings}</p>
            </div>
            <div className="bg-white/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">All Time</p>
              <p className="text-lg font-bold text-success">₹{stats.totalEarnings}</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <Package className="mx-auto text-primary mb-1" size={20} />
              <p className="text-xl font-bold">{stats.totalOrders}</p>
              <p className="text-[10px] text-muted-foreground">Total Orders</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <Clock className="mx-auto text-warning mb-1" size={20} />
              <p className="text-xl font-bold">{stats.pendingOrders}</p>
              <p className="text-[10px] text-muted-foreground">Pending</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <Calendar className="mx-auto text-info mb-1" size={20} />
              <p className="text-xl font-bold">{stats.todayOrders}</p>
              <p className="text-[10px] text-muted-foreground">Today</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Link to="/seller/products">
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Plus className="text-primary" size={20} />
                </div>
                <div>
                  <p className="font-medium text-sm">Manage Products</p>
                  <p className="text-xs text-muted-foreground">Add or edit items</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link to="/seller/settings">
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                  <Settings className="text-secondary-foreground" size={20} />
                </div>
                <div>
                  <p className="font-medium text-sm">Store Settings</p>
                  <p className="text-xs text-muted-foreground">Edit profile</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Orders with Filters */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Orders</h3>
          </div>

          {/* Order Filters */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-4">
            {[
              { value: 'all', label: 'All' },
              { value: 'today', label: 'Today' },
              { value: 'pending', label: 'Pending' },
              { value: 'completed', label: 'Completed' },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setOrderFilter(value as any)}
                className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                  orderFilter === value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {filteredOrders.length > 0 ? (
            <div className="space-y-2">
              {filteredOrders.slice(0, 10).map((order) => {
                const buyer = (order as any).buyer;
                const items = (order as any).items || [];
                const statusInfo = ORDER_STATUS_LABELS[order.status];

                return (
                  <Link key={order.id} to={`/orders/${order.id}`}>
                    <Card className="hover:shadow-md transition-shadow">
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-sm truncate">
                              {buyer?.name}
                            </p>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full ${statusInfo.color}`}
                            >
                              {statusInfo.label}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {items.length} items • ₹{order.total_amount}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {format(new Date(order.created_at), 'MMM d, h:mm a')}
                          </p>
                        </div>
                        <ChevronRight size={18} className="text-muted-foreground" />
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
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
