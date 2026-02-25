import { useParams, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ReviewForm } from '@/components/review/ReviewForm';
import { OrderChat } from '@/components/chat/OrderChat';
import { ReorderButton } from '@/components/order/ReorderButton';
import { UrgentOrderTimer } from '@/components/order/UrgentOrderTimer';
import { OrderRejectionDialog } from '@/components/order/OrderRejectionDialog';
import { DeliveryStatusCard } from '@/components/delivery/DeliveryStatusCard';
import { OrderItemCard } from '@/components/order/OrderItemCard';
import { FeedbackSheet } from '@/components/feedback/FeedbackSheet';
import { useOrderDetail } from '@/hooks/useOrderDetail';
import { OrderItem, OrderStatus, PaymentStatus, ItemStatus } from '@/types/database';
import { ArrowLeft, Phone, MapPin, Check, Star, MessageCircle, CreditCard, XCircle, Package, ChevronRight, Copy, Truck } from 'lucide-react';
import { format } from 'date-fns';

export default function OrderDetailPage() {
  const { id } = useParams();
  const o = useOrderDetail(id);

  if (o.isLoading) return <AppLayout showHeader={false}><div className="p-4 space-y-3"><Skeleton className="h-8 w-32" /><Skeleton className="h-28 w-full rounded-xl" /><Skeleton className="h-40 w-full rounded-xl" /></div></AppLayout>;
  if (!o.order) return <AppLayout showHeader={false}><div className="p-4 text-center py-16"><p className="text-sm text-muted-foreground">Order not found</p><Link to="/orders"><Button size="sm" className="mt-4">View Orders</Button></Link></div></AppLayout>;

  const order = o.order;
  const seller = o.seller;
  const sellerProfile = seller?.profile;
  const buyer = (order as any).buyer;
  const items = (order as any).items || [];
  const statusInfo = o.getOrderStatus(order.status);
  const paymentStatusInfo = o.getPaymentStatus((order.payment_status as PaymentStatus) || 'pending');
  const displayStatuses = ['placed', 'accepted', 'preparing', 'ready'];

  return (
    <AppLayout showHeader={false} showNav={!o.isSellerView || order.status === 'completed' || order.status === 'cancelled'}>
      <div className="pb-28">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-background border-b border-border px-4 py-3.5 safe-top flex items-center gap-3">
          <Link to="/orders" className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-muted shrink-0"><ArrowLeft size={18} /></Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold">Order Summary</h1>
            <button onClick={o.copyOrderId} className="flex items-center gap-1 text-[11px] text-muted-foreground">#{order.id.slice(0, 8)} <Copy size={10} /></button>
          </div>
          {o.canChat && o.chatRecipientId && (
            <button onClick={() => o.setIsChatOpen(true)} className="relative inline-flex items-center justify-center w-9 h-9 rounded-full bg-muted">
              <MessageCircle size={16} />
              {o.unreadMessages > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">{o.unreadMessages}</span>}
            </button>
          )}
        </div>

        <div className="px-4 pt-3 space-y-3">
          {o.isUrgentOrder && order.auto_cancel_at && <UrgentOrderTimer autoCancelAt={order.auto_cancel_at} onTimeout={o.handleTimeout} />}

          {order.status === 'cancelled' && order.rejection_reason && o.isBuyerView && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 flex items-start gap-2.5">
              <XCircle className="text-destructive shrink-0 mt-0.5" size={16} />
              <div><p className="text-sm font-semibold text-destructive">Order Cancelled</p><p className="text-xs text-muted-foreground mt-0.5">{order.rejection_reason}</p></div>
            </div>
          )}

          {/* Status Timeline */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
              <span className="text-xs text-muted-foreground">{format(new Date(order.created_at), 'MMM d, h:mm a')}</span>
            </div>
            {order.status !== 'cancelled' && (
              <div className="flex items-center justify-between mt-4 gap-1">
                {displayStatuses.map((status, index) => {
                  const statusIndex = o.statusOrder.indexOf(status as OrderStatus);
                  const isCompleted = statusIndex <= o.currentStatusIndex;
                  const isCurrent = statusIndex === o.currentStatusIndex;
                  return (
                    <div key={status} className="flex flex-col items-center flex-1">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold ${isCompleted ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'} ${isCurrent ? 'ring-2 ring-accent ring-offset-1 ring-offset-background' : ''}`}>
                        {isCompleted ? <Check size={14} /> : index + 1}
                      </div>
                      <span className="text-[9px] text-center mt-1 text-muted-foreground leading-tight">{o.getOrderStatus(status as OrderStatus).label}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {order.status !== 'cancelled' && o.isBuyerView && (
              <p className="text-xs text-muted-foreground mt-3 bg-muted/50 rounded-lg px-3 py-2">
                {order.status === 'placed' && '⏳ Waiting for seller to accept.'}
                {order.status === 'accepted' && '✅ Your order has been confirmed.'}
                {order.status === 'preparing' && '👨‍🍳 Your order is being prepared.'}
                {order.status === 'ready' && (o.orderFulfillmentType === 'delivery' ? '📦 Ready for dispatch.' : '📦 Ready for pickup!')}
                {order.status === 'picked_up' && '🚚 On the way!'}
                {order.status === 'delivered' && '🎉 Delivered. Enjoy!'}
                {order.status === 'completed' && '⭐ Completed. Thank you!'}
              </p>
            )}
          </div>

          {/* Payment */}
          <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5"><CreditCard size={16} className="text-muted-foreground" /><p className="text-sm font-medium">{order.payment_type === 'cod' ? 'Cash on Delivery' : 'UPI Payment'}</p></div>
            <span className={`text-[11px] px-2 py-0.5 rounded-full ${paymentStatusInfo.color}`}>{paymentStatusInfo.label}</span>
          </div>

          {o.orderFulfillmentType === 'delivery' && <DeliveryStatusCard orderId={order.id} isBuyerView={o.isBuyerView} />}

          {o.canReorder && (
            <div className="bg-accent/10 border border-accent/20 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5"><Package className="text-accent" size={18} /><div><p className="text-sm font-semibold">Order again?</p><p className="text-[11px] text-muted-foreground">Same items, one tap</p></div></div>
              <ReorderButton orderItems={items} sellerId={order.seller_id} size="sm" />
            </div>
          )}

          {o.isBuyerView && (order.status === 'completed' || order.status === 'delivered') && !localStorage.getItem(`feedback_prompted_${order.id}`) && (
            <div className="bg-secondary/50 border border-border rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5"><span className="text-lg">💬</span><div><p className="text-sm font-semibold">How was your experience?</p><p className="text-[11px] text-muted-foreground">Share feedback</p></div></div>
              <FeedbackSheet triggerLabel="Share" onSubmitted={() => localStorage.setItem(`feedback_prompted_${order.id}`, 'true')} />
            </div>
          )}

          {o.canReview && (
            <div className="bg-warning/10 border border-warning/20 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5"><Star className="text-warning" size={18} /><div><p className="text-sm font-semibold">Rate this order</p><p className="text-[11px] text-muted-foreground">Help others with your review</p></div></div>
              <ReviewForm orderId={order.id} sellerId={order.seller_id} sellerName={seller?.business_name || 'Seller'} onSuccess={() => o.setHasReview(true)} />
            </div>
          )}

          {/* Seller/Buyer Info */}
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{o.isSellerView ? 'Customer' : 'Seller'}</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{o.isSellerView ? buyer?.name : seller?.business_name}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin size={11} />Block {o.isSellerView ? buyer?.block : sellerProfile?.block}, {o.isSellerView ? buyer?.flat_number : sellerProfile?.flat_number}</p>
              </div>
              <a href={`tel:${o.isSellerView ? buyer?.phone : sellerProfile?.phone}`} className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center"><Phone size={16} className="text-accent" /></a>
            </div>
          </div>

          {/* Items */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Items</p>
              {items.length > 1 && <span className="text-[11px] text-muted-foreground">{items.filter((i: OrderItem) => (i.status || 'pending') === 'delivered').length}/{items.length} done</span>}
            </div>
            {items.length > 1 && (
              <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                {(['pending', 'accepted', 'preparing', 'ready', 'delivered', 'cancelled'] as ItemStatus[]).map((status) => {
                  const count = items.filter((i: OrderItem) => (i.status || 'pending') === status).length;
                  if (count === 0) return null;
                  return <span key={status} className={`text-[10px] px-1.5 py-0.5 rounded ${o.getItemStatus(status).color}`}>{count} {o.getItemStatus(status).label}</span>;
                })}
              </div>
            )}
            <div className="space-y-2">
              {items.map((item: OrderItem) => (
                <OrderItemCard key={item.id} item={item} isSellerView={o.isSellerView} orderStatus={order.status} onStatusUpdate={(itemId, newStatus) => {
                  const updatedItems = items.map((i: OrderItem) => i.id === itemId ? { ...i, status: newStatus } : i);
                  o.setOrder({ ...order, items: updatedItems } as any);
                }} />
              ))}
            </div>
            <div className="border-t border-border pt-3 mt-3 space-y-1.5 text-sm">
              {(order as any).discount_amount > 0 && <div className="flex justify-between text-primary"><span>Discount</span><span>-{o.formatPrice((order as any).discount_amount)}</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span>{o.orderFulfillmentType === 'delivery' ? <span className={`font-medium ${(order as any).delivery_fee > 0 ? '' : 'text-primary'}`}>{(order as any).delivery_fee > 0 ? o.formatPrice((order as any).delivery_fee) : 'FREE'}</span> : <span className="text-muted-foreground">Self Pickup</span>}</div>
              <div className="flex justify-between font-bold pt-1 border-t border-border"><span>Total</span><span>{o.formatPrice(order.total_amount)}</span></div>
            </div>
          </div>

          {order.notes && (<div className="bg-card border border-border rounded-xl p-4"><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Instructions</p><p className="text-sm text-muted-foreground">{order.notes}</p></div>)}
        </div>
      </div>

      {/* Seller Action Bar */}
      {o.isSellerView && order.status !== 'completed' && order.status !== 'cancelled' && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border pb-[env(safe-area-inset-bottom)]">
          <div className="px-4 py-3 flex gap-3">
            {order.status === 'placed' && <Button variant="outline" className="flex-1 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground h-12" onClick={() => o.setIsRejectionDialogOpen(true)} disabled={o.isUpdating}><XCircle size={16} className="mr-1.5" />Reject</Button>}
            {o.orderFulfillmentType === 'delivery' && order.status === 'ready' ? (
              <div className="flex-1 flex items-center justify-center gap-2 h-12 text-sm text-muted-foreground"><Truck size={16} className="text-primary" /><span>Awaiting delivery pickup</span></div>
            ) : o.nextStatus ? (
              <Button className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90 h-12" onClick={() => o.updateOrderStatus(o.nextStatus!)} disabled={o.isUpdating}>{o.isUpdating ? 'Updating...' : `Mark ${o.getOrderStatus(o.nextStatus).label}`}<ChevronRight size={14} className="ml-1" /></Button>
            ) : null}
          </div>
        </div>
      )}

      <OrderRejectionDialog open={o.isRejectionDialogOpen} onOpenChange={o.setIsRejectionDialogOpen} onReject={o.handleReject} orderNumber={order.id} />
      {o.chatRecipientId && <OrderChat orderId={order.id} otherUserId={o.chatRecipientId} otherUserName={o.chatRecipientName || 'User'} isOpen={o.isChatOpen} onClose={() => { o.setIsChatOpen(false); o.fetchUnreadCount(); }} disabled={!o.canChat} />}
    </AppLayout>
  );
}
