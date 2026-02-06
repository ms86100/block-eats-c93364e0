import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ReviewForm } from '@/components/review/ReviewForm';
import { OrderChat } from '@/components/chat/OrderChat';
import { ReorderButton } from '@/components/order/ReorderButton';
import { UrgentOrderTimer } from '@/components/order/UrgentOrderTimer';
import { OrderRejectionDialog } from '@/components/order/OrderRejectionDialog';
import { useUrgentOrderSound } from '@/hooks/useUrgentOrderSound';
import { useAuth } from '@/contexts/AuthContext';
import { sendOrderStatusNotification } from '@/lib/notifications';
import { Order, OrderItem, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, OrderStatus, PaymentStatus } from '@/types/database';
import { ArrowLeft, Phone, MapPin, Check, Star, MessageCircle, CreditCard, AlertTriangle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function OrderDetailPage() {
  const { id } = useParams();
  const { user, isSeller } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [hasReview, setHasReview] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [isRejectionDialogOpen, setIsRejectionDialogOpen] = useState(false);

  // Determine if this is an urgent order that needs sound notification
  const seller = (order as any)?.seller;
  const isSellerView = isSeller && seller?.user_id === user?.id;
  const isUrgentOrder = order?.auto_cancel_at && order.status === 'placed' && isSellerView;
  
  // Play urgent sound for sellers when they have an urgent pending order
  useUrgentOrderSound(!!isUrgentOrder);

  useEffect(() => {
    if (id) {
      fetchOrder();
      fetchUnreadCount();
    }
  }, [id]);

  // Set up real-time subscription for order updates
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`order-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          console.log('Order updated:', payload);
          setOrder((prev) => prev ? { ...prev, ...payload.new } as Order : null);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
            profile:profiles!seller_profiles_user_id_fkey(name, phone, block, flat_number)
          ),
          buyer:profiles!orders_buyer_id_fkey(name, phone, block, flat_number),
          items:order_items(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setOrder(data as any);

      // Check if review exists
      const { data: reviewData } = await supabase
        .from('reviews')
        .select('id')
        .eq('order_id', id)
        .single();
      
      setHasReview(!!reviewData);
    } catch (error) {
      console.error('Error fetching order:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    if (!user || !id) return;
    
    const { count } = await supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', id)
      .eq('receiver_id', user.id)
      .eq('read_status', false);
    
    setUnreadMessages(count || 0);
  };

  const updateOrderStatus = async (newStatus: OrderStatus, rejectionReason?: string) => {
    if (!order) return;

    setIsUpdating(true);
    try {
      const updateData: any = { 
        status: newStatus,
        auto_cancel_at: null, // Clear the auto-cancel timer when order is acted upon
      };
      
      if (rejectionReason) {
        updateData.rejection_reason = rejectionReason;
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', order.id);

      if (error) throw error;
      
      setOrder({ ...order, ...updateData });
      toast.success(`Order ${ORDER_STATUS_LABELS[newStatus].label.toLowerCase()}`);

      // Send push notification for status change
      const buyerName = buyer?.name || 'Customer';
      const sellerName = seller?.business_name || 'Seller';
      const sellerUserId = seller?.user_id;
      
      if (order.buyer_id && order.seller_id && sellerUserId) {
        sendOrderStatusNotification(
          order.id,
          newStatus,
          order.buyer_id,
          order.seller_id,
          sellerUserId,
          sellerName,
          buyerName
        );
      }
    } catch (error: any) {
      console.error('Error updating order:', error);
      toast.error('Failed to update order');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReject = async (reason: string) => {
    await updateOrderStatus('cancelled', reason);
  };

  const handleTimeout = () => {
    // Order will be auto-cancelled by the edge function
    // Just refresh the order data
    fetchOrder();
    toast.error('Order was auto-cancelled due to timeout');
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

  const sellerProfile = seller?.profile;
  const buyer = (order as any).buyer;
  const items = (order as any).items || [];
  const statusInfo = ORDER_STATUS_LABELS[order.status];
  const paymentStatusInfo = PAYMENT_STATUS_LABELS[(order.payment_status as PaymentStatus) || 'pending'];
  const isBuyerView = order.buyer_id === user?.id;

  const statusOrder: OrderStatus[] = ['placed', 'accepted', 'preparing', 'ready', 'picked_up', 'delivered', 'completed'];
  const currentStatusIndex = statusOrder.indexOf(order.status);
  const displayStatuses = ['placed', 'accepted', 'preparing', 'ready'];
  
  // Determine next status for seller
  const getNextStatus = (): OrderStatus | null => {
    if (order.status === 'cancelled' || order.status === 'completed') return null;
    const nextIndex = currentStatusIndex + 1;
    if (nextIndex < statusOrder.length) {
      return statusOrder[nextIndex];
    }
    return null;
  };

  const nextStatus = getNextStatus();
  const canReview = isBuyerView && order.status === 'completed' && !hasReview;
  const canChat = !['completed', 'cancelled'].includes(order.status);
  const canReorder = isBuyerView && (order.status === 'completed' || order.status === 'delivered');
  
  // Get chat recipient info
  const chatRecipientId = isSellerView ? order.buyer_id : seller?.user_id;
  const chatRecipientName = isSellerView ? buyer?.name : seller?.business_name;

  return (
    <AppLayout showHeader={false} showNav={!isSellerView || order.status === 'completed' || order.status === 'cancelled'}>
      <div className="p-4 pb-24">
        <div className="flex items-center justify-between mb-4">
          <Link to="/orders" className="flex items-center gap-2 text-muted-foreground">
            <ArrowLeft size={20} />
            <span>Back to Orders</span>
          </Link>
          
          {/* Chat Button */}
          {canChat && chatRecipientId && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsChatOpen(true)}
              className="relative"
            >
              <MessageCircle size={16} className="mr-2" />
              Chat
              {unreadMessages > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                  {unreadMessages}
                </span>
              )}
            </Button>
          )}
        </div>

        {/* Urgent Order Timer for Sellers */}
        {isUrgentOrder && order.auto_cancel_at && (
          <div className="mb-4">
            <UrgentOrderTimer
              autoCancelAt={order.auto_cancel_at}
              onTimeout={handleTimeout}
            />
          </div>
        )}

        {/* Rejection Reason Display for Buyers */}
        {order.status === 'cancelled' && order.rejection_reason && isBuyerView && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 mb-4">
            <div className="flex items-start gap-3">
              <XCircle className="text-destructive shrink-0 mt-0.5" size={20} />
              <div>
                <p className="font-semibold text-destructive">Order Cancelled</p>
                <p className="text-sm text-muted-foreground mt-1">{order.rejection_reason}</p>
              </div>
            </div>
          </div>
        )}

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
              {displayStatuses.map((status, index) => {
                const statusIndex = statusOrder.indexOf(status as OrderStatus);
                const isCompleted = statusIndex <= currentStatusIndex;
                const isCurrent = statusIndex === currentStatusIndex;
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
                      {ORDER_STATUS_LABELS[status as OrderStatus].label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Payment Status */}
        <div className="bg-card rounded-xl p-4 shadow-sm mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard size={20} className="text-muted-foreground" />
              <div>
                <p className="font-semibold text-sm">Payment</p>
                <p className="text-xs text-muted-foreground">
                  {order.payment_type === 'cod' ? 'Cash on Delivery' : 'UPI Payment'}
                </p>
              </div>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${paymentStatusInfo.color}`}>
              {paymentStatusInfo.label}
            </span>
          </div>
        </div>

        {/* Reorder Button for completed orders */}
        {canReorder && (
          <div className="bg-success/10 border border-success/20 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
                  <CreditCard className="text-success" size={20} />
                </div>
                <div>
                  <p className="font-semibold">Enjoyed this order?</p>
                  <p className="text-sm text-muted-foreground">Order the same items again</p>
                </div>
              </div>
              <ReorderButton
                orderItems={items}
                sellerId={order.seller_id}
                size="sm"
              />
            </div>
          </div>
        )}

        {/* Review CTA for completed orders */}
        {canReview && (
          <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Star className="text-warning" size={24} />
                <div>
                  <p className="font-semibold">Rate your experience</p>
                  <p className="text-sm text-muted-foreground">Help others by sharing your feedback</p>
                </div>
              </div>
              <ReviewForm
                orderId={order.id}
                sellerId={order.seller_id}
                sellerName={seller?.business_name || 'Seller'}
                onSuccess={() => setHasReview(true)}
              />
            </div>
          </div>
        )}

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
      </div>

      {/* Seller Actions */}
      {isSellerView && order.status !== 'completed' && order.status !== 'cancelled' && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-card border-t safe-bottom">
          <div className="flex gap-3">
            {order.status === 'placed' && (
              <Button
                variant="outline"
                className="flex-1 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => setIsRejectionDialogOpen(true)}
                disabled={isUpdating}
              >
                <XCircle size={16} className="mr-2" />
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

      {/* Rejection Dialog */}
      <OrderRejectionDialog
        open={isRejectionDialogOpen}
        onOpenChange={setIsRejectionDialogOpen}
        onReject={handleReject}
        orderNumber={order.id}
      />

      {/* Chat Component */}
      {chatRecipientId && (
        <OrderChat
          orderId={order.id}
          otherUserId={chatRecipientId}
          otherUserName={chatRecipientName || 'User'}
          isOpen={isChatOpen}
          onClose={() => {
            setIsChatOpen(false);
            fetchUnreadCount();
          }}
          disabled={!canChat}
        />
      )}
    </AppLayout>
  );
}
