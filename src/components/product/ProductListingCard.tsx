import { useMemo, memo } from 'react';
import { Plus, Minus, Clock, MapPin, ShoppingCart, Activity } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { useHaptics } from '@/hooks/useHaptics';
import { Badge } from '@/components/ui/badge';
import { VegBadge } from '@/components/ui/veg-badge';
import { useCart } from '@/hooks/useCart';
import { ProductActionType } from '@/types/database';
import { ACTION_CONFIG } from '@/lib/marketplace-constants';
import { useCardAnalytics } from '@/hooks/useCardAnalytics';
import { MARKETPLACE_FALLBACKS, type MarketplaceConfig } from '@/hooks/useMarketplaceConfig';
import type { BadgeConfigRow } from '@/hooks/useBadgeConfig';
import type { CategoryConfig } from '@/types/categories';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';

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

interface ProductListingCardProps {
  product: ProductWithSeller;
  layout?: CardLayout;
  onTap?: (product: ProductWithSeller) => void;
  onNavigate?: (path: string) => void;
  className?: string;
  viewOnly?: boolean;
  categoryConfigs?: CategoryConfig[];
  marketplaceConfig?: MarketplaceConfig;
  badgeConfigs?: BadgeConfigRow[];
  socialProofCount?: number;
}

/* ━━━ Main Component — Premium dark card ━━━ */

