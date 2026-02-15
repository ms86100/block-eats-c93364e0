import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Minus, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { VegBadge } from '@/components/ui/veg-badge';
import { useCart } from '@/hooks/useCart';
import { ProductActionType } from '@/types/database';
import { useCategoryConfigs } from '@/hooks/useCategoryBehavior';
import { useMarketplaceConfig } from '@/hooks/useMarketplaceConfig';
import { useBadgeConfig } from '@/hooks/useBadgeConfig';
import { useCardAnalytics } from '@/hooks/useCardAnalytics';
import { cn } from '@/lib/utils';

/* ━━━ Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export interface ProductWithSeller {
  id: string;
  seller_id: string;
  name: string;
  price: number;
  image_url: string | null;
  category: string;
  is_veg: boolean;
  is_available: boolean;
  is_bestseller: boolean;
  is_recommended: boolean;
  is_urgent: boolean;
  description: string | null;
  action_type?: ProductActionType | string | null;
  contact_phone?: string | null;
  mrp?: number | null;
  brand?: string | null;
  unit_type?: string | null;
  price_per_unit?: string | null;
  stock_quantity?: number | null;
  serving_size?: string | null;
  spice_level?: string | null;
  cuisine_type?: string | null;
  service_scope?: string | null;
  visit_charge?: number | null;
  minimum_charge?: number | null;
  delivery_time_text?: string | null;
  tags?: string[] | null;
  discount_percentage?: number | null;
  service_duration_minutes?: number | null;
  prep_time_minutes?: number | null;
  warranty_period?: string | null;
  seller_name?: string;
  seller_rating?: number;
  seller_reviews?: number;
  seller_verified?: boolean;
  completed_order_count?: number;
  fulfillment_mode?: string | null;
  delivery_note?: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: any;
}

type CardLayout = 'auto' | 'ecommerce' | 'food' | 'service';

interface ProductListingCardProps {
  product: ProductWithSeller;
  layout?: CardLayout;
  onTap?: (product: ProductWithSeller) => void;
  className?: string;
  viewOnly?: boolean;
}

/* ━━━ Main Component — Blinkit-style compact card ━━━ */

