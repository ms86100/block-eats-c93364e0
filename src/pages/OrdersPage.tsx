import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReorderButton } from '@/components/order/ReorderButton';
import { useAuth } from '@/contexts/AuthContext';
import { Order, ORDER_STATUS_LABELS } from '@/types/database';
import { Package, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

export default function OrdersPage() {
  const { user, isSeller } = useAuth();
  const [buyerOrders, setBuyerOrders] = useState<Order[]>([]);
  const [sellerOrders, setSellerOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user]);

  const fetchOrders = async () => {
    if (!user) return;

    try {
      // Fetch buyer orders
      const { data: buyerData } = await supabase
        .from('orders')
        .select(`
          *,
          seller:seller_profiles(business_name, cover_image_url),
          items:order_items(*)
        `)
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });

      setBuyerOrders((buyerData as any) || []);

      // Fetch seller orders if user is a seller
      if (isSeller) {
        const { data: sellerProfile } = await supabase
          .from('seller_profiles')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (sellerProfile) {
          const { data: sellerData } = await supabase
            .from('orders')
            .select(`
              *,
              buyer:profiles!orders_buyer_id_fkey(name, block, flat_number, phone),
              items:order_items(*)
            `)
            .eq('seller_id', sellerProfile.id)
            .order('created_at', { ascending: false });

          setSellerOrders((sellerData as any) || []);
        }
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const OrderCard = ({ order, type }: { order: Order; type: 'buyer' | 'seller' }) => {
    const statusInfo = ORDER_STATUS_LABELS[order.status];
    const seller = (order as any).seller;
    const buyer = (order as any).buyer;
    const items = (order as any).items || [];
    const canReorder = type === 'buyer' && (order.status === 'completed' || order.status === 'delivered');

    return (
      <div className="bg-card rounded-xl p-4 shadow-sm mb-3">
        <Link to={`/orders/${order.id}`}>
          <div className="flex items-start gap-3">
            <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0">
              {seller?.cover_image_url ? (
                <img
                  src={seller.cover_image_url}
                  alt={seller?.business_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <Package size={24} className="text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold truncate">
                    {type === 'buyer' ? seller?.business_name : buyer?.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(order.created_at), 'MMM d, yyyy • h:mm a')}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {items.length} item{items.length > 1 ? 's' : ''} • ₹{order.total_amount}
              </p>
              {type === 'seller' && buyer && (
                <p className="text-xs text-muted-foreground mt-1">
                  Block {buyer.block}, {buyer.flat_number}
                </p>
              )}
            </div>
            <ChevronRight size={20} className="text-muted-foreground shrink-0" />
          </div>
        </Link>
        {canReorder && (
          <div className="mt-3 pt-3 border-t flex justify-end">
            <ReorderButton
              orderItems={items}
              sellerId={order.seller_id}
              variant="outline"
              size="sm"
            />
          </div>
        )}
      </div>
    );
  };

  const EmptyState = ({ message }: { message: string }) => (
    <div className="text-center py-12">
      <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
        <Package size={32} className="text-muted-foreground" />
      </div>
      <p className="text-muted-foreground mb-4">{message}</p>
      <Link to="/">
        <Button>Browse Sellers</Button>
      </Link>
    </div>
  );

  return (
    <AppLayout headerTitle="My Orders" showLocation={false}>
      <div className="p-4">
        {isSeller ? (
          <Tabs defaultValue="buying" className="w-full">
            <TabsList className="w-full mb-4">
              <TabsTrigger value="buying" className="flex-1">My Orders</TabsTrigger>
              <TabsTrigger value="selling" className="flex-1">Received Orders</TabsTrigger>
            </TabsList>
            <TabsContent value="buying">
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-xl" />
                  ))}
                </div>
              ) : buyerOrders.length > 0 ? (
                buyerOrders.map((order) => (
                  <OrderCard key={order.id} order={order} type="buyer" />
                ))
              ) : (
                <EmptyState message="You haven't placed any orders yet" />
              )}
            </TabsContent>
            <TabsContent value="selling">
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-xl" />
                  ))}
                </div>
              ) : sellerOrders.length > 0 ? (
                sellerOrders.map((order) => (
                  <OrderCard key={order.id} order={order} type="seller" />
                ))
              ) : (
                <EmptyState message="No orders received yet" />
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-xl" />
                ))}
              </div>
            ) : buyerOrders.length > 0 ? (
              buyerOrders.map((order) => (
                <OrderCard key={order.id} order={order} type="buyer" />
              ))
            ) : (
              <EmptyState message="You haven't placed any orders yet" />
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
