import { Link } from 'react-router-dom';
import { ArrowLeft, Minus, Plus, Clock, Store, MapPin, Bell, ChevronRight, Trash2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { VegBadge } from '@/components/ui/veg-badge';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { PaymentMethodSelector } from '@/components/payment/PaymentMethodSelector';
import { RazorpayCheckout } from '@/components/payment/RazorpayCheckout';
import { CouponInput } from '@/components/cart/CouponInput';
import { FulfillmentSelector } from '@/components/delivery/FulfillmentSelector';
import { OrderProgressOverlay } from '@/components/checkout/OrderProgressOverlay';
import { useCartPage } from '@/hooks/useCartPage';
import { hapticImpact } from '@/lib/haptics';
import { toast } from 'sonner';

export default function CartPage() {
  const c = useCartPage();

  if (c.items.length === 0) {
    return (
      <AppLayout showHeader={false}>
        <div className="p-4 safe-top">
          <Link to="/" className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-muted mb-6"><ArrowLeft size={18} /></Link>
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center"><span className="text-4xl">🛒</span></div>
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
      <div className="pb-44">
        {/* Sticky Header */}
        <div className="sticky top-0 z-30 bg-background border-b border-border px-4 py-3.5 safe-top flex items-center gap-3">
          <Link to="/" className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-muted shrink-0"><ArrowLeft size={18} /></Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold">Checkout</h1>
            <p className="text-xs text-muted-foreground">Shipment of {c.itemCount} item{c.itemCount !== 1 ? 's' : ''}</p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive text-xs h-7 px-2">Clear</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Clear cart?</AlertDialogTitle><AlertDialogDescription>This will remove all items from your cart. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={c.clearCart} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Clear All</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Delivery Time */}
        {c.maxPrepTime > 0 && (
          <div className="mx-4 mt-3 flex items-center gap-3 bg-primary/5 border border-primary/15 rounded-xl p-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><Clock size={18} className="text-primary" /></div>
            <div><p className="text-sm font-semibold">Ready in ~{c.maxPrepTime} minutes</p><p className="text-xs text-muted-foreground">Estimated preparation time</p></div>
          </div>
        )}

        {/* Urgent Warning */}
        {c.hasUrgentItem && (
          <div className="mx-4 mt-3 bg-warning/10 border border-warning/30 rounded-xl p-3 flex items-start gap-3">
            <Bell className="text-warning shrink-0 mt-0.5" size={16} />
            <div className="text-xs"><p className="font-medium text-warning-foreground">Time-sensitive order</p><p className="text-muted-foreground mt-0.5">Seller must respond within 3 min or auto-cancelled</p></div>
          </div>
        )}

        {/* Min order warnings */}
        {c.sellerGroups.map((group) => {
          const minOrder = (group.items[0]?.product?.seller as any)?.minimum_order_amount;
          const belowMinimum = minOrder && group.subtotal < minOrder;
          if (!belowMinimum) return null;
          return (
            <div key={`warn-${group.sellerId}`} className="mx-4 mt-3">
              <div className="bg-warning/10 border border-warning/30 rounded-xl p-3 flex items-start gap-3">
                <Store className="text-warning shrink-0 mt-0.5" size={16} />
                <div className="text-xs"><p className="font-medium text-warning-foreground">{group.sellerName}: Minimum order {c.formatPrice(minOrder)}</p><p className="text-muted-foreground mt-0.5">Add {c.formatPrice(minOrder - group.subtotal)} more to place this order</p></div>
              </div>
            </div>
          );
        })}

        {/* Cart Items by Seller */}
        <div className="mt-4 space-y-3 px-4">
          {c.sellerGroups.map((group) => (
            <div key={group.sellerId} className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="px-3 py-2.5 border-b border-border flex items-center gap-2">
                <Store size={14} className="text-primary" />
                <span className="text-sm font-semibold flex-1 truncate">{group.sellerName}</span>
                <span className="text-xs text-muted-foreground">{group.items.length} item{group.items.length > 1 ? 's' : ''}</span>
              </div>
              {c.profile?.society_id && (group.items[0]?.product?.seller as any)?.society_id && (group.items[0]?.product?.seller as any)?.society_id !== c.profile.society_id && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground bg-muted"><MapPin size={11} /><span>Seller from another community</span></div>
              )}
              <div className="divide-y divide-border">
                {group.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 px-3 py-3">
                    <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-muted">
                      {item.product?.image_url ? <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-lg">🛍️</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5"><VegBadge isVeg={item.product?.is_veg ?? true} size="sm" /><h4 className="text-sm font-medium truncate">{item.product?.name}</h4></div>
                      <p className="text-sm font-bold mt-0.5">{c.formatPrice((item.product?.price || 0) * item.quantity)}</p>
                      <p className="text-[11px] text-muted-foreground">{c.formatPrice(item.product?.price || 0)} × {item.quantity}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="inline-flex items-center bg-accent rounded-lg overflow-hidden">
                        <button className="h-8 w-8 flex items-center justify-center active:scale-95 transition-transform" onClick={() => { hapticImpact('medium'); c.updateQuantity(item.product_id, item.quantity - 1); }}><Minus size={14} className="text-accent-foreground" /></button>
                        <span className="w-6 text-center text-sm font-bold text-accent-foreground tabular-nums">{item.quantity}</span>
                        <button className="h-8 w-8 flex items-center justify-center active:scale-95 transition-transform" onClick={() => { hapticImpact('medium'); c.updateQuantity(item.product_id, item.quantity + 1); }}><Plus size={14} className="text-accent-foreground" /></button>
                      </div>
                      <button className="h-8 w-8 flex items-center justify-center text-muted-foreground" onClick={() => { hapticImpact('medium'); const name = item.product?.name || 'Item'; c.removeItem(item.product_id); toast(`${name} removed`, { action: { label: 'Undo', onClick: () => c.addItem(item.product as any) }, duration: 4000 }); }}><Trash2 size={15} /></button>
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
          <Textarea placeholder="e.g., Less spicy, no onions..." value={c.notes} onChange={(e) => c.setNotes(e.target.value)} rows={2} className="text-sm" />
        </div>

        {/* Payment Method */}
        <div className="mt-5 px-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Payment Method</h3>
          <PaymentMethodSelector acceptsCod={c.acceptsCod} acceptsUpi={c.acceptsUpi} selectedMethod={c.paymentMethod} onSelect={c.setPaymentMethod} />
        </div>

        {/* Fulfillment */}
        <div className="mt-5 px-4">
          <FulfillmentSelector value={c.fulfillmentType} onChange={c.setFulfillmentType} deliveryFee={c.settings.baseDeliveryFee} freeDeliveryThreshold={c.settings.freeDeliveryThreshold} orderValue={c.totalAmount} />
        </div>

        {/* Coupon */}
        {c.sellerGroups.length === 1 ? (
          <div className="mt-5 px-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Apply Coupon</h3>
            <CouponInput sellerId={c.sellerGroups[0].sellerId} totalAmount={c.totalAmount} onApply={c.setAppliedCoupon} onRemove={() => c.setAppliedCoupon(null)} appliedCoupon={c.appliedCoupon} />
          </div>
        ) : c.sellerGroups.length > 1 ? (
          <div className="mt-5 px-4"><p className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">Coupons are not available for multi-seller carts.</p></div>
        ) : null}

        {/* Bill Details */}
        <div className="mt-5 mx-4 bg-muted rounded-xl p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Bill Details</h3>
          <div className="space-y-2 text-sm">
            {c.sellerGroups.map((group) => (<div key={group.sellerId} className="flex justify-between"><span className="text-muted-foreground truncate mr-2">{group.sellerName}</span><span className="font-medium">{c.formatPrice(group.subtotal)}</span></div>))}
            {c.appliedCoupon && (<div className="flex justify-between text-primary"><span>Coupon ({c.appliedCoupon.code})</span><span>-{c.formatPrice(c.appliedCoupon.discountAmount)}</span></div>)}
            <div className="flex justify-between"><span className="text-muted-foreground">Delivery Fee</span><span className={`font-medium ${c.effectiveDeliveryFee === 0 ? 'text-primary' : ''}`}>{c.fulfillmentType === 'delivery' ? (c.effectiveDeliveryFee === 0 ? 'FREE' : c.formatPrice(c.effectiveDeliveryFee)) : 'Self Pickup'}</span></div>
            <div className="border-t border-border pt-2 mt-1 flex justify-between font-bold"><span>To Pay</span><span>{c.formatPrice(c.finalAmount)}</span></div>
          </div>
        </div>

        {/* Address */}
        <div className="mt-4 mx-4 bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <MapPin size={16} className="text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            {c.fulfillmentType === 'self_pickup' ? (
              <><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pickup from</p><p className="text-sm font-medium mt-0.5">{c.sellerGroups[0]?.sellerName || 'Seller'}</p><p className="text-xs text-muted-foreground">{c.society?.name || 'Your Society'}</p></>
            ) : (
              <><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deliver to</p><p className="text-sm font-medium mt-0.5">{c.profile?.name} — {[c.profile?.block, c.profile?.flat_number].filter(Boolean).join(', ')}</p><p className="text-xs text-muted-foreground">{c.society?.name || 'Your Society'}</p></>
            )}
          </div>
          <ChevronRight size={16} className="text-muted-foreground" />
        </div>

        {c.sellerGroups.length > 1 && (<p className="text-xs text-muted-foreground text-center mt-4 px-4">Your cart has items from {c.sellerGroups.length} sellers. Separate orders will be created for each.</p>)}
      </div>

      {/* Sticky Footer */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border pb-[env(safe-area-inset-bottom)]">
        {c.sellerGroups.length > 0 && (
          <p className="text-[11px] text-primary font-medium text-center pt-2.5 px-4 flex items-center justify-center gap-1.5">
            <span className="text-base">💚</span>
            This order supports {c.sellerGroups.length} local business{c.sellerGroups.length !== 1 ? 'es' : ''} in your community
          </p>
        )}
        <p className="text-[10px] text-muted-foreground text-center pt-1 px-4">Payments are processed by third-party providers and are not covered by Apple. <Link to="/terms" className="underline">Refund & Cancellation Policy</Link></p>
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="flex-1"><p className="text-xs text-muted-foreground">Total</p><p className="text-lg font-bold tabular-nums">{c.formatPrice(c.finalAmount)}</p></div>
          <Button className="px-8 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold" size="lg" onClick={() => c.setShowConfirmDialog(true)} disabled={c.isPlacingOrder}>{c.isPlacingOrder ? 'Placing...' : 'Place Order'}<ChevronRight size={18} className="ml-1" /></Button>
        </div>
      </div>

      {/* Confirm Dialog */}
      <AlertDialog open={c.showConfirmDialog} onOpenChange={c.setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Your Order</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Items</span><span className="font-medium">{c.itemCount} item{c.itemCount !== 1 ? 's' : ''}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Payment</span><span className="font-medium">{c.paymentMethod === 'cod' ? 'Cash on Delivery' : 'UPI'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{c.fulfillmentType === 'self_pickup' ? 'Pickup from' : 'Deliver to'}</span><span className="font-medium text-right">{c.fulfillmentType === 'self_pickup' ? c.sellerGroups[0]?.sellerName || 'Seller' : `${c.profile?.block}, ${c.profile?.flat_number}`}</span></div>
                {c.sellerGroups.length > 1 && <p className="text-xs text-muted-foreground">{c.sellerGroups.length} separate orders will be created.</p>}
                <div className="flex justify-between border-t border-border pt-2 font-bold"><span>Total</span><span>{c.formatPrice(c.finalAmount)}</span></div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Review Cart</AlertDialogCancel><AlertDialogAction onClick={c.handlePlaceOrder}>Confirm Order</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <OrderProgressOverlay isVisible={c.isPlacingOrder} step={c.orderStep} />

      {c.pendingOrderIds.length > 0 && (
        <RazorpayCheckout isOpen={c.showRazorpayCheckout} onClose={() => c.handleRazorpayFailed()} orderId={c.pendingOrderIds[0]} amount={c.finalAmount} sellerId={c.sellerGroups[0]?.sellerId || ''} sellerName={c.sellerGroups[0]?.sellerName || 'Seller'} customerName={c.profile?.name || ''} customerEmail={c.user?.email || ''} customerPhone={c.profile?.phone || ''} onPaymentSuccess={c.handleRazorpaySuccess} onPaymentFailed={c.handleRazorpayFailed} />
      )}
    </AppLayout>
  );
}
