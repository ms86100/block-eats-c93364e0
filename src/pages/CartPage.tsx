import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Minus, Plus, Bell, Store, MapPin, Clock } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { VegBadge } from '@/components/ui/veg-badge';
import { Textarea } from '@/components/ui/textarea';
import { PaymentMethodSelector } from '@/components/payment/PaymentMethodSelector';
import { RazorpayCheckout } from '@/components/payment/RazorpayCheckout';
import { CouponInput } from '@/components/cart/CouponInput';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { sendOrderStatusNotification } from '@/lib/notifications';
import { PaymentMethod } from '@/types/database';
import { toast } from 'sonner';

export default function CartPage() {
  const navigate = useNavigate();
  const { user, profile, society } = useAuth();
  const { items, totalAmount, sellerGroups, updateQuantity, removeItem, clearCart, refresh } = useCart();
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [showRazorpayCheckout, setShowRazorpayCheckout] = useState(false);
  const [pendingOrderIds, setPendingOrderIds] = useState<string[]>([]);
  const [appliedCoupon, setAppliedCoupon] = useState<{ id: string; code: string; discountAmount: number } | null>(null);

  const finalAmount = appliedCoupon ? Math.max(0, totalAmount - appliedCoupon.discountAmount) : totalAmount;

  // For single-seller cart, use first seller's payment preferences
  const firstSeller = sellerGroups[0]?.items[0]?.product?.seller;
  const acceptsCod = firstSeller?.accepts_cod ?? true;
  const acceptsUpi = !!(firstSeller as any)?.accepts_upi && !!(firstSeller as any)?.upi_id;

  const hasUrgentItem = items.some((item) => (item.product as any)?.is_urgent);

  const createOrdersForAllSellers = async (paymentStatus: 'pending' | 'paid', transactionRef?: string) => {
    if (!user || !profile || sellerGroups.length === 0) return [];

    // Build seller_groups payload for the atomic RPC
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
      _delivery_address: `Block ${profile.block}, Flat ${profile.flat_number}`,
      _notes: notes || null,
      _payment_method: paymentMethod,
      _payment_status: paymentStatus,
      _coupon_id: appliedCoupon?.id || null,
      _coupon_code: appliedCoupon?.code || null,
      _coupon_discount: appliedCoupon?.discountAmount || 0,
      _cart_total: totalAmount,
      _has_urgent: hasUrgentItem,
      _seller_groups: sellerGroupsPayload,
    });

    if (error) throw error;

    const result = data as { success: boolean; order_ids: string[]; order_count: number };
    if (!result?.success) throw new Error('Failed to create orders');

    const createdOrderIds = result.order_ids;

    // Send notifications (non-critical, fire-and-forget)
    for (const group of sellerGroups) {
      const sellerProfile = group.items[0]?.product?.seller;
      if (sellerProfile?.user_id) {
        const orderId = createdOrderIds[sellerGroups.indexOf(group)];
        if (orderId) {
          sendOrderStatusNotification(
            orderId, 'placed', user.id, group.sellerId,
            sellerProfile.user_id,
            sellerProfile.business_name || 'Seller',
            profile.name
          );
        }
      }
    }

    return createdOrderIds;
  };

  const handlePlaceOrder = async () => {
    if (!user || !profile || sellerGroups.length === 0) return;

    if (paymentMethod === 'upi') {
      if (!acceptsUpi) {
        toast.error('UPI payment not available for this seller');
        return;
      }
      setIsPlacingOrder(true);
      try {
        const orderIds = await createOrdersForAllSellers('pending');
        if (orderIds.length === 0) throw new Error('Failed to create orders');
        setPendingOrderIds(orderIds);
        setShowRazorpayCheckout(true);
      } catch (error: any) {
        console.error('Error creating orders:', error);
        toast.error(error.message || 'Failed to create order');
      } finally {
        setIsPlacingOrder(false);
      }
      return;
    }

    // COD flow
    setIsPlacingOrder(true);
    try {
      const orderIds = await createOrdersForAllSellers('pending');
      if (orderIds.length === 0) throw new Error('Failed to create orders');

      // Cart already cleared by RPC, just refresh local state
      await refresh();
      if (orderIds.length === 1) {
        toast.success('Order placed successfully!');
        navigate(`/orders/${orderIds[0]}`);
      } else {
        toast.success(`${orderIds.length} orders placed successfully!`);
        navigate('/orders');
      }
    } catch (error: any) {
      console.error('Error placing order:', error);
      toast.error(error.message || 'Failed to place order');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handleRazorpaySuccess = async (paymentId: string) => {
    setShowRazorpayCheckout(false);

    for (const orderId of pendingOrderIds) {
      await supabase.from('orders').update({ payment_status: 'paid', razorpay_payment_id: paymentId } as any).eq('id', orderId);
      await supabase.from('payment_records').update({ payment_status: 'paid', transaction_reference: paymentId }).eq('order_id', orderId);
    }

    await refresh();
    toast.success('Payment successful! Order placed.');
    navigate(pendingOrderIds.length === 1 ? `/orders/${pendingOrderIds[0]}` : '/orders');
    setPendingOrderIds([]);
  };

  const handleRazorpayFailed = () => {
    setShowRazorpayCheckout(false);
    for (const orderId of pendingOrderIds) {
      supabase.from('orders').update({ status: 'cancelled', payment_status: 'failed' }).eq('id', orderId);
    }
    setPendingOrderIds([]);
    toast.error('Payment failed. Please try again.');
  };

  if (items.length === 0) {
    return (
      <AppLayout showHeader={false}>
        <div className="p-4">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground mb-8">
            <ArrowLeft size={20} />
            <span>Back</span>
          </Link>
          <div className="text-center py-12">
            <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <span className="text-5xl">🛒</span>
            </div>
            <h2 className="text-xl font-bold mb-2">Your cart is empty</h2>
            <p className="text-muted-foreground mb-6">Discover products from sellers in your community</p>
            <Link to="/search"><Button>Explore Marketplace</Button></Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Compute max prep time across all items
  const maxPrepTime = items.reduce((max, item) => {
    const pt = (item.product as any)?.prep_time_minutes;
    return pt && pt > max ? pt : max;
  }, 0);

  return (
    <AppLayout showHeader={false} showNav={false}>
      <div className="p-4 pb-32">
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground">
            <ArrowLeft size={20} />
            <span>Back</span>
          </Link>
          <Button variant="ghost" size="sm" className="text-destructive" onClick={clearCart}>
            Clear Cart
          </Button>
        </div>

        {/* Urgent Item Warning */}
        {hasUrgentItem && (
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 mb-4 flex items-start gap-3">
            <Bell className="text-warning shrink-0 mt-0.5" size={18} />
            <div className="text-sm">
              <p className="font-medium text-warning-foreground">Time-sensitive order</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                Seller must respond within 3 minutes or order will be auto-cancelled
              </p>
            </div>
          </div>
        )}

        {/* Cart Items Grouped by Seller */}
        <div className="space-y-4">
          {sellerGroups.map((group) => (
            <div key={group.sellerId} className="space-y-3">
              {/* Seller Header */}
              <div className="bg-muted rounded-lg p-3 flex items-center gap-2">
                <Store size={16} className="text-primary" />
                <div className="flex-1">
                  <h3 className="font-semibold text-sm">{group.sellerName}</h3>
                  <p className="text-xs text-muted-foreground">
                    {group.items.length} item{group.items.length > 1 ? 's' : ''} • ₹{group.subtotal.toFixed(0)}
                  </p>
                </div>
              </div>
              {/* Cross-society indicator */}
              {profile?.society_id && (group.items[0]?.product?.seller as any)?.society_id &&
                (group.items[0]?.product?.seller as any)?.society_id !== profile.society_id && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground bg-accent/50 rounded-lg">
                  <MapPin size={12} />
                  <span>Seller from another community</span>
                </div>
              )}

              {/* Items for this seller */}
              {group.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 bg-card rounded-lg p-3 shadow-sm">
                  <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0">
                    {item.product?.image_url ? (
                      <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <span className="text-xl">🛍️</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <VegBadge isVeg={item.product?.is_veg ?? true} size="sm" />
                      <div className="min-w-0">
                        <h4 className="font-medium text-sm truncate">{item.product?.name}</h4>
                        <p className="text-sm font-semibold mt-0.5">₹{item.product?.price}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center border rounded-md">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => updateQuantity(item.product_id, item.quantity - 1)}>
                        <Minus size={14} />
                      </Button>
                      <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => updateQuantity(item.product_id, item.quantity + 1)}>
                        <Plus size={14} />
                      </Button>
                    </div>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeItem(item.product_id)}>
                      <Trash2 size={18} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Notes */}
        <div className="mt-6">
          <label className="text-sm font-medium mb-2 block">Add cooking instructions or notes</label>
          <Textarea placeholder="e.g., Less spicy, no onions..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>

        {/* Payment Method */}
        <div className="mt-6">
          <h3 className="font-semibold mb-3">Payment Method</h3>
          <PaymentMethodSelector acceptsCod={acceptsCod} acceptsUpi={acceptsUpi} selectedMethod={paymentMethod} onSelect={setPaymentMethod} />
        </div>

        {/* Coupon - only show for single-seller carts */}
        {sellerGroups.length === 1 && (
          <div className="mt-6">
            <h3 className="font-semibold mb-3">Apply Coupon</h3>
            <CouponInput
              sellerId={sellerGroups[0].sellerId}
              totalAmount={totalAmount}
              onApply={setAppliedCoupon}
              onRemove={() => setAppliedCoupon(null)}
              appliedCoupon={appliedCoupon}
            />
          </div>
        )}

        {/* Bill Details */}
        <div className="mt-6 bg-muted rounded-lg p-4">
          <h3 className="font-semibold mb-3">Bill Details</h3>
          <div className="space-y-2 text-sm">
            {sellerGroups.map((group) => (
              <div key={group.sellerId} className="flex justify-between">
                <span className="text-muted-foreground truncate mr-2">{group.sellerName}</span>
                <span>₹{group.subtotal.toFixed(0)}</span>
              </div>
            ))}
            {appliedCoupon && (
              <div className="flex justify-between text-primary">
                <span>Coupon Discount ({appliedCoupon.code})</span>
                <span>-₹{appliedCoupon.discountAmount.toFixed(0)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivery Fee</span>
              <span className="text-primary font-medium">FREE</span>
            </div>
            <div className="border-t pt-2 mt-2 flex justify-between font-semibold">
              <span>To Pay</span>
              <span>₹{finalAmount.toFixed(0)}</span>
            </div>
            {maxPrepTime > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                <Clock size={12} />
                <span>Estimated ready time: ~{maxPrepTime} min</span>
              </div>
            )}
          </div>
        </div>

        {/* Delivery Address */}
        <div className="mt-6 bg-card rounded-lg p-4 shadow-sm">
          <h3 className="font-semibold mb-2">Deliver to</h3>
          <p className="text-sm">
            {profile?.name}<br />
            Block {profile?.block}, Flat {profile?.flat_number}<br />
            {society?.name || 'Your Society'}
          </p>
        </div>

        {sellerGroups.length > 1 && (
          <p className="text-xs text-muted-foreground text-center mt-4">
            Your cart has items from {sellerGroups.length} sellers. Separate orders will be created for each.
          </p>
        )}
      </div>

      {/* Place Order Footer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-card border-t safe-bottom">
        <Button className="w-full" size="lg" onClick={handlePlaceOrder} disabled={isPlacingOrder}>
          {isPlacingOrder ? 'Placing Order...' : `Place Order • ₹${finalAmount.toFixed(0)}`}
        </Button>
      </div>

      {/* Razorpay Checkout - use first order for payment */}
      {pendingOrderIds.length > 0 && (
        <RazorpayCheckout
          isOpen={showRazorpayCheckout}
          onClose={() => { setShowRazorpayCheckout(false); handleRazorpayFailed(); }}
          orderId={pendingOrderIds[0]}
          amount={finalAmount}
          sellerId={sellerGroups[0]?.sellerId || ''}
          sellerName={sellerGroups[0]?.sellerName || 'Seller'}
          customerName={profile?.name || ''}
          customerEmail={user?.email || ''}
          customerPhone={profile?.phone || ''}
          onPaymentSuccess={handleRazorpaySuccess}
          onPaymentFailed={handleRazorpayFailed}
        />
      )}
    </AppLayout>
  );
}