export function ProductListingCard({
  product,
  layout = 'auto',
  onTap,
  className,
  viewOnly = false,
}: ProductListingCardProps) {
  const navigate = useNavigate();
  const { items, addItem, updateQuantity } = useCart();
  const { configs: categoryConfigs } = useCategoryConfigs();
  const mc = useMarketplaceConfig();
  const { badges: badgeConfigs } = useBadgeConfig();

  const cartItem = items.find((item) => item.product_id === product.id);
  const quantity = cartItem?.quantity || 0;

  /* ── Category config lookup ── */
  const catConfig = useMemo(() => {
    return categoryConfigs.find(c => c.category === product.category) || null;
  }, [categoryConfigs, product.category]);

  const resolvedLayout = useMemo((): 'ecommerce' | 'food' | 'service' => {
    if (layout !== 'auto') return layout as 'ecommerce' | 'food' | 'service';
    return catConfig?.layoutType || 'ecommerce';
  }, [layout, catConfig]);

  const showVegBadge = catConfig?.formHints?.showVegToggle ?? false;
  const placeholderEmoji = catConfig?.formHints?.placeholderEmoji || mc.labels.defaultPlaceholderEmoji;

  /* ── Analytics ── */
  const { ref: cardRef, onCardClick: trackClick, onAddClick: trackAdd } = useCardAnalytics({
    productId: product.id,
    category: product.category,
    price: product.price,
    sellerId: product.seller_id,
    layout: resolvedLayout,
  });

  /* ── Handlers ── */
  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    trackAdd();
    addItem(product as any);
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
    trackClick();
    if (onTap) onTap(product);
    else navigate(`/seller/${product.seller_id}`);
  };

  /* ── Derived values ── */
  const isOutOfStock = !product.is_available;
  const isLowStock = mc.enableScarcity &&
    product.stock_quantity != null &&
    product.stock_quantity > 0 &&
    product.stock_quantity <= mc.lowStockThreshold;

  /* ── Badge system ── */
  const badges = useMemo(() => {
    const result: { label: string; color: string }[] = [];
    const maxBadges = mc.maxBadgesPerCard;
    for (const bc of badgeConfigs) {
      if (result.length >= maxBadges) break;
      if (!bc.layout_visibility.includes(resolvedLayout)) continue;
      if (bc.tag_key === 'bestseller' && product.is_bestseller) {
        result.push({ label: bc.badge_label, color: bc.color });
      } else if (bc.tag_key === 'low_stock' && isLowStock) {
        const label = bc.badge_label.replace('{stock}', String(product.stock_quantity));
        result.push({
          label,
          color: mc.enablePulseAnimation ? `${bc.color} animate-low-stock-pulse` : bc.color,
        });
      } else if (product.tags?.includes(bc.tag_key) && bc.tag_key !== 'bestseller' && bc.tag_key !== 'low_stock') {
        result.push({ label: bc.badge_label, color: bc.color });
      }
    }
    return result;
  }, [badgeConfigs, product, resolvedLayout, isLowStock, mc]);

  const hasDiscount = product.mrp && product.mrp > product.price;
  const discountPct = product.discount_percentage
    || (hasDiscount ? Math.round(((product.mrp! - product.price) / product.mrp!) * 100) : 0);

  const deliveryText = product.delivery_time_text || (product.prep_time_minutes ? mc.labels.prepTimeFormat.replace('{value}', String(product.prep_time_minutes)) : null);
  const variantText = product.unit_type ? (product.price_per_unit || product.unit_type) : (product.serving_size || null);

  return (
    <div
      ref={cardRef}
      onClick={handleCardClick}
      className={cn(
        'bg-card rounded-lg border border-border/40 cursor-pointer flex flex-col h-full relative',
        'transition-shadow duration-150',
        'hover:shadow-md',
        isOutOfStock && 'opacity-50 grayscale-[40%]',
        className
      )}
    >
      {/* ━━━ IMAGE ━━━ */}
      <div className="relative px-2 pt-2">
        <div className="relative aspect-square rounded-md overflow-hidden bg-muted/30">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-contain"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-3xl">{placeholderEmoji}</span>
            </div>
          )}

          {isOutOfStock && (
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
              <span className="text-[9px] font-bold text-muted-foreground bg-muted/90 px-2 py-0.5 rounded-full uppercase tracking-wider">
                {mc.labels.outOfStock}
              </span>
            </div>
          )}

          {badges.length > 0 && (
            <div className="absolute top-1 left-1 flex flex-col gap-0.5">
              {badges.map((b, i) => (
                <Badge
                  key={i}
                  className={cn(
                    'text-[8px] leading-none px-1 py-0.5 font-bold shadow-sm rounded border-0',
                    b.color
                  )}
                >
                  {b.label}
                </Badge>
              ))}
            </div>
          )}

          {showVegBadge && (
            <div className="absolute top-1 right-1">
              <VegBadge isVeg={product.is_veg} size="sm" />
            </div>
          )}
        </div>
      </div>

      {/* ━━━ CONTENT ━━━ */}
      <div className="px-2 pb-2 pt-1.5 flex flex-col flex-1">
        {/* Delivery time chip */}
        {deliveryText && (
          <div className="flex items-center gap-0.5 mb-0.5">
            <Clock size={8} className="text-muted-foreground" />
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide leading-none">
              {deliveryText}
            </span>
          </div>
        )}

        {/* Product name */}
        <h4 className="font-medium text-xs leading-tight line-clamp-2 text-foreground mb-1">
          {product.name}
        </h4>

        {/* Variant / weight */}
        {variantText && (
          <span className="text-[10px] text-muted-foreground leading-none mb-1">
            {variantText}
          </span>
        )}

        <div className="flex-1 min-h-0.5" />

        {/* Price + ADD row */}
        <div className="flex items-end justify-between gap-1 mt-auto">
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-sm text-foreground leading-none">
              {mc.currencySymbol}{product.price}
            </span>
            {hasDiscount && (
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[9px] text-muted-foreground line-through leading-none">
                  {mc.currencySymbol}{product.mrp}
                </span>
                <span className="text-[9px] font-bold text-success leading-none">
                  {discountPct}{mc.labels.discountSuffix}
                </span>
              </div>
            )}
          </div>

          {/* ADD button or stepper */}
          {!viewOnly && !isOutOfStock && (
            quantity === 0 ? (
              <button
                onClick={handleAdd}
                className="border border-success text-success font-bold text-[10px] px-3 py-1 rounded-md hover:bg-success hover:text-white transition-colors shrink-0 uppercase"
              >
                ADD
              </button>
            ) : (
              <div className="flex items-center bg-success rounded-md overflow-hidden shrink-0">
                <button onClick={handleDecrement} className="px-1.5 py-1 text-white hover:bg-success/80 transition-colors">
                  <Minus size={10} strokeWidth={3} />
                </button>
                <span className="font-bold text-[10px] text-white min-w-[14px] text-center">{quantity}</span>
                <button onClick={handleIncrement} className="px-1.5 py-1 text-white hover:bg-success/80 transition-colors">
                  <Plus size={10} strokeWidth={3} />
                </button>
              </div>
            )
          )}

          {viewOnly && (
            <button
              onClick={(e) => { e.stopPropagation(); navigate(`/seller/${product.seller_id}`); }}
              className="border border-primary text-primary font-bold text-[10px] px-2.5 py-1 rounded-md hover:bg-primary hover:text-primary-foreground transition-colors shrink-0"
            >
              {mc.labels.viewButton}
            </button>
          )}

          {!viewOnly && isOutOfStock && (
            <span className="text-[9px] font-medium text-muted-foreground shrink-0">
              {mc.labels.soldOut}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
