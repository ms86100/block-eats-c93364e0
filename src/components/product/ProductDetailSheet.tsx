import { Link } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { VegBadge } from '@/components/ui/veg-badge';
import { Badge } from '@/components/ui/badge';
import { ContactSellerModal } from './ContactSellerModal';
import { ProductEnquirySheet } from './ProductEnquirySheet';
import { ReportSheet } from '@/components/report/ReportSheet';
import { ProductAttributeBlocks } from './ProductAttributeBlocks';
import { PriceHistoryChart } from './PriceHistoryChart';
import { Plus, Minus, Store, MapPin, Home, Clock, Truck, Users, Zap, RotateCcw, ChevronRight, ChevronDown, Shield, Flag } from 'lucide-react';
import { useProductDetail, ProductDetail } from '@/hooks/useProductDetail';
import { hapticImpact } from '@/lib/haptics';
import { formatDistanceToNowStrict } from 'date-fns';
import { useMarketplaceLabels } from '@/hooks/useMarketplaceLabels';

function formatSellerLastActive(lastActiveAt: string, ml: ReturnType<typeof useMarketplaceLabels>): string {
  try {
    const d = new Date(lastActiveAt);
    const diffMs = Date.now() - d.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours < 1) return ml.label('label_active_now');
    if (diffHours < 24) return `${ml.label('label_active_now').split(' ')[0]} ${ml.label('label_active_hours_ago').replace('{hours}', String(Math.floor(diffHours)))}`;
    if (diffHours < 48) return `Active ${ml.label('label_active_yesterday').toLowerCase()}`;
    return `Active ${formatDistanceToNowStrict(d, { addSuffix: true })}`;
  } catch {
    return '';
  }
}

interface ProductDetailSheetProps {
  product: ProductDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectProduct?: (product: any) => void;
  categoryIcon?: string;
  categoryName?: string;
}

export { type ProductDetail };

