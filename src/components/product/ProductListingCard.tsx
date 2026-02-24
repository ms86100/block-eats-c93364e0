import { useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Minus, Clock, MapPin } from 'lucide-react';
import { useHaptics } from '@/hooks/useHaptics';
import { Badge } from '@/components/ui/badge';
import { VegBadge } from '@/components/ui/veg-badge';
import { useCart } from '@/hooks/useCart';
import { ProductActionType } from '@/types/database';
import { useCardAnalytics } from '@/hooks/useCardAnalytics';
import { MARKETPLACE_FALLBACKS, type MarketplaceConfig } from '@/hooks/useMarketplaceConfig';
import type { BadgeConfigRow } from '@/hooks/useBadgeConfig';
import type { CategoryConfig } from '@/types/categories';
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
  lead_time_hours?: number | null;
  accepts_preorders?: boolean;
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

// Fix #1: Config props passed from parent — NO fallback hooks
interface ProductListingCardProps {
  product: ProductWithSeller;
  layout?: CardLayout;
  onTap?: (product: ProductWithSeller) => void;
  className?: string;
  viewOnly?: boolean;
  // Parent provides these (required for perf, defaults used if missing)
  categoryConfigs?: CategoryConfig[];
  marketplaceConfig?: MarketplaceConfig;
  badgeConfigs?: BadgeConfigRow[];
}

/* ━━━ Main Component — Blinkit-style compact card ━━━ */

