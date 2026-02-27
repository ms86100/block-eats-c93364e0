import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { PaymentMethod } from '@/types/database';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/contexts/AuthContext';
import { useSubmitGuard } from '@/hooks/useSubmitGuard';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { useCurrency } from '@/hooks/useCurrency';
import { hapticImpact, hapticNotification, hapticSelection } from '@/lib/haptics';
import { toast } from 'sonner';
import { friendlyError } from '@/lib/utils';

export function useCartPage() {
  const navigate = useNavigate();
  const { user, profile, society } = useAuth();
  const { items, totalAmount, sellerGroups, updateQuantity, removeItem, clearCart, refresh, addItem, isLoading } = useCart();
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [showRazorpayCheckout, setShowRazorpayCheckout] = useState(false);
  const [pendingOrderIds, setPendingOrderIds] = useState<string[]>([]);
  const [appliedCoupon, setAppliedCoupon] = useState<{ id: string; code: string; discountAmount: number; discount_type?: string; discount_value?: number; max_discount_amount?: number | null } | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  // #4: Default fulfillment based on seller's fulfillment_mode
  const [fulfillmentType, setFulfillmentType] = useState<'self_pickup' | 'delivery'>('self_pickup');
  const [orderStep, setOrderStep] = useState<'validating' | 'creating' | 'confirming'>('validating');
  const settings = useSystemSettings();
  const { formatPrice, currencySymbol } = useCurrency();

  // #5: Reactively recalculate coupon discount when totalAmount changes
  const effectiveCouponDiscount = (() => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.discount_type === 'percentage' && appliedCoupon.discount_value) {
      let d = (totalAmount * appliedCoupon.discount_value) / 100;
      if (appliedCoupon.max_discount_amount) d = Math.min(d, appliedCoupon.max_discount_amount);
      return Math.round(d * 100) / 100;
    }
    return appliedCoupon.discountAmount;
  })();

  const effectiveDeliveryFee = fulfillmentType === 'delivery' ? (totalAmount >= settings.freeDeliveryThreshold ? 0 : settings.baseDeliveryFee) : 0;
  const finalAmount = (appliedCoupon ? Math.max(0, totalAmount - effectiveCouponDiscount) : totalAmount) + effectiveDeliveryFee;

  const firstSeller = sellerGroups[0]?.items[0]?.product?.seller;
  const firstSellerFulfillmentMode = (firstSeller as any)?.fulfillment_mode as 'self_pickup' | 'seller_delivery' | 'platform_delivery' | 'pickup_and_seller_delivery' | 'pickup_and_platform_delivery' | undefined;
  // #11: For multi-seller carts, ALL sellers must accept COD
  const acceptsCod = sellerGroups.length > 1
    ? sellerGroups.every(g => g.items[0]?.product?.seller?.accepts_cod ?? true)
    : (firstSeller?.accepts_cod ?? true);
  // Disable UPI for multi-seller carts — only the first order would be charged (#2)
  const acceptsUpi = sellerGroups.length <= 1 && !!(firstSeller as any)?.accepts_upi && !!(firstSeller as any)?.upi_id;
  // #3: Check for multi-seller fulfillment mode conflicts
  const hasFulfillmentConflict = sellerGroups.length > 1 && sellerGroups.some(g => {
    const mode = (g.items[0]?.product?.seller as any)?.fulfillment_mode;
    return mode && mode !== 'self_pickup' && !mode.startsWith('pickup_and_') && mode !== fulfillmentType;
  });
  // #9: Check for below-minimum-order sellers
  const hasBelowMinimumOrder = sellerGroups.some(g => {
    const minOrder = (g.items[0]?.product?.seller as any)?.minimum_order_amount;
    return minOrder && g.subtotal < minOrder;
  });
  // #10: Check if no payment method is available
  const noPaymentMethodAvailable = !acceptsCod && !acceptsUpi;

  // #3: Auto-select available payment method
  useEffect(() => {
    if (!acceptsCod && acceptsUpi) setPaymentMethod('upi');
    else if (acceptsCod && !acceptsUpi) setPaymentMethod('cod');
  }, [acceptsCod, acceptsUpi, setPaymentMethod]);
  // #4: Auto-set fulfillment based on seller capability
  useEffect(() => {
    if (sellerGroups.length === 0) return;
    const firstMode = (firstSeller as any)?.fulfillment_mode;
    if (firstMode === 'seller_delivery' || firstMode === 'platform_delivery') setFulfillmentType('delivery');
    else if (firstMode?.startsWith('pickup_and_')) setFulfillmentType('delivery');
    else setFulfillmentType('self_pickup');
  }, [sellerGroups.length, firstSeller]);

  // #22: Clear coupon when switching from single to multi-seller
  useEffect(() => {
    if (sellerGroups.length > 1 && appliedCoupon) {
      setAppliedCoupon(null);
    }
  }, [sellerGroups.length]);

  const hasUrgentItem = items.some((item) => (item.product as any)?.is_urgent);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const maxPrepTime = items.reduce((max, item) => {
    const pt = (item.product as any)?.prep_time_minutes;
    return pt && pt > max ? pt : max;
  }, 0);

  const createOrdersForAllSellers = async (paymentStatus: 'pending' | 'paid', transactionRef?: string) => {
    if (!user || !profile || sellerGroups.length === 0) return [];

    const sellerGroupsPayload = sellerGroups.map((group) => ({
      seller_id: group.sellerId,
      subtotal: group.subtotal,
      items: group.items.map((item) => ({
        product_id: item.product_id,
        product_name: item.product?.name || 'Unknown',
        quantity: item.quantity,
        unit_price: item.product?.price || 0,
      })),
    }));

    const { data, error } = await supabase.rpc('create_multi_vendor_orders', {
      _buyer_id: user.id,
      _delivery_address: [profile.block, profile.flat_number].filter(Boolean).join(', '),
      _notes: notes || null,
      _payment_method: paymentMethod,
      _payment_status: paymentStatus,
      _coupon_id: appliedCoupon?.id || null,
      _coupon_code: appliedCoupon?.code || null,
      _coupon_discount: effectiveCouponDiscount,
      _cart_total: totalAmount,
      _has_urgent: hasUrgentItem,
      _seller_groups: sellerGroupsPayload,
      _fulfillment_type: fulfillmentType,
      _delivery_fee: effectiveDeliveryFee,
    });

    if (error) throw error;

    const result = data as { success: boolean; order_ids?: string[]; order_count?: number; error?: string; unavailable_items?: string[] };
    if (!result?.success) {
      if (result?.error === 'stock_validation_failed' && result?.unavailable_items) {
        const itemList = result.unavailable_items.join('\n• ');
        throw new Error(`Some items are unavailable:\n• ${itemList}`);
      }
      throw new Error('Failed to create orders');
    }

    return result.order_ids || [];
  };

  const handlePlaceOrderInner = async () => {
    if (!user || !profile || sellerGroups.length === 0) return;

    // #6: Validate delivery address before allowing order placement
    if (fulfillmentType === 'delivery' && (!profile.block || !profile.flat_number)) {
      toast.error('Please update your profile with block and flat number before placing a delivery order.');
      return;
    }

    for (const group of sellerGroups) {
      const minOrder = (group.items[0]?.product?.seller as any)?.minimum_order_amount;
      if (minOrder && group.subtotal < minOrder) {
        toast.error(`${group.sellerName} requires a minimum order of ${formatPrice(minOrder)}. Your current total is ${formatPrice(group.subtotal)}.`);
        return;
      }
    }

    setIsPlacingOrder(true);
    setOrderStep('validating');
    hapticImpact('medium');
    try {
      const productIds = items.map(i => i.product_id);
      const { data: freshProducts, error: freshError } = await supabase
        .from('products')
        .select('id, is_available, approval_status, seller_id')
        .in('id', productIds);

      if (freshError) throw freshError;

      const unavailable = items.filter(item => {
        const fresh = freshProducts?.find(p => p.id === item.product_id);
        return !fresh || !fresh.is_available || fresh.approval_status !== 'approved';
      });

      if (unavailable.length > 0) {
        const names = unavailable.map(i => i.product?.name || 'Unknown').join(', ');
        toast.error(`Some items are no longer available: ${names}. Please remove them and try again.`);
        await refresh();
        setIsPlacingOrder(false);
        return;
      }
    } catch (err) {
      console.error('Pre-checkout validation failed:', err);
      toast.error('Could not verify item availability. Please try again.');
      setIsPlacingOrder(false);
      return;
    }

    // #7: Validate payment method matches seller capabilities
    if (paymentMethod === 'cod' && !acceptsCod) {
      toast.error('This seller does not accept Cash on Delivery. Please select UPI.');
      setIsPlacingOrder(false);
      return;
    }

    if (paymentMethod === 'upi') {
      if (!acceptsUpi) {
        toast.error('UPI payment not available for this seller');
        setIsPlacingOrder(false);
        return;
      }
      setOrderStep('creating');
      try {
        const orderIds = await createOrdersForAllSellers('pending');
        if (orderIds.length === 0) throw new Error('Failed to create orders');
        setPendingOrderIds(orderIds);
        setShowRazorpayCheckout(true);
      } catch (error: any) {
        console.error('Error creating orders:', error);
        toast.error(friendlyError(error));
      } finally {
        setIsPlacingOrder(false);
      }
      return;
    }

    setOrderStep('creating');
    try {
      const orderIds = await createOrdersForAllSellers('pending');
      if (orderIds.length === 0) throw new Error('Failed to create orders');
      await clearCart();
      await refresh();
      hapticNotification('success');
      // Trigger immediate push notification to seller (fire-and-forget)
      supabase.functions.invoke('process-notification-queue').catch(() => {});
      if (orderIds.length === 1) {
        toast.success('Order placed successfully!');
        navigate(`/orders/${orderIds[0]}`);
      } else {
        toast.success(`${orderIds.length} orders placed successfully!`);
        navigate('/orders');
      }
    } catch (error: any) {
      console.error('Error placing order:', error);
      toast.error(friendlyError(error));
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handlePlaceOrder = useSubmitGuard(handlePlaceOrderInner);

  const handleRazorpaySuccess = async (_paymentId: string) => {
    setShowRazorpayCheckout(false);
    const targetOrderId = pendingOrderIds[0];
    if (targetOrderId) {
      let confirmed = false;
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 1500));
        const { data } = await supabase.from('orders').select('payment_status').eq('id', targetOrderId).single();
        if (data?.payment_status === 'paid') { confirmed = true; break; }
      }
      if (!confirmed) toast.info('Payment is being verified. Your order will update shortly.');
      else toast.success('Payment successful! Order placed.');
    }
    await clearCart();
    await refresh();
    navigate(pendingOrderIds.length === 1 ? `/orders/${pendingOrderIds[0]}` : '/orders');
    setPendingOrderIds([]);
  };

  const handleRazorpayFailed = async () => {
    setShowRazorpayCheckout(false);
    // #12: Cancel orphaned orders on payment failure
    if (pendingOrderIds.length > 0) {
      try {
        await supabase
          .from('orders')
          .update({ status: 'cancelled' } as any)
          .in('id', pendingOrderIds)
          .eq('payment_status', 'pending');
      } catch (err) {
        console.error('Failed to cancel unpaid orders:', err);
      }
    }
    setPendingOrderIds([]);
    toast.error('Payment was not completed. Your order has been cancelled.');
  };

  return {
    user, profile, society, items, totalAmount, sellerGroups, updateQuantity, removeItem, clearCart, addItem, isLoading,
    notes, setNotes, paymentMethod, setPaymentMethod,
    isPlacingOrder, showRazorpayCheckout, pendingOrderIds,
    appliedCoupon, setAppliedCoupon, showConfirmDialog, setShowConfirmDialog,
    fulfillmentType, setFulfillmentType, orderStep,
    settings, formatPrice, currencySymbol,
    effectiveDeliveryFee, finalAmount, acceptsCod, acceptsUpi,
    hasUrgentItem, itemCount, maxPrepTime,
    effectiveCouponDiscount,
    firstSellerFulfillmentMode,
    hasFulfillmentConflict,
    hasBelowMinimumOrder,
    noPaymentMethodAvailable,
    handlePlaceOrder, handleRazorpaySuccess, handleRazorpayFailed,
    cancelPlacingOrder: () => setIsPlacingOrder(false),
  };
}
