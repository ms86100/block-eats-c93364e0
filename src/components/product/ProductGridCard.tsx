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

  // Product-level action_type overrides category behavior
  const actionType: ProductActionType = (product as any).action_type || 'add_to_cart';
  const config = ACTION_CONFIG[actionType] || ACTION_CONFIG.add_to_cart;
  const isCartAction = config.isCart;

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
          'bg-card rounded-xl overflow-hidden border border-border/40 cursor-pointer transition-all hover:shadow-md flex flex-col',
          className
        )}
      >
        {/* Image */}
        <div className="relative aspect-square bg-muted">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-3xl">{isCartAction ? '🛍️' : '🛠️'}</span>
            </div>
          )}

          {!product.is_available && (
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
              <span className="text-xs font-medium text-muted-foreground">Unavailable</span>
            </div>
          )}

          {product.is_bestseller && (
            <Badge className="absolute top-1.5 left-1.5 bg-accent text-accent-foreground text-[9px] px-1.5 py-0 h-4 font-semibold shadow-sm">
              Bestseller
            </Badge>
          )}

          <div className="absolute top-1.5 right-1.5">
            <VegBadge isVeg={product.is_veg} size="sm" />
          </div>
        </div>

        {/* Content */}
        <div className="p-2 flex flex-col flex-1">
          <h4 className="font-medium text-xs leading-tight line-clamp-2 text-foreground">{product.name}</h4>

          <p className="font-bold text-sm text-foreground mt-1">
            {actionType === 'contact_seller' ? '' : actionType === 'make_offer' ? 'From ' : ''}
            {actionType !== 'contact_seller' && `₹${product.price}`}
            {actionType === 'contact_seller' && <span className="text-xs font-medium text-muted-foreground">Contact for price</span>}
          </p>

          <div className="flex-1" />

          {/* Action button */}
          <div className="mt-2">
            {isCartAction ? (
              quantity === 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-7 text-xs font-semibold border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                  onClick={handleAdd}
                  disabled={!product.is_available}
                >
                  {config.label}
                </Button>
              ) : (
                <div className="flex items-center justify-between bg-primary rounded-lg h-7 px-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 w-5 p-0 text-primary-foreground hover:bg-primary-foreground/20"
                    onClick={handleDecrement}
                  >
                    <Minus size={12} />
                  </Button>
                  <span className="font-bold text-xs text-primary-foreground">{quantity}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 w-5 p-0 text-primary-foreground hover:bg-primary-foreground/20"
                    onClick={handleIncrement}
                  >
                    <Plus size={12} />
                  </Button>
                </div>
              )
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="w-full h-7 text-xs font-semibold border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                onClick={handleAdd}
                disabled={!product.is_available}
              >
                <ActionIcon size={12} className="mr-1" /> {config.label}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Contact Seller Modal */}
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
