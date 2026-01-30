import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Minus, Plus } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { VegBadge } from '@/components/ui/veg-badge';
import { Textarea } from '@/components/ui/textarea';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function CartPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { items, totalAmount, updateQuantity, removeItem, clearCart, currentSellerId } = useCart();
  const [notes, setNotes] = useState('');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  const seller = items[0]?.product?.seller;

  const handlePlaceOrder = async () => {
    if (!user || !profile || !currentSellerId) return;

    setIsPlacingOrder(true);
    try {
      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          buyer_id: user.id,
          seller_id: currentSellerId,
          total_amount: totalAmount,
          payment_type: 'cod',
          delivery_address: `Block ${profile.block}, Flat ${profile.flat_number}`,
          notes: notes || null,
        })
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

      // Clear cart
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
      <div className="p-4">
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

        {/* Bill Details */}
        <div className="mt-6 bg-muted rounded-lg p-4">
          <h3 className="font-semibold mb-3">Bill Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Item Total</span>
              <span>₹{totalAmount.toFixed(0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivery Fee</span>
              <span className="text-success">FREE</span>
            </div>
            <div className="border-t pt-2 mt-2 flex justify-between font-semibold">
              <span>To Pay</span>
              <span>₹{totalAmount.toFixed(0)}</span>
            </div>
          </div>
        </div>

        {/* Delivery Address */}
        <div className="mt-6 bg-card rounded-lg p-4 shadow-sm">
          <h3 className="font-semibold mb-2">Deliver to</h3>
          <p className="text-sm">
            {profile?.name}<br />
            Block {profile?.block}, Flat {profile?.flat_number}<br />
            Shriram Greenfield
          </p>
        </div>

        {/* Payment Method */}
        <div className="mt-4 bg-card rounded-lg p-4 shadow-sm">
          <h3 className="font-semibold mb-2">Payment Method</h3>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-success/20 flex items-center justify-center">
              💵
            </div>
            <span className="text-sm">Cash on Delivery</span>
          </div>
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
          {isPlacingOrder ? 'Placing Order...' : `Place Order • ₹${totalAmount.toFixed(0)}`}
        </Button>
      </div>
    </AppLayout>
  );
}
