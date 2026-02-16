import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Minus, Plus, Clock, Store, MapPin, Bell, ChevronRight, Trash2 } from 'lucide-react';
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
import { useSubmitGuard } from '@/hooks/useSubmitGuard';

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

  const firstSeller = sellerGroups[0]?.items[0]?.product?.seller;
  const acceptsCod = firstSeller?.accepts_cod ?? true;
  const acceptsUpi = !!(firstSeller as any)?.accepts_upi && !!(firstSeller as any)?.upi_id;

  const hasUrgentItem = items.some((item) => (item.product as any)?.is_urgent);

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

  const handlePlaceOrderInner = async () => {
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

    setIsPlacingOrder(true);
    try {
      const orderIds = await createOrdersForAllSellers('pending');
      if (orderIds.length === 0) throw new Error('Failed to create orders');

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

  const handlePlaceOrder = useSubmitGuard(handlePlaceOrderInner);

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

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const maxPrepTime = items.reduce((max, item) => {
    const pt = (item.product as any)?.prep_time_minutes;
    return pt && pt > max ? pt : max;
  }, 0);

  if (items.length === 0) {
    return (
      <AppLayout showHeader={false}>
        <div className="p-4">
          <Link to="/" className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-muted mb-6">
            <ArrowLeft size={18} />
          </Link>
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <span className="text-4xl">🛒</span>
            </div>
            <h2 className="text-lg font-bold mb-1">Your cart is empty</h2>
            <p className="text-sm text-muted-foreground mb-6">Discover products from sellers in your community</p>
            <Link to="/search"><Button size="sm">Explore Marketplace</Button></Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout showHeader={false} showNav={false}>
      <div className="pb-36">
        {/* Sticky Header */}
        <div className="sticky top-0 z-30 bg-background border-b border-border px-4 py-3 safe-top flex items-center gap-3">
          <Link to="/" className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted shrink-0">
            <ArrowLeft size={16} />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold">Checkout</h1>
            <p className="text-xs text-muted-foreground">Shipment of {itemCount} item{itemCount !== 1 ? 's' : ''}</p>
          </div>
          <Button variant="ghost" size="sm" className="text-destructive text-xs h-7 px-2" onClick={clearCart}>
            Clear
          </Button>
        </div>

        {/* Delivery Time Card */}
        {maxPrepTime > 0 && (
          <div className="mx-4 mt-3 flex items-center gap-3 bg-accent/50 rounded-xl p-3">
            <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center shrink-0">
              <Clock size={18} className="text-accent-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold">Ready in ~{maxPrepTime} minutes</p>
              <p className="text-xs text-muted-foreground">Estimated preparation time</p>
            </div>
          </div>
        )}

        {/* Urgent Warning */}
        {hasUrgentItem && (
          <div className="mx-4 mt-3 bg-warning/10 border border-warning/30 rounded-xl p-3 flex items-start gap-3">
            <Bell className="text-warning shrink-0 mt-0.5" size={16} />
            <div className="text-xs">
              <p className="font-medium text-warning-foreground">Time-sensitive order</p>
              <p className="text-muted-foreground mt-0.5">Seller must respond within 3 min or auto-cancelled</p>
            </div>
          </div>
        )}

        {/* Cart Items by Seller */}
        <div className="mt-4 space-y-3 px-4">
          {sellerGroups.map((group) => (
            <div key={group.sellerId} className="bg-card rounded-xl border border-border overflow-hidden">
              {/* Seller Row */}
              <div className="px-3 py-2.5 border-b border-border flex items-center gap-2">
                <Store size={14} className="text-primary" />
                <span className="text-sm font-semibold flex-1 truncate">{group.sellerName}</span>
                <span className="text-xs text-muted-foreground">{group.items.length} item{group.items.length > 1 ? 's' : ''}</span>
              </div>

              {/* Cross-society */}
              {profile?.society_id && (group.items[0]?.product?.seller as any)?.society_id &&
                (group.items[0]?.product?.seller as any)?.society_id !== profile.society_id && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground bg-muted">
                  <MapPin size={11} />
                  <span>Seller from another community</span>
                </div>
              )}

              {/* Items */}
              <div className="divide-y divide-border">
                {group.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 px-3 py-3">
                    <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-muted">
                      {item.product?.image_url ? (
                        <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-lg">🛍️</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <VegBadge isVeg={item.product?.is_veg ?? true} size="sm" />
                        <h4 className="text-sm font-medium truncate">{item.product?.name}</h4>
                      </div>
                      <p className="text-sm font-bold mt-0.5">₹{((item.product?.price || 0) * item.quantity).toFixed(0)}</p>
                      <p className="text-[11px] text-muted-foreground">₹{item.product?.price} × {item.quantity}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="inline-flex items-center bg-accent rounded-lg overflow-hidden">
                        <button className="h-8 w-8 flex items-center justify-center active:scale-95 transition-transform" onClick={() => updateQuantity(item.product_id, item.quantity - 1)}>
                          <Minus size={14} className="text-accent-foreground" />
                        </button>
                        <span className="w-6 text-center text-sm font-bold text-accent-foreground">{item.quantity}</span>
                        <button className="h-8 w-8 flex items-center justify-center active:scale-95 transition-transform" onClick={() => updateQuantity(item.product_id, item.quantity + 1)}>
                          <Plus size={14} className="text-accent-foreground" />
                        </button>
                      </div>
                      <button className="h-8 w-8 flex items-center justify-center text-muted-foreground" onClick={() => removeItem(item.product_id)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Notes */}
        <div className="mt-4 px-4">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Instructions</label>
          <Textarea placeholder="e.g., Less spicy, no onions..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="text-sm" />
        </div>

        {/* Payment Method */}
        <div className="mt-5 px-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Payment Method</h3>
          <PaymentMethodSelector acceptsCod={acceptsCod} acceptsUpi={acceptsUpi} selectedMethod={paymentMethod} onSelect={setPaymentMethod} />
        </div>

        {/* Coupon */}
        {sellerGroups.length === 1 && (
          <div className="mt-5 px-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Apply Coupon</h3>
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
        <div className="mt-5 mx-4 bg-muted rounded-xl p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Bill Details</h3>
          <div className="space-y-2 text-sm">
            {sellerGroups.map((group) => (
              <div key={group.sellerId} className="flex justify-between">
                <span className="text-muted-foreground truncate mr-2">{group.sellerName}</span>
                <span className="font-medium">₹{group.subtotal.toFixed(0)}</span>
              </div>
            ))}
            {appliedCoupon && (
              <div className="flex justify-between text-primary">
                <span>Coupon ({appliedCoupon.code})</span>
                <span>-₹{appliedCoupon.discountAmount.toFixed(0)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivery Fee</span>
              <span className="text-primary font-medium">FREE</span>
            </div>
            <div className="border-t border-border pt-2 mt-1 flex justify-between font-bold">
              <span>To Pay</span>
              <span>₹{finalAmount.toFixed(0)}</span>
            </div>
          </div>
        </div>

        {/* Delivery Address */}
        <div className="mt-4 mx-4 bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <MapPin size={16} className="text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deliver to</p>
            <p className="text-sm font-medium mt-0.5">
              {profile?.name} — Block {profile?.block}, Flat {profile?.flat_number}
            </p>
            <p className="text-xs text-muted-foreground">{society?.name || 'Your Society'}</p>
          </div>
          <ChevronRight size={16} className="text-muted-foreground" />
        </div>

        {sellerGroups.length > 1 && (
          <p className="text-xs text-muted-foreground text-center mt-4 px-4">
            Your cart has items from {sellerGroups.length} sellers. Separate orders will be created for each.
          </p>
        )}
      </div>

      {/* Sticky Place Order Footer */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border safe-bottom">
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-bold">₹{finalAmount.toFixed(0)}</p>
          </div>
          <Button
            className="px-8 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-bold"
            size="lg"
            onClick={handlePlaceOrder}
            disabled={isPlacingOrder}
          >
            {isPlacingOrder ? 'Placing...' : 'Place Order'}
            <ChevronRight size={18} className="ml-1" />
          </Button>
        </div>
      </div>

      {/* Razorpay Checkout */}
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