function ProductListingCardInner({
  product,
  layout = 'auto',
  onTap,
  className,
  viewOnly = false,
  categoryConfigs = [],
  marketplaceConfig,
  badgeConfigs = [],
}: ProductListingCardProps) {
  const navigate = useNavigate();
  const { items, addItem, updateQuantity } = useCart();
  const { impact, selectionChanged } = useHaptics();

  // Fix #1/#12: No fallback hooks — use provided props or static defaults
  const mc = marketplaceConfig || MARKETPLACE_FALLBACKS;

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
    impact('medium');
    trackAdd();
    addItem(product as any);
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
        'bg-card rounded-lg border border-border/30 cursor-pointer flex flex-col h-full relative',
        'transition-all duration-100',
        'active:scale-[0.97]',
        isOutOfStock && 'opacity-50 grayscale-[40%]',
        className
      )}
    >
      {/* ━━━ IMAGE ━━━ */}
      <div className="relative p-1.5 pb-0">
        <div className="relative aspect-[4/3] rounded-md overflow-hidden bg-muted/20">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-contain"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-2xl opacity-40">{placeholderEmoji}</span>
            </div>
          )}

          {isOutOfStock && (
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
              <span className="text-[8px] font-bold text-muted-foreground bg-muted/90 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                {mc.labels.outOfStock}
              </span>
            </div>
          )}

          {/* Badges top-left */}
          {badges.length > 0 && (
            <div className="absolute top-0.5 left-0.5 flex flex-col gap-0.5">
              {badges.map((b, i) => (
                <Badge
                  key={i}
                  className={cn(
                    'text-[7px] leading-none px-1 py-px font-bold shadow-sm rounded border-0',
                    b.color
                  )}
                >
                  {b.label}
                </Badge>
              ))}
            </div>
          )}

          {/* Veg badge top-right */}
          {showVegBadge && (
            <div className="absolute top-0.5 right-0.5">
              <VegBadge isVeg={product.is_veg} size="sm" />
            </div>
          )}

          {/* Distance badge bottom-left */}
          {(product as any).distance_km != null && !(product as any).is_same_society && (
            <div className="absolute bottom-0.5 left-0.5">
              <span className="inline-flex items-center gap-0.5 bg-background/90 backdrop-blur-sm text-[7px] font-bold text-primary px-1 py-px rounded-full shadow-sm border border-border/50">
                <MapPin size={6} className="shrink-0" />
                {(product as any).distance_km} km
              </span>
            </div>
          )}
        </div>

        {/* ADD button overlapping bottom of image */}
        {!viewOnly && !isOutOfStock && (
          <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-10">
            {quantity === 0 ? (
              <button
                onClick={handleAdd}
                className="border border-accent text-accent bg-card font-bold text-[10px] px-4 py-0.5 rounded-md shadow-sm hover:bg-accent hover:text-accent-foreground transition-all duration-100 uppercase tracking-wide active:scale-90"
              >
                ADD
              </button>
            ) : (
              <div className="flex items-center bg-accent rounded-md overflow-hidden shadow-sm animate-stepper-pop">
                <button onClick={handleDecrement} className="px-2 py-0.5 text-accent-foreground hover:bg-accent/80 transition-colors">
                  <Minus size={11} strokeWidth={3} />
                </button>
                <span className="font-bold text-[10px] text-accent-foreground min-w-[16px] text-center">{quantity}</span>
                <button onClick={handleIncrement} className="px-2 py-0.5 text-accent-foreground hover:bg-accent/80 transition-colors">
                  <Plus size={11} strokeWidth={3} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ━━━ CONTENT ━━━ */}
      <div className="px-1.5 pb-1.5 pt-3 flex flex-col flex-1">
        {variantText && (
          <span className="inline-block bg-muted text-muted-foreground text-[8px] font-medium px-1 py-px rounded mb-0.5 w-fit">
            {variantText}
          </span>
        )}

        <h4 className="font-medium text-[10px] leading-tight line-clamp-2 text-foreground mb-0.5">
          {product.name}
        </h4>

        {product.seller_name && (
          <p className="text-[8px] text-muted-foreground leading-tight line-clamp-1 mb-0.5">
            by {product.seller_name}
          </p>
        )}

        {deliveryText && (
          <div className="flex items-center gap-0.5 mb-0.5">
            <Clock size={7} className="text-warning" />
            <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wide leading-none">
              {deliveryText}
            </span>
          </div>
        )}

        {product.lead_time_hours != null && product.lead_time_hours > 0 && (
          <div className="flex items-center gap-0.5 mb-0.5">
            <Clock size={7} className="text-primary" />
            <span className="text-[8px] font-medium text-muted-foreground leading-none">
              Order {product.lead_time_hours}h ahead
            </span>
          </div>
        )}
        {product.accepts_preorders && (
          <span className="inline-block bg-accent/20 text-accent-foreground text-[7px] font-bold px-1 py-px rounded w-fit mb-0.5">
            Pre-order
          </span>
        )}
        <div className="flex-1 min-h-0.5" />

        {hasDiscount && discountPct > 0 && (
          <span className="text-[8px] font-bold text-primary leading-none mb-0.5">
            {discountPct}{mc.labels.discountSuffix}
          </span>
        )}

        <div className="flex items-end gap-0.5 mt-auto">
          <span className="font-bold text-xs text-foreground leading-none">
            {mc.currencySymbol}{product.price.toLocaleString()}
          </span>
          {hasDiscount && (
            <span className="text-[8px] text-muted-foreground line-through leading-none">
              {mc.currencySymbol}{product.mrp?.toLocaleString()}
            </span>
          )}
        </div>

        {product.price_per_unit && (
          <span className="text-[7px] text-muted-foreground leading-none mt-0.5">
            {product.price_per_unit}
          </span>
        )}
      </div>

      {viewOnly && (
        <div className="px-1.5 pb-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/seller/${product.seller_id}`); }}
            className="w-full border border-primary text-primary font-bold text-[9px] py-1 rounded-md hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            {mc.labels.viewButton}
          </button>
        </div>
      )}

      {!viewOnly && isOutOfStock && (
        <div className="px-1.5 pb-1.5 text-center">
          <span className="text-[8px] font-medium text-muted-foreground">
            {mc.labels.soldOut}
          </span>
        </div>
      )}
    </div>
  );
}

// Fix #5: React.memo with complete comparator including config refs
export const ProductListingCard = memo(ProductListingCardInner, (prev, next) => {
  return (
    prev.product.id === next.product.id &&
    prev.product.is_available === next.product.is_available &&
    prev.product.price === next.product.price &&
    prev.product.stock_quantity === next.product.stock_quantity &&
    prev.layout === next.layout &&
    prev.viewOnly === next.viewOnly &&
    prev.className === next.className &&
    // Fix #5: Include config refs to prevent memo bypass
    prev.categoryConfigs === next.categoryConfigs &&
    prev.marketplaceConfig === next.marketplaceConfig &&
    prev.badgeConfigs === next.badgeConfigs
  );
});