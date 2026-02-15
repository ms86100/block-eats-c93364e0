import { useState } from 'react';
import { Plus, Minus, MessageCircle, Calendar, Phone, ShoppingBag, Send, Home, Handshake } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { VegBadge } from '@/components/ui/veg-badge';
import { useCart } from '@/hooks/useCart';
import { Product, ProductActionType } from '@/types/database';
import { CategoryBehavior } from '@/types/categories';
import { ContactSellerModal } from './ContactSellerModal';
import { cn } from '@/lib/utils';

export interface ProductWithSeller extends Product {
  seller_name?: string;
  seller_rating?: number;
  seller_id: string;
  fulfillment_mode?: string | null;
  delivery_note?: string | null;
}

interface ProductGridCardProps {
  product: ProductWithSeller;
  behavior?: CategoryBehavior | null;
  onTap?: (product: ProductWithSeller) => void;
  className?: string;
}

const ACTION_CONFIG: Record<ProductActionType, { label: string; icon: typeof Plus; isCart: boolean }> = {
  add_to_cart: { label: 'ADD', icon: Plus, isCart: true },
  buy_now: { label: 'BUY', icon: ShoppingBag, isCart: true },
  book: { label: 'Book', icon: Calendar, isCart: false },
  request_service: { label: 'Request', icon: Send, isCart: false },
  request_quote: { label: 'Quote', icon: MessageCircle, isCart: false },
  contact_seller: { label: 'Contact', icon: Phone, isCart: false },
  schedule_visit: { label: 'Visit', icon: Home, isCart: false },
  make_offer: { label: 'Offer', icon: Handshake, isCart: false },
};

export function ProductGridCard({ product, behavior, onTap, className }: ProductGridCardProps) {
  const { items, addItem, updateQuantity } = useCart();
  const [contactOpen, setContactOpen] = useState(false);
  const cartItem = items.find((item) => item.product_id === product.id);
  const quantity = cartItem?.quantity || 0;

  const actionType: ProductActionType = (product as any).action_type || 'add_to_cart';
  const config = ACTION_CONFIG[actionType] || ACTION_CONFIG.add_to_cart;
  // Only treat as cart action if BOTH the action type says so AND the category behavior supports cart
  const isCartAction = config.isCart && (behavior?.supportsCart !== false);

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (actionType === 'contact_seller' && (product as any).contact_phone) {
      setContactOpen(true);
      return;
    }
    if (!isCartAction) {
      onTap?.(product);
      return;
    }
    addItem(product);
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    updateQuantity(product.id, quantity + 1);
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    updateQuantity(product.id, quantity - 1);
  };

  const handleCardClick = () => {
    onTap?.(product);
  };

  const ActionIcon = config.icon;

  return (
    <>
      <div
        onClick={handleCardClick}
        className={cn(
          'bg-card rounded-xl border border-border/60 cursor-pointer transition-shadow hover:shadow-md flex flex-col h-full',
          className
        )}
      >
        {/* Image — Blinkit-style: clean white bg, product centered */}
        <div className="relative p-3 pb-1">
          <div className="relative aspect-square rounded-lg overflow-hidden bg-muted/30">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-contain"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted/50">
                <span className="text-3xl">{isCartAction ? '🛍️' : '🛠️'}</span>
              </div>
            )}

            {!product.is_available && (
              <div className="absolute inset-0 bg-background/70 flex items-center justify-center rounded-lg">
                <span className="text-xs font-medium text-muted-foreground">Out of stock</span>
              </div>
            )}

            {/* Discount / Bestseller badge — top-left like Blinkit */}
            {product.is_bestseller && (
              <Badge className="absolute top-1 left-1 bg-accent text-accent-foreground text-[9px] px-1.5 py-0 h-[18px] font-bold shadow-sm rounded-sm">
                Bestseller
              </Badge>
            )}
          </div>

          {/* Veg badge — top-right */}
          <div className="absolute top-4 right-4">
            <VegBadge isVeg={product.is_veg} size="sm" />
          </div>
        </div>

        {/* Content — Blinkit-style: name, description, then price + ADD at bottom */}
        <div className="px-3 pb-3 pt-1 flex flex-col flex-1 gap-0.5">
          {/* Product name — 2-line clamp */}
          <h4 className="font-semibold text-xs leading-tight line-clamp-2 text-foreground min-h-[2rem]">
            {product.name}
          </h4>

          {/* Description / weight line */}
          {product.description && (
            <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
              {product.description}
            </p>
          )}

          <div className="flex-1" />

          {/* Price + Action row — like Blinkit: price on left, ADD on right */}
          <div className="flex items-end justify-between mt-2 gap-1">
            <div className="flex flex-col">
              {actionType === 'contact_seller' ? (
                <span className="text-[10px] font-medium text-muted-foreground">Contact for price</span>
              ) : (
                <>
                  <span className="font-bold text-sm text-foreground leading-tight">₹{product.price}</span>
                  {/* Placeholder for MRP strikethrough if available */}
                </>
              )}
            </div>

            {/* Action area — only show ADD for cart items, otherwise subtle view prompt */}
            <div className="shrink-0">
              {isCartAction && product.is_available ? (
                quantity === 0 ? (
                  <button
                    onClick={handleAdd}
                    className="border border-success text-success font-bold text-xs px-3 py-1 rounded-md hover:bg-success hover:text-white transition-colors"
                  >
                    ADD
                  </button>
                ) : (
                  <div className="flex items-center bg-success rounded-md overflow-hidden">
                    <button
                      onClick={handleDecrement}
                      className="px-2 py-1 text-white hover:bg-success/80 transition-colors"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="font-bold text-xs text-white px-1 min-w-[16px] text-center">{quantity}</span>
                    <button
                      onClick={handleIncrement}
                      className="px-2 py-1 text-white hover:bg-success/80 transition-colors"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                )
              ) : (
                <span className="text-[10px] font-medium text-primary">
                  {product.is_available ? 'View →' : 'Unavailable'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {actionType === 'contact_seller' && (
        <ContactSellerModal
          open={contactOpen}
          onOpenChange={setContactOpen}
          sellerName={product.seller_name || (product.seller as any)?.business_name || 'Seller'}
          phone={(product as any).contact_phone || ''}
        />
      )}
    </>
  );
}
