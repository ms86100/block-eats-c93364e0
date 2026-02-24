import { useNavigate } from 'react-router-dom';
import { Plus, Minus, Store } from 'lucide-react';
import { useHaptics } from '@/hooks/useHaptics';
import { Badge } from '@/components/ui/badge';
import { VegBadge } from '@/components/ui/veg-badge';
import { useCart } from '@/hooks/useCart';
import { Product, ProductActionType } from '@/types/database';
import { ACTION_CONFIG } from '@/lib/marketplace-constants';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';

export interface ProductWithSeller extends Product {
  seller_name?: string;
  seller_rating?: number;
  seller_id: string;
  fulfillment_mode?: string | null;
  delivery_note?: string | null;
}

interface ProductGridCardProps {
  product: ProductWithSeller;
  behavior?: any;
  onTap?: (product: ProductWithSeller) => void;
  className?: string;
  viewOnly?: boolean;
}

export function ProductGridCard({ product, behavior, onTap, className, viewOnly = false }: ProductGridCardProps) {
  const navigate = useNavigate();
  const { items, addItem, updateQuantity } = useCart();
  const { impact, selectionChanged } = useHaptics();
  const { formatPrice } = useCurrency();

  const actionType: ProductActionType = (product.action_type as ProductActionType) || 'add_to_cart';
  const actionConfig = ACTION_CONFIG[actionType] || ACTION_CONFIG.add_to_cart;
  const isCartAction = actionConfig.isCart;

  const cartItem = isCartAction ? items.find((item) => item.product_id === product.id) : null;
  const quantity = cartItem?.quantity || 0;

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    impact('medium');
    if (!isCartAction) {
      if (onTap) onTap(product);
      return;
    }
    addItem(product);
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    selectionChanged();
    updateQuantity(product.id, quantity + 1);
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    selectionChanged();
    updateQuantity(product.id, quantity - 1);
  };

  const handleCardClick = () => {
    selectionChanged();
    if (onTap) {
      onTap(product);
    } else {
      navigate(`/seller/${product.seller_id}`);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className={cn(
        'bg-card rounded-xl border border-border cursor-pointer flex flex-col h-full relative',
        'transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.98]',
        className
      )}
    >
      {/* Image */}
      <div className="relative p-2 pb-0">
        <div className="relative aspect-square rounded-[10px] overflow-hidden product-image-bg">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-contain"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-3xl">🛍️</span>
            </div>
          )}

          {!product.is_available && (
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center rounded-[10px]">
              <span className="text-[9px] font-bold text-muted-foreground uppercase">Out of stock</span>
            </div>
          )}

          {product.is_bestseller && (
            <Badge className="absolute top-1 left-1 bg-badge-new text-primary-foreground text-[8px] px-1.5 py-0.5 font-bold shadow-sm rounded border-0">
              Bestseller
            </Badge>
          )}

          <div className="absolute top-1 right-1">
            <VegBadge isVeg={product.is_veg} size="sm" />
          </div>
        </div>

        {/* Action button overlapping image bottom */}
        {!viewOnly && product.is_available && (
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-10">
            {isCartAction && quantity > 0 ? (
              <div className="flex items-center bg-primary rounded-lg overflow-hidden shadow-cta animate-stepper-pop">
                <button onClick={handleDecrement} className="px-2.5 py-1.5 text-primary-foreground">
                  <Minus size={13} strokeWidth={3} />
                </button>
                <span className="font-bold text-xs text-primary-foreground min-w-[20px] text-center">{quantity}</span>
                <button onClick={handleIncrement} className="px-2.5 py-1.5 text-primary-foreground">
                  <Plus size={13} strokeWidth={3} />
                </button>
              </div>
            ) : (
              <button
                onClick={handleAdd}
                className="bg-primary text-primary-foreground font-bold text-[11px] px-5 py-1.5 rounded-lg shadow-cta hover:opacity-90 transition-all uppercase tracking-wide active:scale-95"
              >
                {actionConfig.shortLabel}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-2.5 pb-2.5 pt-4 flex flex-col flex-1">
        <h4 className="font-semibold text-[12px] leading-tight line-clamp-2 text-foreground mb-0.5">
          {product.name}
        </h4>

        {product.seller_name && (
          <div className="flex items-center gap-1 mt-0.5">
            <Store size={9} className="text-muted-foreground shrink-0" />
            <span className="text-[10px] text-muted-foreground truncate">{product.seller_name}</span>
          </div>
        )}

        <div className="flex-1 min-h-0.5" />

        <div className="flex items-end gap-1 mt-auto">
          <span className="font-bold text-sm text-foreground leading-none">{formatPrice(product.price)}</span>
        </div>
      </div>
    </div>
  );
}
