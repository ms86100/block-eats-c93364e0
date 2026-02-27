import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusLabels } from '@/hooks/useStatusLabels';
import { useUrgentOrderSound } from '@/hooks/useUrgentOrderSound';
import { useCurrency } from '@/hooks/useCurrency';
import { logAudit } from '@/lib/audit';
import { Order, OrderStatus } from '@/types/database';
import { toast } from 'sonner';

export function useOrderDetail(id: string | undefined) {
  const { user, isSeller } = useAuth();
  const { getOrderStatus, getPaymentStatus, getItemStatus } = useStatusLabels();
  const { formatPrice } = useCurrency();
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
    if (id) { fetchOrder(); fetchUnreadCount(); }
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
      toast.success(`Order ${getOrderStatus(newStatus).label.toLowerCase()}`);
      // DEFECT 4 FIX: Flush notification queue immediately on seller status change
      supabase.functions.invoke('process-notification-queue').catch(() => {});
      if (order.society_id) {
        logAudit(`order_${newStatus}`, 'order', order.id, order.society_id, { old_status: order.status, new_status: newStatus, rejection_reason: rejectionReason });
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

  const orderFulfillmentType = (order as any)?.fulfillment_type || 'self_pickup';
  const isEnquiryOrder = (order as any)?.order_type === 'enquiry';

  const statusOrder: OrderStatus[] = isEnquiryOrder
    ? ['enquired', 'accepted', 'preparing', 'ready', 'completed']
    : ['placed', 'accepted', 'preparing', 'ready', 'picked_up', 'delivered', 'completed'];

  const currentStatusIndex = statusOrder.indexOf(order?.status || (isEnquiryOrder ? 'enquired' : 'placed'));

  const getNextStatus = (): OrderStatus | null => {
    if (!order || order.status === 'cancelled' || order.status === 'completed') return null;
    if (!isEnquiryOrder && orderFulfillmentType === 'delivery' && order.status === 'ready') return null;
    if (!isEnquiryOrder && orderFulfillmentType !== 'delivery' && order.status === 'ready') return 'completed';
    const nextIndex = currentStatusIndex + 1;
    return nextIndex < statusOrder.length ? statusOrder[nextIndex] : null;
  };

  const isBuyerView = order ? order.buyer_id === user?.id : false;
  const nextStatus = getNextStatus();
  const canReview = isBuyerView && (order?.status === 'completed' || order?.status === 'delivered') && !hasReview;
  const canChat = order ? !['completed', 'cancelled'].includes(order.status) : false;
  const canReorder = isBuyerView && (order?.status === 'completed' || order?.status === 'delivered');
  const chatRecipientId = isSellerView ? order?.buyer_id : seller?.user_id;
  const chatRecipientName = isSellerView ? (order as any)?.buyer?.name : seller?.business_name;

  const copyOrderId = () => {
    if (!order) return;
    navigator.clipboard.writeText(order.id.slice(0, 8));
    toast.success('Order ID copied');
  };

  return {
    order, setOrder, isLoading, isUpdating, hasReview, setHasReview,
    isChatOpen, setIsChatOpen, unreadMessages, fetchUnreadCount,
    isRejectionDialogOpen, setIsRejectionDialogOpen,
    seller, isSellerView, isUrgentOrder, isBuyerView, isEnquiryOrder,
    nextStatus, canReview, canChat, canReorder,
    chatRecipientId, chatRecipientName,
    orderFulfillmentType, currentStatusIndex, statusOrder,
    getOrderStatus, getPaymentStatus, getItemStatus,
    formatPrice, user,
    updateOrderStatus, handleReject, handleTimeout, copyOrderId,
  };
}
