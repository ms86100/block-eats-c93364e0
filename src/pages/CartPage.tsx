import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Minus, Plus, AlertTriangle, Bell } from 'lucide-react';
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
  const { items, totalAmount, updateQuantity, removeItem, clearCart, currentSellerId } = useCart();
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [showRazorpayCheckout, setShowRazorpayCheckout] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<{ id: string; code: string; discountAmount: number } | null>(null);

  const finalAmount = appliedCoupon ? Math.max(0, totalAmount - appliedCoupon.discountAmount) : totalAmount;

  const seller = items[0]?.product?.seller;
  const acceptsCod = seller?.accepts_cod ?? true;
  const acceptsUpi = !!(seller as any)?.accepts_upi && !!(seller as any)?.upi_id;

  // Check if any item has urgent notification enabled
  const hasUrgentItem = items.some((item) => (item.product as any)?.is_urgent);

  const createOrder = async (paymentStatus: 'pending' | 'paid', transactionRef?: string) => {
    if (!user || !profile || !currentSellerId) return null;

    // Generate idempotency key to prevent duplicate orders
    const idempotencyKey = crypto.randomUUID();

    // Calculate auto_cancel_at if any item is urgent (3 minutes from now)
    const autoCancelAt = hasUrgentItem 
      ? new Date(Date.now() + 3 * 60 * 1000).toISOString() 
      : null;

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        buyer_id: user.id,
        seller_id: currentSellerId,
        total_amount: finalAmount,
        coupon_id: appliedCoupon?.id || null,
        discount_amount: appliedCoupon?.discountAmount || 0,
        payment_type: paymentMethod,
        payment_status: paymentStatus,
        delivery_address: `Block ${profile.block}, Flat ${profile.flat_number}`,
        notes: notes || null,
        auto_cancel_at: autoCancelAt,
        idempotency_key: idempotencyKey,
      } as any)
      .select()
      .single();

    if (orderError) throw orderError;

    // Create order items
    const orderItems = items.map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      product_name: item.product?.name || 'Unknown',
      quantity: item.quantity,
      unit_price: item.product?.price || 0,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) throw itemsError;

    // Create payment record
    const { error: paymentError } = await supabase
      .from('payment_records')
      .insert({
        order_id: order.id,
        buyer_id: user.id,
        seller_id: currentSellerId,
        amount: finalAmount,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        transaction_reference: transactionRef || null,
        platform_fee: 0,
        net_amount: finalAmount,
      });

    if (paymentError) throw paymentError;

    // Send push notification to seller about new order
    if (seller?.user_id) {
      sendOrderStatusNotification(
        order.id,
        'placed',
        user.id,
        currentSellerId,
        seller.user_id,
        seller.business_name || 'Seller',
        profile.name
      );
    }

    // Record coupon redemption
    if (appliedCoupon) {
      await supabase.from('coupon_redemptions').insert({
        coupon_id: appliedCoupon.id,
        user_id: user.id,
        order_id: order.id,
        discount_applied: appliedCoupon.discountAmount,
      });
    }

    return order;
  };

  const handlePlaceOrder = async () => {
    if (!user || !profile || !currentSellerId) return;

    if (paymentMethod === 'upi') {
      if (!acceptsUpi) {
        toast.error('UPI payment not available for this seller');
        return;
      }
      // Create order first, then open Razorpay
      setIsPlacingOrder(true);
      try {
        const order = await createOrder('pending');
        if (!order) throw new Error('Failed to create order');
        setPendingOrderId(order.id);
        setShowRazorpayCheckout(true);
      } catch (error: any) {
        console.error('Error creating order:', error);
        toast.error(error.message || 'Failed to create order');
      } finally {
        setIsPlacingOrder(false);
      }
      return;
    }

    // COD flow
    setIsPlacingOrder(true);
    try {
      const order = await createOrder('pending');
      if (!order) throw new Error('Failed to create order');
      
      await clearCart();
      toast.success('Order placed successfully!');
      navigate(`/orders/${order.id}`);
    } catch (error: any) {
      console.error('Error placing order:', error);
      toast.error(error.message || 'Failed to place order');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handleRazorpaySuccess = async (paymentId: string) => {
    setShowRazorpayCheckout(false);
    
    // Update order with payment details
    if (pendingOrderId) {
      await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          razorpay_payment_id: paymentId,
        } as any)
        .eq('id', pendingOrderId);

      await supabase
        .from('payment_records')
        .update({
          payment_status: 'paid',
          transaction_reference: paymentId,
        })
        .eq('order_id', pendingOrderId);
    }
    
    await clearCart();
    toast.success('Payment successful! Order placed.');
    navigate(`/orders/${pendingOrderId}`);
    setPendingOrderId(null);
  };

  const handleRazorpayFailed = () => {
    setShowRazorpayCheckout(false);
    // Cancel the pending order
    if (pendingOrderId) {
      supabase
        .from('orders')
        .update({ status: 'cancelled', payment_status: 'failed' })
        .eq('id', pendingOrderId);
    }
    setPendingOrderId(null);
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
            <p className="text-muted-foreground mb-6">
              Add items from your favorite sellers
            </p>
            <Link to="/">
              <Button>Browse Sellers</Button>
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout showHeader={false} showNav={false}>
      <div className="p-4 pb-32">
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground">
            <ArrowLeft size={20} />
            <span>Back</span>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={clearCart}
          >
            Clear Cart
          </Button>
        </div>

        {/* Seller Info */}
        {seller && (
          <div className="bg-muted rounded-lg p-3 mb-4">
            <h3 className="font-semibold">{seller.business_name}</h3>
            <p className="text-sm text-muted-foreground">
              {items.length} item{items.length > 1 ? 's' : ''}
            </p>
          </div>
        )}

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

        {/* Cart Items */}
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 bg-card rounded-lg p-3 shadow-sm"
            >
              <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0">
                {item.product?.image_url ? (
                  <img
                    src={item.product.image_url}
                    alt={item.product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <span className="text-xl">🍽️</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2">
                  <VegBadge isVeg={item.product?.is_veg || true} size="sm" />
                  <div className="min-w-0">
                    <h4 className="font-medium text-sm truncate">
                      {item.product?.name}
                    </h4>
                    <p className="text-sm font-semibold mt-0.5">
                      ₹{item.product?.price}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center border rounded-md">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={() =>
                      updateQuantity(item.product_id, item.quantity - 1)
                    }
                  >
                    <Minus size={14} />
                  </Button>
                  <span className="w-6 text-center text-sm font-medium">
                    {item.quantity}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={() =>
                      updateQuantity(item.product_id, item.quantity + 1)
                    }
                  >
                    <Plus size={14} />
                  </Button>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => removeItem(item.product_id)}
                >
                  <Trash2 size={18} />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Notes */}
        <div className="mt-6">
          <label className="text-sm font-medium mb-2 block">
            Add cooking instructions or notes
          </label>
          <Textarea
            placeholder="e.g., Less spicy, no onions..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>

        {/* Payment Method */}
        <div className="mt-6">
          <h3 className="font-semibold mb-3">Payment Method</h3>
          <PaymentMethodSelector
            acceptsCod={acceptsCod}
            acceptsUpi={acceptsUpi}
            selectedMethod={paymentMethod}
            onSelect={setPaymentMethod}
          />
        </div>

        {/* Coupon */}
        <div className="mt-6">
          <h3 className="font-semibold mb-3">Apply Coupon</h3>
          <CouponInput
            sellerId={currentSellerId || ''}
            totalAmount={totalAmount}
            onApply={setAppliedCoupon}
            onRemove={() => setAppliedCoupon(null)}
            appliedCoupon={appliedCoupon}
          />
        </div>

        {/* Bill Details */}
        <div className="mt-6 bg-muted rounded-lg p-4">
          <h3 className="font-semibold mb-3">Bill Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Item Total</span>
              <span>₹{totalAmount.toFixed(0)}</span>
            </div>
            {appliedCoupon && (
              <div className="flex justify-between text-primary">
                <span>Coupon Discount ({appliedCoupon.code})</span>
                <span>-₹{appliedCoupon.discountAmount.toFixed(0)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivery Fee</span>
              <span className="text-success">FREE</span>
            </div>
            <div className="border-t pt-2 mt-2 flex justify-between font-semibold">
              <span>To Pay</span>
              <span>₹{finalAmount.toFixed(0)}</span>
            </div>
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
      </div>

      {/* Place Order Footer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-card border-t safe-bottom">
        <Button
          className="w-full"
          size="lg"
          onClick={handlePlaceOrder}
          disabled={isPlacingOrder}
        >
          {isPlacingOrder ? 'Placing Order...' : `Place Order • ₹${finalAmount.toFixed(0)}`}
        </Button>
      </div>

      {/* Razorpay Checkout */}
      {pendingOrderId && (
        <RazorpayCheckout
          isOpen={showRazorpayCheckout}
          onClose={() => {
            setShowRazorpayCheckout(false);
            handleRazorpayFailed();
          }}
          orderId={pendingOrderId}
          amount={finalAmount}
          sellerId={currentSellerId || ''}
          sellerName={seller?.business_name || 'Seller'}
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
