import { Plus, Minus, MessageCircle, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { VegBadge } from '@/components/ui/veg-badge';
import { useCart } from '@/hooks/useCart';
import { Product } from '@/types/database';
import { CategoryBehavior } from '@/types/categories';
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

export function ProductGridCard({ product, behavior, onTap, className }: ProductGridCardProps) {
  const { items, addItem, updateQuantity } = useCart();
  const cartItem = items.find((item) => item.product_id === product.id);
  const quantity = cartItem?.quantity || 0;

  const isService = behavior && (behavior.requiresTimeSlot || behavior.hasDuration || behavior.enquiryOnly);
  const supportsCart = behavior?.supportsCart ?? true;

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!supportsCart || isService) {
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

  const actionLabel = behavior?.enquiryOnly
    ? 'Contact'
    : behavior?.requiresTimeSlot
      ? 'Book'
      : 'Add';

  const ActionIcon = behavior?.enquiryOnly
    ? MessageCircle
    : behavior?.requiresTimeSlot
      ? Calendar
      : Plus;

  return (
    <div
      onClick={handleCardClick}
      className={cn(
        'bg-card rounded-xl overflow-hidden border border-border/40 cursor-pointer transition-all hover:shadow-md flex flex-col',
        className
      )}
    >
      {/* Image — clean, big */}
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
            <span className="text-3xl">{isService ? '🛠️' : '🍽️'}</span>
          </div>
        )}

        {!product.is_available && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
            <span className="text-xs font-medium text-muted-foreground">Unavailable</span>
          </div>
        )}

        {/* Offer / bestseller badge — subtle */}
        {product.is_bestseller && (
          <Badge className="absolute top-1.5 left-1.5 bg-accent text-accent-foreground text-[9px] px-1.5 py-0 h-4 font-semibold shadow-sm">
            Bestseller
          </Badge>
        )}

        {/* Veg badge */}
        <div className="absolute top-1.5 right-1.5">
          <VegBadge isVeg={product.is_veg} size="sm" />
        </div>
      </div>

      {/* Content — minimal: name, weight, price, button */}
      <div className="p-2 flex flex-col flex-1">
        <h4 className="font-medium text-xs leading-tight line-clamp-2 text-foreground">{product.name}</h4>

        {/* Price row */}
        <p className="font-bold text-sm text-foreground mt-1">
          {isService && !behavior?.enquiryOnly ? 'From ' : ''}₹{product.price}
        </p>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action — always at bottom */}
        <div className="mt-2">
          {supportsCart && !isService ? (
            quantity === 0 ? (
              <Button
                size="sm"
                variant="outline"
                className="w-full h-7 text-xs font-semibold border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                onClick={handleAdd}
                disabled={!product.is_available}
              >
                ADD
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
              <ActionIcon size={12} className="mr-1" /> {actionLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