export function ProductDetailSheet({ product, open, onOpenChange, onSelectProduct, categoryIcon, categoryName }: ProductDetailSheetProps) {
  const d = useProductDetail(product, open, onOpenChange);
  const ml = useMarketplaceLabels();

  if (!product) return null;

  const distanceText = product.distance_km != null
    ? (product.distance_km < 1
      ? ml.label('label_distance_m_format').replace('{distance}', String(Math.round(product.distance_km * 1000)))
      : ml.label('label_distance_km_format').replace('{distance}', String(product.distance_km)))
    : product.society_name;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto p-0">
          <SheetHeader className="sr-only"><SheetTitle>{product.product_name}</SheetTitle></SheetHeader>

          {/* Image */}
          <div className="relative w-full aspect-[4/3] max-h-[45vh] bg-muted">
            {product.image_url ? (
              <img src={product.image_url} alt={product.product_name} className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><span className="text-6xl">{categoryIcon || '🛍️'}</span></div>
            )}
            {/* Pagination dots removed — single image only (#5) */}
          </div>

          <div className="p-4 space-y-3">
            {product.prep_time_minutes && (
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1 bg-muted rounded-md px-2 py-1">
                  <Clock size={12} className="text-muted-foreground" />
                  <span className="text-[11px] font-bold text-muted-foreground uppercase">{product.prep_time_minutes} MINS</span>
                </div>
              </div>
            )}

            <div className="flex items-start gap-2">
              {product.is_veg !== null && <VegBadge isVeg={product.is_veg} size="sm" className="mt-1" />}
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-lg leading-tight text-foreground">{product.product_name}</h2>
                {categoryName && <span className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">{categoryIcon && <span>{categoryIcon}</span>}{categoryName}</span>}
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              {d.actionType === 'contact_seller' ? (
                <span className="text-sm font-medium text-muted-foreground">Contact for price</span>
              ) : (
                <span className="text-xl font-bold text-foreground">{d.formatPrice(product.price)}</span>
              )}
            </div>

            <button onClick={() => d.setShowDetails(!d.showDetails)} className="flex items-center gap-1 text-xs font-medium text-primary">
              {d.showDetails ? 'Hide product details' : 'View product details'}
              <ChevronDown size={14} className={`transition-transform ${d.showDetails ? 'rotate-180' : ''}`} />
            </button>

            {d.showDetails && (
              <div className="space-y-3 animate-fade-in">
                {product.fulfillment_mode && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
                    <Truck size={14} className="text-accent shrink-0" />
                    <span>
                      {product.fulfillment_mode === 'self_pickup' && 'Self Pickup Only'}
                      {product.fulfillment_mode === 'delivery' && 'Seller Delivers'}
                      {product.fulfillment_mode === 'both' && 'Pickup or Delivery'}
                    </span>
                  </div>
                )}
                {product.delivery_note && <p className="text-xs text-muted-foreground italic">— {product.delivery_note}</p>}
                {product.description && <div><h4 className="text-xs font-bold text-foreground mb-1">Highlights</h4><p className="text-xs text-muted-foreground leading-relaxed">{product.description}</p></div>}
                <ProductAttributeBlocks specifications={d.loadedSpecs ?? product.specifications} />
                <PriceHistoryChart
                  productId={product.product_id}
                  priceStableSince={(product as any).price_stable_since}
                />
                {d.trustSnapshot && (d.trustSnapshot.completed_orders > 0 || d.trustSnapshot.avg_response_min > 0) && (
                  <div className="grid grid-cols-3 gap-2">
                    {d.trustSnapshot.completed_orders > 0 && <div className="bg-muted rounded-xl p-2.5 text-center"><Users size={14} className="mx-auto text-primary mb-1" /><p className="text-sm font-bold text-foreground">{d.trustSnapshot.completed_orders}</p><p className="text-[9px] text-muted-foreground">Orders</p></div>}
                    {d.trustSnapshot.avg_response_min > 0 && <div className="bg-muted rounded-xl p-2.5 text-center"><Zap size={14} className="mx-auto text-accent mb-1" /><p className="text-sm font-bold text-foreground">~{d.trustSnapshot.avg_response_min}m</p><p className="text-[9px] text-muted-foreground">Response</p></div>}
                    {d.trustSnapshot.repeat_customer_pct > 0 && <div className="bg-muted rounded-xl p-2.5 text-center"><RotateCcw size={14} className="mx-auto text-primary mb-1" /><p className="text-sm font-bold text-foreground">{d.trustSnapshot.repeat_customer_pct}%</p><p className="text-[9px] text-muted-foreground">Repeat</p></div>}
                  </div>
                )}
              </div>
            )}

            {/* Seller card */}
            <Link to={`/seller/${product.seller_id}`} onClick={() => onOpenChange(false)} className="flex items-center gap-3 bg-muted rounded-xl p-3">
              <div className="w-10 h-10 rounded-xl bg-card flex items-center justify-center border border-border/30"><Store size={18} className="text-muted-foreground" /></div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground truncate">{product.seller_name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {d.isNewSeller ? <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">New Seller</Badge> : null}
                  {product.is_same_society ? (
                    <span className="flex items-center gap-0.5 text-[10px] text-accent font-medium"><Home size={10} /> {ml.label('label_your_neighbor')}</span>
                  ) : (
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground"><MapPin size={10} />{distanceText}</span>
                  )}
                  {(product as any).last_active_at && (
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <Clock size={9} />
                      {formatSellerLastActive((product as any).last_active_at, ml)}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight size={16} className="text-muted-foreground shrink-0" />
            </Link>
          </div>

          {/* Similar Products */}
          {d.similarProducts.length > 0 && (
            <div className="px-4 pb-3">
              <h4 className="text-xs font-bold text-foreground mb-2 uppercase tracking-wide">Similar in {categoryName || 'this category'}</h4>
              <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
                {d.similarProducts.map((sp) => (
                  <button
                    key={sp.id}
                    className="shrink-0 w-28 text-left"
                    onClick={() => {
                      onSelectProduct?.(sp);
                    }}
                  >
                    <div className="w-28 h-28 rounded-xl bg-muted overflow-hidden mb-1.5">
                      {sp.image_url ? <img src={sp.image_url} alt={sp.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-2xl">🛍️</div>}
                    </div>
                    <p className="text-[11px] font-medium line-clamp-1">{sp.name}</p>
                    <p className="text-[11px] text-muted-foreground">{sp.seller?.business_name}</p>
                    {sp.price > 0 && <p className="text-xs font-bold">{d.formatPrice(sp.price)}</p>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Report */}
          <div className="px-6 pb-3">
            <button onClick={() => { onOpenChange(false); d.setReportOpen(true); }} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors">
              <Flag size={12} />Report this product
            </button>
          </div>

          {/* Sticky CTA */}
          <div className="sticky bottom-0 bg-background border-t border-border p-4">
            {d.isCartAction ? (
              d.quantity === 0 ? (
                <Button className="w-full h-12 text-base font-bold bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl" onClick={d.handleAdd}>Add to cart · {d.formatPrice(product.price)}</Button>
              ) : (
                <div className="flex items-center justify-between">
                  <div><span className="text-lg font-bold text-foreground">{d.formatPrice(product.price * d.quantity)}</span><span className="text-xs text-muted-foreground ml-1.5">{d.quantity} item{d.quantity > 1 ? 's' : ''}</span></div>
                  <div className="flex items-center bg-accent rounded-xl overflow-hidden">
                    <button className="px-3 py-2.5 text-accent-foreground" onClick={() => { hapticImpact('medium'); d.updateQuantity(product.product_id, d.quantity - 1); }}><Minus size={16} strokeWidth={3} /></button>
                    <span className="font-bold text-base text-accent-foreground min-w-[28px] text-center tabular-nums">{d.quantity}</span>
                    <button className="px-3 py-2.5 text-accent-foreground" onClick={() => { hapticImpact('medium'); d.updateQuantity(product.product_id, d.quantity + 1); }}><Plus size={16} strokeWidth={3} /></button>
                  </div>
                </div>
              )
            ) : (
              <Button className="w-full h-12 text-base font-bold bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl" onClick={d.handleAdd}>
                <d.ActionIcon size={18} className="mr-2" />{d.config.label}
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {d.actionType === 'contact_seller' && <ContactSellerModal open={d.contactOpen} onOpenChange={d.setContactOpen} sellerName={product.seller_name} phone={product.contact_phone || ''} />}
      {!d.isCartAction && d.actionType !== 'contact_seller' && <ProductEnquirySheet open={d.enquiryOpen} onOpenChange={d.setEnquiryOpen} productId={product.product_id} productName={product.product_name} sellerId={product.seller_id} sellerName={product.seller_name} actionType={d.actionType} price={product.price} />}
      <ReportSheet open={d.reportOpen} onOpenChange={d.setReportOpen} targetType="product" targetId={product.product_id} targetName={product.product_name} />
    </>
  );
}
