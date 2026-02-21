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
import { logAudit } from '@/lib/audit';
import { Order, OrderItem, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, OrderStatus, PaymentStatus, ItemStatus, ITEM_STATUS_LABELS } from '@/types/database';
import { OrderItemCard } from '@/components/order/OrderItemCard';
import { ArrowLeft, Phone, MapPin, Check, Star, MessageCircle, CreditCard, XCircle, Package, ChevronRight, Copy } from 'lucide-react';
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

  const seller = (order as any)?.seller;
  const isSellerView = isSeller && seller?.user_id === user?.id;
  const isUrgentOrder = order?.auto_cancel_at && order.status === 'placed' && isSellerView;
  
  useUrgentOrderSound(!!isUrgentOrder);

  useEffect(() => {
    if (id) {
      fetchOrder();
      fetchUnreadCount();
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`order-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
        (payload) => { setOrder((prev) => prev ? { ...prev, ...payload.new } as Order : null); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const fetchOrder = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`*, seller:seller_profiles(id, business_name, user_id, profile:profiles!seller_profiles_user_id_fkey(name, phone, block, flat_number)), buyer:profiles!orders_buyer_id_fkey(name, phone, block, flat_number), items:order_items(*)`)
        .eq('id', id)
        .single();
      if (error) throw error;
      setOrder(data as any);
      const { data: reviewData } = await supabase.from('reviews').select('id').eq('order_id', id).single();
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
      const updateData: any = { status: newStatus, auto_cancel_at: null };
      if (rejectionReason) updateData.rejection_reason = rejectionReason;
      const { error } = await supabase.from('orders').update(updateData).eq('id', order.id);
      if (error) throw error;
      setOrder({ ...order, ...updateData });
      toast.success(`Order ${ORDER_STATUS_LABELS[newStatus].label.toLowerCase()}`);
      if (order.society_id) {
        logAudit(`order_${newStatus}`, 'order', order.id, order.society_id, { old_status: order.status, new_status: newStatus, rejection_reason: rejectionReason });
      }
      const buyerName = buyer?.name || 'Customer';
      const sellerName = seller?.business_name || 'Seller';
      const sellerUserId = seller?.user_id;
      if (order.buyer_id && order.seller_id && sellerUserId) {
        sendOrderStatusNotification(order.id, newStatus, order.buyer_id, order.seller_id, sellerUserId, sellerName, buyerName);
      }
    } catch (error: any) {
      console.error('Error updating order:', error);
      toast.error('Failed to update order');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReject = async (reason: string) => { await updateOrderStatus('cancelled', reason); };
  const handleTimeout = () => { fetchOrder(); toast.error('Order was auto-cancelled due to timeout'); };

  if (isLoading) {
    return (
      <AppLayout showHeader={false}>
        <div className="p-4 space-y-3">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  if (!order) {
    return (
      <AppLayout showHeader={false}>
        <div className="p-4 text-center py-16">
          <p className="text-sm text-muted-foreground">Order not found</p>
          <Link to="/orders"><Button size="sm" className="mt-4">View Orders</Button></Link>
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

  const getNextStatus = (): OrderStatus | null => {
    if (order.status === 'cancelled' || order.status === 'completed') return null;
    const nextIndex = currentStatusIndex + 1;
    return nextIndex < statusOrder.length ? statusOrder[nextIndex] : null;
  };

  const nextStatus = getNextStatus();
  const canReview = isBuyerView && order.status === 'completed' && !hasReview;
  const canChat = !['completed', 'cancelled'].includes(order.status);
  const canReorder = isBuyerView && (order.status === 'completed' || order.status === 'delivered');
  const chatRecipientId = isSellerView ? order.buyer_id : seller?.user_id;
  const chatRecipientName = isSellerView ? buyer?.name : seller?.business_name;

  const copyOrderId = () => {
    navigator.clipboard.writeText(order.id.slice(0, 8));
    toast.success('Order ID copied');
  };

  return (
    <AppLayout showHeader={false} showNav={!isSellerView || order.status === 'completed' || order.status === 'cancelled'}>
      <div className="pb-28">
        {/* Sticky Header */}
        <div className="sticky top-0 z-30 bg-background border-b border-border px-4 py-3 safe-top flex items-center gap-3">
          <Link to="/orders" className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted shrink-0">
            <ArrowLeft size={16} />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold">Order Summary</h1>
            <button onClick={copyOrderId} className="flex items-center gap-1 text-[11px] text-muted-foreground">
              #{order.id.slice(0, 8)} <Copy size={10} />
            </button>
          </div>
          {canChat && chatRecipientId && (
            <button
              onClick={() => setIsChatOpen(true)}
              className="relative inline-flex items-center justify-center w-9 h-9 rounded-full bg-muted"
            >
              <MessageCircle size={16} />
              {unreadMessages > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                  {unreadMessages}
                </span>
              )}
            </button>
          )}
        </div>

        <div className="px-4 pt-3 space-y-3">
          {/* Urgent Timer */}
          {isUrgentOrder && order.auto_cancel_at && (
            <UrgentOrderTimer autoCancelAt={order.auto_cancel_at} onTimeout={handleTimeout} />
          )}

          {/* Cancellation banner */}
          {order.status === 'cancelled' && order.rejection_reason && isBuyerView && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 flex items-start gap-2.5">
              <XCircle className="text-destructive shrink-0 mt-0.5" size={16} />
              <div>
                <p className="text-sm font-semibold text-destructive">Order Cancelled</p>
                <p className="text-xs text-muted-foreground mt-0.5">{order.rejection_reason}</p>
              </div>
            </div>
          )}

          {/* Status + Timeline Card */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(order.created_at), 'MMM d, h:mm a')}
              </span>
            </div>

            {order.status !== 'cancelled' && (
              <div className="flex items-center justify-between mt-4 gap-1">
                {displayStatuses.map((status, index) => {
                  const statusIndex = statusOrder.indexOf(status as OrderStatus);
                  const isCompleted = statusIndex <= currentStatusIndex;
                  const isCurrent = statusIndex === currentStatusIndex;
                  return (
                    <div key={status} className="flex flex-col items-center flex-1">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold
                        ${isCompleted ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}
                        ${isCurrent ? 'ring-2 ring-accent ring-offset-1 ring-offset-background' : ''}
                      `}>
                        {isCompleted ? <Check size={14} /> : index + 1}
                      </div>
                      <span className="text-[9px] text-center mt-1 text-muted-foreground leading-tight">
                        {ORDER_STATUS_LABELS[status as OrderStatus].label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Status reassurance message */}
            {order.status !== 'cancelled' && isBuyerView && (
              <p className="text-xs text-muted-foreground mt-3 bg-muted/50 rounded-lg px-3 py-2">
                {order.status === 'placed' && '⏳ Waiting for seller to accept. Most sellers respond within 5 minutes.'}
                {order.status === 'accepted' && '✅ Great! Your order has been confirmed and will be prepared soon.'}
                {order.status === 'preparing' && '👨‍🍳 Your order is being prepared. Sit tight!'}
                {order.status === 'ready' && '📦 Your order is ready! Head to pickup or wait for delivery.'}
                {order.status === 'picked_up' && '🚚 Your order is on the way!'}
                {order.status === 'delivered' && '🎉 Your order has been delivered. Enjoy!'}
                {order.status === 'completed' && '⭐ Order completed. Thank you for your purchase!'}
              </p>
            )}
          </div>

          {/* Payment Card */}
          <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CreditCard size={16} className="text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {order.payment_type === 'cod' ? 'Cash on Delivery' : 'UPI Payment'}
                </p>
              </div>
            </div>
            <span className={`text-[11px] px-2 py-0.5 rounded-full ${paymentStatusInfo.color}`}>
              {paymentStatusInfo.label}
            </span>
          </div>

          {/* Reorder CTA */}
          {canReorder && (
            <div className="bg-accent/10 border border-accent/20 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Package className="text-accent" size={18} />
                <div>
                  <p className="text-sm font-semibold">Order again?</p>
                  <p className="text-[11px] text-muted-foreground">Same items, one tap</p>
                </div>
              </div>
              <ReorderButton orderItems={items} sellerId={order.seller_id} size="sm" />
            </div>
          )}

          {/* Review CTA */}
          {canReview && (
            <div className="bg-warning/10 border border-warning/20 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Star className="text-warning" size={18} />
                <div>
                  <p className="text-sm font-semibold">Rate this order</p>
                  <p className="text-[11px] text-muted-foreground">Help others with your review</p>
                </div>
              </div>
              <ReviewForm orderId={order.id} sellerId={order.seller_id} sellerName={seller?.business_name || 'Seller'} onSuccess={() => setHasReview(true)} />
            </div>
          )}

          {/* Seller/Buyer Info */}
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {isSellerView ? 'Customer' : 'Seller'}
            </p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{isSellerView ? buyer?.name : seller?.business_name}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin size={11} />
                  Block {isSellerView ? buyer?.block : sellerProfile?.block}, {isSellerView ? buyer?.flat_number : sellerProfile?.flat_number}
                </p>
              </div>
              <a
                href={`tel:${isSellerView ? buyer?.phone : sellerProfile?.phone}`}
                className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center"
              >
                <Phone size={16} className="text-accent" />
              </a>
            </div>
          </div>

          {/* Order Items */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Items</p>
              {items.length > 1 && (
                <span className="text-[11px] text-muted-foreground">
                  {items.filter((i: OrderItem) => (i.status || 'pending') === 'delivered').length}/{items.length} done
                </span>
              )}
            </div>

            {items.length > 1 && (
              <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                {(['pending', 'accepted', 'preparing', 'ready', 'delivered', 'cancelled'] as ItemStatus[]).map((status) => {
                  const count = items.filter((i: OrderItem) => (i.status || 'pending') === status).length;
                  if (count === 0) return null;
                  return (
                    <span key={status} className={`text-[10px] px-1.5 py-0.5 rounded ${ITEM_STATUS_LABELS[status].color}`}>
                      {count} {ITEM_STATUS_LABELS[status].label}
                    </span>
                  );
                })}
              </div>
            )}

            <div className="space-y-2">
              {items.map((item: OrderItem) => (
                <OrderItemCard
                  key={item.id}
                  item={item}
                  isSellerView={isSellerView}
                  orderStatus={order.status}
                  onStatusUpdate={(itemId, newStatus) => {
                    const updatedItems = items.map((i: OrderItem) => i.id === itemId ? { ...i, status: newStatus } : i);
                    setOrder({ ...order, items: updatedItems } as any);
                  }}
                />
              ))}
            </div>

            {/* Bill summary */}
            <div className="border-t border-border pt-3 mt-3 space-y-1.5 text-sm">
              {(order as any).discount_amount > 0 && (
                <div className="flex justify-between text-primary">
                  <span>Discount</span>
                  <span>-₹{(order as any).discount_amount}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivery</span>
                <span className="text-primary font-medium">FREE</span>
              </div>
              <div className="flex justify-between font-bold pt-1 border-t border-border">
                <span>Total</span>
                <span>₹{order.total_amount}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Instructions</p>
              <p className="text-sm text-muted-foreground">{order.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Seller Action Bar */}
      {isSellerView && order.status !== 'completed' && order.status !== 'cancelled' && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border safe-bottom">
          <div className="px-4 py-3 flex gap-3">
            {order.status === 'placed' && (
              <Button
                variant="outline"
                className="flex-1 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => setIsRejectionDialogOpen(true)}
                disabled={isUpdating}
                size="sm"
              >
                <XCircle size={14} className="mr-1.5" />
                Reject
              </Button>
            )}
            {nextStatus && (
              <Button
                className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={() => updateOrderStatus(nextStatus)}
                disabled={isUpdating}
                size="sm"
              >
                {isUpdating ? 'Updating...' : `Mark ${ORDER_STATUS_LABELS[nextStatus].label}`}
                <ChevronRight size={14} className="ml-1" />
              </Button>
            )}
          </div>
        </div>
      )}

      <OrderRejectionDialog open={isRejectionDialogOpen} onOpenChange={setIsRejectionDialogOpen} onReject={handleReject} orderNumber={order.id} />

      {chatRecipientId && (
        <OrderChat
          orderId={order.id}
          otherUserId={chatRecipientId}
          otherUserName={chatRecipientName || 'User'}
          isOpen={isChatOpen}
          onClose={() => { setIsChatOpen(false); fetchUnreadCount(); }}
          disabled={!canChat}
        />
      )}
    </AppLayout>
  );
}
