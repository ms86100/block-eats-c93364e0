import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { SellerProfile, Order, ORDER_STATUS_LABELS } from '@/types/database';
import { Package, Plus, Settings, DollarSign, Clock, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function SellerDashboardPage() {
  const { user } = useAuth();
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    totalEarnings: 0,
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

      // Fetch orders and stats
      const { data: orders } = await supabase
        .from('orders')
        .select(`
          *,
          buyer:profiles!orders_buyer_id_fkey(name, block, flat_number),
          items:order_items(*)
        `)
        .eq('seller_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentOrders((orders as any) || []);

      // Calculate stats
      const { data: allOrders } = await supabase
        .from('orders')
        .select('status, total_amount')
        .eq('seller_id', profile.id);

      if (allOrders) {
        const totalOrders = allOrders.length;
        const pendingOrders = allOrders.filter(
          (o) => o.status !== 'completed' && o.status !== 'cancelled'
        ).length;
        const totalEarnings = allOrders
          .filter((o) => o.status === 'completed')
          .reduce((sum, o) => sum + Number(o.total_amount), 0);

        setStats({ totalOrders, pendingOrders, totalEarnings });
      }
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
                  {sellerProfile.is_available ? 'Open for orders' : 'Currently closed'}
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
              <DollarSign className="mx-auto text-success mb-1" size={20} />
              <p className="text-xl font-bold">₹{stats.totalEarnings}</p>
              <p className="text-[10px] text-muted-foreground">Earnings</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Link to="/seller/products">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
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
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
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

        {/* Recent Orders */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Recent Orders</h3>
            <Link to="/orders" className="text-sm text-primary">
              View all
            </Link>
          </div>

          {recentOrders.length > 0 ? (
            <div className="space-y-2">
              {recentOrders.map((order) => {
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
            </div>
          ) : (
            <div className="text-center py-8 bg-muted rounded-xl">
              <Package className="mx-auto text-muted-foreground mb-2" size={32} />
              <p className="text-sm text-muted-foreground">No orders yet</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
