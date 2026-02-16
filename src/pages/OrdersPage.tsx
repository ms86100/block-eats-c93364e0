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
import { Package, ChevronRight, Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

const PAGE_SIZE = 20;

function OrderCard({ order, type }: { order: Order; type: 'buyer' | 'seller' }) {
  const statusInfo = ORDER_STATUS_LABELS[order.status];
  const seller = (order as any).seller;
  const buyer = (order as any).buyer;
  const items = (order as any).items || [];
  const canReorder = type === 'buyer' && (order.status === 'completed' || order.status === 'delivered');
  const isCompleted = order.status === 'completed' || order.status === 'delivered';

  return (
    <Link to={`/orders/${order.id}`} className="block">
      <div className="bg-card border border-border rounded-xl p-3 mb-2.5 active:scale-[0.99] transition-transform">
        <div className="flex items-start gap-3">
          {/* Seller/Buyer thumbnail */}
          <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-muted">
            {seller?.cover_image_url ? (
              <img src={seller.cover_image_url} alt={seller?.business_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package size={20} className="text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold truncate">
                {type === 'buyer' ? seller?.business_name : buyer?.name}
              </h3>
              <ChevronRight size={16} className="text-muted-foreground shrink-0" />
            </div>

            {/* Status + date row */}
            <div className="flex items-center gap-2 mt-0.5">
              {isCompleted && <CheckCircle size={12} className="text-accent shrink-0" />}
              <span className={`text-[11px] px-1.5 py-0.5 rounded ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {format(new Date(order.created_at), 'MMM d')}
              </span>
            </div>

            {/* Items + price */}
            <p className="text-xs text-muted-foreground mt-1">
              {items.length} item{items.length > 1 ? 's' : ''} · ₹{order.total_amount}
            </p>

            {type === 'seller' && buyer && (
              <p className="text-[11px] text-muted-foreground">
                Block {buyer.block}, {buyer.flat_number}
              </p>
            )}
          </div>
        </div>

        {/* Reorder row */}
        {canReorder && (
          <div className="mt-2.5 pt-2.5 border-t border-border flex justify-end" onClick={(e) => e.preventDefault()}>
            <ReorderButton orderItems={items} sellerId={order.seller_id} variant="outline" size="sm" />
          </div>
        )}
      </div>
    </Link>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
        <Package size={28} className="text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground mb-4">{message}</p>
      <Link to="/"><Button size="sm">Browse Sellers</Button></Link>
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

      if (isInitial) setOrders(results);
      else setOrders(prev => [...prev, ...results]);
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
      <div className="space-y-2.5">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
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
          <Button variant="outline" size="sm" onClick={loadMore} disabled={isLoadingMore}>
            {isLoadingMore ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Loading...</> : 'Load More'}
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
    <AppLayout showHeader={false}>
      <div className="pb-4">
        {/* Sticky header */}
        <div className="sticky top-0 z-30 bg-background border-b border-border px-4 py-3 safe-top flex items-center gap-3">
          <Link to="/" className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted shrink-0">
            <ArrowLeft size={16} />
          </Link>
          <h1 className="text-base font-bold">Your Orders</h1>
        </div>

        <div className="px-4 pt-3">
          {isSeller ? (
            <Tabs defaultValue="buying" className="w-full">
              <TabsList className="w-full mb-3 h-9">
                <TabsTrigger value="buying" className="flex-1 text-xs">My Orders</TabsTrigger>
                <TabsTrigger value="selling" className="flex-1 text-xs">Received</TabsTrigger>
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
      </div>
    </AppLayout>
  );
}