function ProductListingCardInner({
  product,
  layout = 'auto',
  onTap,
  onNavigate,
  className,
  viewOnly = false,
  categoryConfigs = [],
  marketplaceConfig,
  badgeConfigs = [],
  socialProofCount,
}: ProductListingCardProps) {
  const { items, addItem, updateQuantity } = useCart();
  const { impact, selectionChanged } = useHaptics();
  const { formatPrice } = useCurrency();

  const mc = marketplaceConfig || MARKETPLACE_FALLBACKS;

  const actionType: ProductActionType = (product.action_type as ProductActionType) || 'add_to_cart';
  const actionConfig = ACTION_CONFIG[actionType] || ACTION_CONFIG.add_to_cart;
  const isCartAction = actionConfig.isCart;

  const cartItem = isCartAction ? items.find((item) => item.product_id === product.id) : null;
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
    if (!isCartAction) {
      if (onTap) onTap(product);
      return;
    }
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
    else onNavigate?.(`/seller/${product.seller_id}`);
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
        'bg-card rounded-xl cursor-pointer flex flex-col h-full relative',
        'border border-border',
        'transition-all duration-200 ease-out',
        'active:scale-[0.98] hover:scale-[1.02]',
        isOutOfStock && 'opacity-50 grayscale-[40%]',
        className
      )}
    >
      {/* ━━━ IMAGE ━━━ */}
      <div className="relative">
        <div className="relative aspect-[4/3] rounded-t-xl overflow-hidden product-image-bg">
          <img
            src={product.image_url || `https://picsum.photos/seed/${product.id}/400/300`}
            alt={product.name}
            className={cn("w-full h-full", product.image_url ? "object-contain p-2" : "object-cover")}
            loading="lazy"
          />

          {isOutOfStock && (
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
              <span className="text-[8px] font-bold text-muted-foreground bg-muted/90 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                {mc.labels.outOfStock}
              </span>
            </div>
          )}

          {/* Badges top-left */}
          {badges.length > 0 && (
            <div className="absolute top-1.5 left-1.5 flex flex-col gap-0.5">
              {badges.map((b, i) => (
                <Badge
                  key={i}
                  className={cn(
                    'text-[7px] leading-none px-1.5 py-0.5 font-bold shadow-sm rounded border-0',
                    b.color
                  )}
                >
                  {b.label}
                </Badge>
              ))}
            </div>
          )}

          {/* Discount badge top-right */}
          {hasDiscount && discountPct > 0 && (
            <div className="absolute top-1.5 right-1.5">
              <span className="bg-badge-discount text-foreground text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
                {discountPct}% OFF
              </span>
            </div>
          )}

          {/* Veg badge */}
          {showVegBadge && (
            <div className="absolute bottom-1.5 right-1.5">
              <VegBadge isVeg={product.is_veg} size="sm" />
            </div>
          )}

          {/* Distance badge — visible for ALL products */}
          <div className="absolute bottom-1 left-1">
            {(product as any).distance_km != null ? (
              <span className="inline-flex items-center gap-0.5 bg-background/90 backdrop-blur-sm text-[7px] font-bold text-primary px-1 py-0.5 rounded-full shadow-sm border border-border">
                <MapPin size={7} className="shrink-0" />
                {(product as any).distance_km < 1
                  ? `${Math.round((product as any).distance_km * 1000)}m away`
                  : `${(product as any).distance_km} km away`}
              </span>
            ) : (product as any).is_same_society !== false ? (
              <span className="inline-flex items-center gap-0.5 bg-background/90 backdrop-blur-sm text-[7px] font-bold text-accent-foreground px-1 py-0.5 rounded-full shadow-sm border border-border">
                <MapPin size={7} className="shrink-0" />
                In your society
              </span>
            ) : null}
          </div>
        </div>

        {/* ━━━ ADD button overlapping image bottom edge ━━━ */}
        {!viewOnly && !isOutOfStock && (
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-10">
            {isCartAction && quantity > 0 ? (
              <div className="flex items-center bg-primary rounded-lg overflow-hidden shadow-cta animate-stepper-pop">
                <button onClick={handleDecrement} className="px-2.5 py-1 text-primary-foreground hover:bg-primary/80 transition-colors">
                  <Minus size={12} strokeWidth={3} />
                </button>
                <span className="font-bold text-[11px] text-primary-foreground px-1">{quantity}</span>
                <button onClick={handleIncrement} className="px-2.5 py-1 text-primary-foreground hover:bg-primary/80 transition-colors">
                  <Plus size={12} strokeWidth={3} />
                </button>
              </div>
            ) : (
              <button
                onClick={handleAdd}
                className="bg-primary text-primary-foreground font-bold text-[11px] px-5 py-1.5 rounded-lg shadow-cta hover:opacity-90 transition-all duration-150 uppercase tracking-wide active:scale-95"
              >
                {actionConfig.shortLabel}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ━━━ CONTENT ━━━ */}
      <div className={cn("px-2.5 pb-2.5 flex flex-col flex-1", !viewOnly && !isOutOfStock ? "pt-4" : "pt-2.5")}>
        {variantText && (
          <span className="inline-flex items-center justify-center border border-border rounded-full text-[8px] font-medium px-1.5 py-px mb-1 w-fit text-muted-foreground">
            {variantText}
          </span>
        )}

        <h4 className="font-semibold text-[12px] leading-snug line-clamp-2 text-foreground mb-0.5">
          {product.name}
        </h4>

        {product.seller_name && (
          <p className="text-[10px] text-muted-foreground leading-tight line-clamp-1 mb-0.5">
            by {product.seller_name}
            {(product as any).last_active_at && (
              <span className="ml-1 text-[8px] opacity-70">
                · {formatSellerActivity((product as any).last_active_at)}
              </span>
            )}
          </p>
        )}

        {/* On-time delivery badge */}
        {(product as any).on_time_delivery_pct != null && (product as any).completed_order_count > 5 && (
          <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-primary bg-primary/10 rounded-full px-1.5 py-0.5 w-fit mb-0.5">
            ✓ On-time: {(product as any).on_time_delivery_pct}%
          </span>
        )}

        {/* Social proof badge */}
        {socialProofCount != null && socialProofCount > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-accent-foreground bg-accent/15 rounded-full px-1.5 py-0.5 w-fit mb-0.5">
            👥 {socialProofCount} {socialProofCount === 1 ? 'family' : 'families'} ordered this week
          </span>
        )}

        {deliveryText && (
          <div className="flex items-center gap-0.5 mb-0.5">
            <Clock size={9} className="text-rating-star" />
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide leading-none">
              {deliveryText}
            </span>
          </div>
        )}

        {product.lead_time_hours != null && product.lead_time_hours > 0 && (
          <div className="flex items-center gap-0.5 mb-0.5">
            <Clock size={8} className="text-primary" />
            <span className="text-[8px] font-medium text-muted-foreground leading-none">
              Order {product.lead_time_hours}h ahead
            </span>
          </div>
        )}
        {product.accepts_preorders && (
          <span className="inline-block bg-accent/20 text-accent-foreground text-[7px] font-bold px-1 py-0.5 rounded w-fit mb-0.5">
            Pre-order
          </span>
        )}
        <div className="flex-1 min-h-0" />

        {/* Price — prominent, 14-16px */}
        <div className="flex items-end gap-1.5 mt-auto">
          <span className="font-semibold text-[13px] text-foreground leading-none tracking-tight tabular-nums">
            {formatPrice(product.price)}
          </span>
          {hasDiscount && (
            <span className="text-[10px] text-muted-foreground line-through leading-none">
              MRP {formatPrice(product.mrp!)}
            </span>
          )}
        </div>

        {product.price_per_unit && (
          <span className="text-[9px] text-muted-foreground leading-none mt-0.5">
            {product.price_per_unit}
          </span>
        )}
      </div>

      {viewOnly && (
        <div className="px-2.5 pb-2.5">
          <button
            onClick={(e) => { e.stopPropagation(); onNavigate?.(`/seller/${product.seller_id}`); }}
            className="w-full border border-primary text-primary font-bold text-[11px] py-1.5 rounded-lg hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            {mc.labels.viewButton}
          </button>
        </div>
      )}

      {!viewOnly && isOutOfStock && (
        <div className="px-2.5 pb-2.5 text-center">
          <span className="text-[9px] font-medium text-muted-foreground">
            {mc.labels.soldOut}
          </span>
        </div>
      )}
    </div>
  );
}

/* ── Helper: format seller last-active into human-friendly text ── */
function formatSellerActivity(lastActiveAt: string): string {
  try {
    const d = new Date(lastActiveAt);
    const diffMs = Date.now() - d.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours < 1) return 'Active now';
    if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
    if (diffHours < 48) return 'Yesterday';
    return formatDistanceToNowStrict(d, { addSuffix: true });
  } catch {
    return '';
  }
}

export const ProductListingCard = memo(ProductListingCardInner, (prev, next) => {
  return (
    prev.product.id === next.product.id &&
    prev.product.is_available === next.product.is_available &&
    prev.product.price === next.product.price &&
    prev.product.stock_quantity === next.product.stock_quantity &&
    prev.layout === next.layout &&
    prev.viewOnly === next.viewOnly &&
    prev.className === next.className &&
    prev.categoryConfigs === next.categoryConfigs &&
    prev.marketplaceConfig === next.marketplaceConfig &&
    prev.badgeConfigs === next.badgeConfigs
  );
});
