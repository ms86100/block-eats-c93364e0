import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { Order, OrderItem, ORDER_STATUS_LABELS, OrderStatus } from '@/types/database';
import { ArrowLeft, Phone, MapPin, MessageCircle, Check } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isSeller } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (id) {
      fetchOrder();
    }
  }, [id]);

  const fetchOrder = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          seller:seller_profiles(
            id, 
            business_name, 
            user_id,
            profile:profiles(name, phone, block, flat_number)
          ),
          buyer:profiles!orders_buyer_id_fkey(name, phone, block, flat_number),
          items:order_items(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setOrder(data as any);
    } catch (error) {
      console.error('Error fetching order:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateOrderStatus = async (newStatus: OrderStatus) => {
    if (!order) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', order.id);

      if (error) throw error;
      
      setOrder({ ...order, status: newStatus });
      toast.success(`Order ${ORDER_STATUS_LABELS[newStatus].label.toLowerCase()}`);
    } catch (error: any) {
      console.error('Error updating order:', error);
      toast.error('Failed to update order');
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout showHeader={false}>
        <div className="p-4">
          <Skeleton className="h-8 w-32 mb-4" />
          <Skeleton className="h-32 w-full rounded-xl mb-4" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  if (!order) {
    return (
      <AppLayout showHeader={false}>
        <div className="p-4 text-center">
          <p>Order not found</p>
          <Link to="/orders">
            <Button className="mt-4">View Orders</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const seller = (order as any).seller;
  const sellerProfile = seller?.profile;
  const buyer = (order as any).buyer;
  const items = (order as any).items || [];
  const statusInfo = ORDER_STATUS_LABELS[order.status];
  const isSellerView = isSeller && seller?.user_id === user?.id;

  const statusOrder: OrderStatus[] = ['placed', 'accepted', 'preparing', 'ready', 'completed'];
  const currentStatusIndex = statusOrder.indexOf(order.status);
  const nextStatus = statusOrder[currentStatusIndex + 1];

  return (
    <AppLayout showHeader={false} showNav={!isSellerView || order.status === 'completed'}>
      <div className="p-4">
        <Link to="/orders" className="flex items-center gap-2 text-muted-foreground mb-4">
          <ArrowLeft size={20} />
          <span>Back to Orders</span>
        </Link>

        {/* Order Status */}
        <div className="bg-card rounded-xl p-4 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className={`text-sm px-3 py-1 rounded-full ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
              <p className="text-xs text-muted-foreground mt-2">
                Order #{order.id.slice(0, 8)}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              {format(new Date(order.created_at), 'MMM d, h:mm a')}
            </p>
          </div>

          {/* Status Timeline */}
          {order.status !== 'cancelled' && (
            <div className="flex items-center justify-between mt-4">
              {statusOrder.slice(0, -1).map((status, index) => {
                const isCompleted = index <= currentStatusIndex;
                const isCurrent = index === currentStatusIndex;
                return (
                  <div key={status} className="flex flex-col items-center flex-1">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isCompleted
                          ? 'bg-success text-white'
                          : 'bg-muted text-muted-foreground'
                      } ${isCurrent ? 'ring-2 ring-success ring-offset-2' : ''}`}
                    >
                      {isCompleted ? <Check size={16} /> : index + 1}
                    </div>
                    <span className="text-[10px] text-center mt-1 text-muted-foreground">
                      {ORDER_STATUS_LABELS[status].label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Seller/Buyer Info */}
        <div className="bg-card rounded-xl p-4 shadow-sm mb-4">
          <h3 className="font-semibold mb-3">
            {isSellerView ? 'Customer Details' : 'Seller Details'}
          </h3>
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium">
                {isSellerView ? buyer?.name : seller?.business_name}
              </p>
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <MapPin size={14} />
                Block {isSellerView ? buyer?.block : sellerProfile?.block}, 
                {isSellerView ? buyer?.flat_number : sellerProfile?.flat_number}
              </p>
            </div>
            <a
              href={`tel:${isSellerView ? buyer?.phone : sellerProfile?.phone}`}
              className="p-2 rounded-full bg-success/10 text-success"
            >
              <Phone size={20} />
            </a>
          </div>
        </div>

        {/* Order Items */}
        <div className="bg-card rounded-xl p-4 shadow-sm mb-4">
          <h3 className="font-semibold mb-3">Order Items</h3>
          <div className="space-y-3">
            {items.map((item: OrderItem) => (
              <div key={item.id} className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{item.product_name}</p>
                  <p className="text-sm text-muted-foreground">
                    ₹{item.unit_price} × {item.quantity}
                  </p>
                </div>
                <p className="font-semibold">₹{item.unit_price * item.quantity}</p>
              </div>
            ))}
            <div className="border-t pt-3 mt-3 flex justify-between font-semibold">
              <span>Total</span>
              <span>₹{order.total_amount}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {order.notes && (
          <div className="bg-card rounded-xl p-4 shadow-sm mb-4">
            <h3 className="font-semibold mb-2">Special Instructions</h3>
            <p className="text-sm text-muted-foreground">{order.notes}</p>
          </div>
        )}

        {/* Payment Info */}
        <div className="bg-card rounded-xl p-4 shadow-sm mb-4">
          <h3 className="font-semibold mb-2">Payment</h3>
          <p className="text-sm">
            {order.payment_type === 'cod' ? 'Cash on Delivery' : order.payment_type}
          </p>
        </div>
      </div>

      {/* Seller Actions */}
      {isSellerView && order.status !== 'completed' && order.status !== 'cancelled' && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-card border-t safe-bottom">
          <div className="flex gap-3">
            {order.status === 'placed' && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => updateOrderStatus('cancelled')}
                disabled={isUpdating}
              >
                Reject
              </Button>
            )}
            {nextStatus && (
              <Button
                className="flex-1"
                onClick={() => updateOrderStatus(nextStatus)}
                disabled={isUpdating}
              >
                {isUpdating ? 'Updating...' : `Mark as ${ORDER_STATUS_LABELS[nextStatus].label}`}
              </Button>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
