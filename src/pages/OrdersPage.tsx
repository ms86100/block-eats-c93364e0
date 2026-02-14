import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReorderButton } from '@/components/order/ReorderButton';
import { useAuth } from '@/contexts/AuthContext';
import { Order, ORDER_STATUS_LABELS } from '@/types/database';
import { Package, ChevronRight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const PAGE_SIZE = 20;

function OrderCard({ order, type }: { order: Order; type: 'buyer' | 'seller' }) {
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
}

function EmptyState({ message }: { message: string }) {
  return (
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
}

function OrderList({ type, userId, sellerId }: { type: 'buyer' | 'seller'; userId: string; sellerId?: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchOrders = useCallback(async (cursor?: string) => {
    const isInitial = !cursor;
    if (isInitial) setIsLoading(true);
    else setIsLoadingMore(true);

    try {
      let query;
      if (type === 'buyer') {
        query = supabase
          .from('orders')
          .select(`*, seller:seller_profiles(business_name, cover_image_url), items:order_items(*)`)
          .eq('buyer_id', userId)
          .order('created_at', { ascending: false })
          .limit(PAGE_SIZE);
      } else {
        query = supabase
          .from('orders')
          .select(`*, buyer:profiles!orders_buyer_id_fkey(name, block, flat_number, phone), items:order_items(*)`)
          .eq('seller_id', sellerId!)
          .order('created_at', { ascending: false })
          .limit(PAGE_SIZE);
      }

      if (cursor) {
        query = query.lt('created_at', cursor);
      }

      const { data } = await query;
      const results = (data as any) || [];

      if (isInitial) {
        setOrders(results);
      } else {
        setOrders(prev => [...prev, ...results]);
      }
      setHasMore(results.length === PAGE_SIZE);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [type, userId, sellerId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const loadMore = () => {
    if (orders.length > 0 && hasMore) {
      const lastOrder = orders[orders.length - 1];
      fetchOrders(lastOrder.created_at);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
      </div>
    );
  }

  if (orders.length === 0) {
    return <EmptyState message={type === 'buyer' ? "You haven't placed any orders yet" : "No orders received yet"} />;
  }

  return (
    <div>
      {orders.map(order => <OrderCard key={order.id} order={order} type={type} />)}
      {hasMore && (
        <div className="flex justify-center py-4">
          <Button variant="outline" onClick={loadMore} disabled={isLoadingMore}>
            {isLoadingMore ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...</> : 'Load More'}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  const { user, isSeller, currentSellerId } = useAuth();

  if (!user) return null;

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
              <OrderList type="buyer" userId={user.id} />
            </TabsContent>
            <TabsContent value="selling">
              <OrderList type="seller" userId={user.id} sellerId={currentSellerId || undefined} />
            </TabsContent>
          </Tabs>
        ) : (
          <OrderList type="buyer" userId={user.id} />
        )}
      </div>
    </AppLayout>
  );
}
