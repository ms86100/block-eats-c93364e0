import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { VegBadge } from '@/components/ui/veg-badge';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/hooks/useCart';
import { useSellerTrustSnapshot } from '@/hooks/queries/useProductTrustMetrics';
import { ContactSellerModal } from './ContactSellerModal';
import { ProductEnquirySheet } from './ProductEnquirySheet';
import { ReportSheet } from '@/components/report/ReportSheet';
import { ProductActionType } from '@/types/database';
import { ACTION_CONFIG } from '@/lib/marketplace-constants';
import { Plus, Minus, Store, MapPin, Home, Clock, Truck, Users, Zap, RotateCcw, ChevronRight, ChevronDown, Shield, Flag } from 'lucide-react';

interface ProductDetail {
  product_id: string;
  product_name: string;
  price: number;
  image_url: string | null;
  is_veg: boolean | null;
  category: string | null;
  description?: string | null;
  prep_time_minutes?: number | null;
  fulfillment_mode?: string | null;
  delivery_note?: string | null;
  action_type?: string | null;
  contact_phone?: string | null;
  seller_id: string;
  seller_name: string;
  seller_rating: number;
  seller_reviews: number;
  society_name: string | null;
  distance_km: number | null;
  is_same_society: boolean;
}

interface ProductDetailSheetProps {
  product: ProductDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryIcon?: string;
  categoryName?: string;
}

export function ProductDetailSheet({
  product,
  open,
  onOpenChange,
  categoryIcon,
  categoryName,
}: ProductDetailSheetProps) {
  const { items, addItem, updateQuantity } = useCart();
  const { data: trustSnapshot } = useSellerTrustSnapshot(product?.seller_id || null);
  const [contactOpen, setContactOpen] = useState(false);
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [similarProducts, setSimilarProducts] = useState<any[]>([]);

  // Fetch similar products from same category
  useEffect(() => {
    if (!product || !open) return;
    const fetchSimilar = async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, price, image_url, is_veg, seller_id, seller:seller_profiles!products_seller_id_fkey(business_name)')
        .eq('category', product.category as string)
        .eq('is_available', true)
        .eq('approval_status', 'approved')
        .neq('id', product.product_id)
        .limit(6);
      setSimilarProducts(data || []);
    };
    fetchSimilar();
  }, [product?.product_id, open]);

  if (!product) return null;

  const actionType: ProductActionType = (product.action_type as ProductActionType) || 'add_to_cart';
  const config = ACTION_CONFIG[actionType] || ACTION_CONFIG.add_to_cart;
  const isCartAction = config.isCart;

  const cartItem = items.find((item) => item.product_id === product.product_id);
  const quantity = cartItem?.quantity || 0;

  const handleAdd = () => {
    if (actionType === 'contact_seller') {
      setContactOpen(true);
      return;
    }
    if (!isCartAction) {
      setEnquiryOpen(true);
      return;
    }
    addItem({
      id: product.product_id,
      seller_id: product.seller_id,
      name: product.product_name,
      price: product.price,
      image_url: product.image_url,
      is_veg: product.is_veg ?? true,
      is_available: true,
      category: product.category as any,
      description: product.description || null,
      is_bestseller: false,
      is_recommended: false,
      is_urgent: false,
      created_at: '',
      updated_at: '',
    });
  };

  const isNewSeller = product.seller_reviews === 0 || product.seller_rating === 0;
  const ActionIcon = config.icon;
  const viewAllLabel = isCartAction ? 'View Full Menu →' : 'View All Listings →';

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>{product.product_name}</SheetTitle>
          </SheetHeader>

          {/* Image — full width carousel style */}
          <div className="relative w-full aspect-[4/3] max-h-[45vh] bg-muted">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.product_name}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-6xl">{categoryIcon || '🛍️'}</span>
              </div>
            )}
            {/* Dot indicator placeholder */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
              <div className="w-5 h-1.5 rounded-full bg-foreground" />
              <div className="w-1.5 h-1.5 rounded-full bg-foreground/30" />
              <div className="w-1.5 h-1.5 rounded-full bg-foreground/30" />
            </div>
          </div>

          <div className="p-4 space-y-3">
            {/* Delivery time badge */}
            {product.prep_time_minutes && (
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1 bg-muted rounded-md px-2 py-1">
                  <Clock size={12} className="text-muted-foreground" />
                  <span className="text-[11px] font-bold text-muted-foreground uppercase">
                    {product.prep_time_minutes} MINS
                  </span>
                </div>
              </div>
            )}

            {/* Product Name + Veg badge */}
            <div className="flex items-start gap-2">
              {product.is_veg !== null && <VegBadge isVeg={product.is_veg} size="sm" className="mt-1" />}
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-lg leading-tight text-foreground">{product.product_name}</h2>
                {categoryName && (
                  <span className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    {categoryIcon && <span>{categoryIcon}</span>}
                    {categoryName}
                  </span>
                )}
              </div>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-2">
              {actionType === 'contact_seller' ? (
                <span className="text-sm font-medium text-muted-foreground">Contact for price</span>
              ) : (
                <span className="text-xl font-bold text-foreground">₹{product.price}</span>
              )}
            </div>

            {/* "View product details" expandable */}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1 text-xs font-medium text-primary"
            >
              View product details
              <ChevronDown size={14} className={`transition-transform ${showDetails ? 'rotate-180' : ''}`} />
            </button>

            {showDetails && (
              <div className="space-y-3 animate-fade-in">
                {/* Quick support badges */}
                {product.fulfillment_mode && (
                  <div className="flex gap-3">
                    {product.fulfillment_mode === 'delivery' || product.fulfillment_mode === 'both' ? (
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Truck size={14} className="text-accent" />
                        <span>Seller Delivers</span>
                      </div>
                    ) : null}
                    {product.fulfillment_mode === 'self_pickup' || product.fulfillment_mode === 'both' ? (
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Shield size={14} className="text-accent" />
                        <span>Self Pickup</span>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Fulfillment info */}
                {product.fulfillment_mode && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
                    <Truck size={14} />
                    <span>
                      {product.fulfillment_mode === 'self_pickup' && 'Self Pickup Only'}
                      {product.fulfillment_mode === 'delivery' && 'Seller Delivers'}
                      {product.fulfillment_mode === 'both' && 'Pickup or Delivery'}
                    </span>
                  </div>
                )}

                {product.delivery_note && (
                  <p className="text-xs text-muted-foreground italic">— {product.delivery_note}</p>
                )}

                {/* Description */}
                {product.description && (
                  <div>
                    <h4 className="text-xs font-bold text-foreground mb-1">Highlights</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{product.description}</p>
                  </div>
                )}

                {/* Trust Snapshot */}
                {trustSnapshot && (trustSnapshot.completed_orders > 0 || trustSnapshot.avg_response_min > 0) && (
                  <div className="grid grid-cols-3 gap-2">
                    {trustSnapshot.completed_orders > 0 && (
                      <div className="bg-muted rounded-xl p-2.5 text-center">
                        <Users size={14} className="mx-auto text-primary mb-1" />
                        <p className="text-sm font-bold text-foreground">{trustSnapshot.completed_orders}</p>
                        <p className="text-[9px] text-muted-foreground">Orders</p>
                      </div>
                    )}
                    {trustSnapshot.avg_response_min > 0 && (
                      <div className="bg-muted rounded-xl p-2.5 text-center">
                        <Zap size={14} className="mx-auto text-accent mb-1" />
                        <p className="text-sm font-bold text-foreground">~{trustSnapshot.avg_response_min}m</p>
                        <p className="text-[9px] text-muted-foreground">Response</p>
                      </div>
                    )}
                    {trustSnapshot.repeat_customer_pct > 0 && (
                      <div className="bg-muted rounded-xl p-2.5 text-center">
                        <RotateCcw size={14} className="mx-auto text-primary mb-1" />
                        <p className="text-sm font-bold text-foreground">{trustSnapshot.repeat_customer_pct}%</p>
                        <p className="text-[9px] text-muted-foreground">Repeat</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Seller card — Blinkit style */}
            <Link
              to={`/seller/${product.seller_id}`}
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-3 bg-muted rounded-xl p-3"
            >
              <div className="w-10 h-10 rounded-xl bg-card flex items-center justify-center border border-border/30">
                <Store size={18} className="text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground truncate">{product.seller_name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {isNewSeller ? (
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                      New Seller
                    </Badge>
                  ) : null}
                  {product.is_same_society ? (
                    <span className="flex items-center gap-0.5 text-[10px] text-accent font-medium">
                      <Home size={10} /> Your neighbor
                    </span>
                  ) : (
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <MapPin size={10} />
                      {product.distance_km != null ? `${product.distance_km} km away` : product.society_name}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight size={16} className="text-muted-foreground shrink-0" />
            </Link>
          </div>

          {/* Similar Products */}
          {similarProducts.length > 0 && (
            <div className="px-4 pb-3">
              <h4 className="text-xs font-bold text-foreground mb-2 uppercase tracking-wide">Similar in {categoryName || 'this category'}</h4>
              <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
                {similarProducts.map((sp) => (
                  <div key={sp.id} className="shrink-0 w-28">
                    <div className="w-28 h-28 rounded-xl bg-muted overflow-hidden mb-1.5">
                      {sp.image_url ? (
                        <img src={sp.image_url} alt={sp.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">🛍️</div>
                      )}
                    </div>
                    <p className="text-[11px] font-medium line-clamp-1">{sp.name}</p>
                    <p className="text-[11px] text-muted-foreground">{sp.seller?.business_name}</p>
                    {sp.price > 0 && <p className="text-xs font-bold">₹{sp.price}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Report button — above sticky CTA */}
          <div className="px-6 pb-3">
            <button
              onClick={() => { onOpenChange(false); setReportOpen(true); }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              <Flag size={12} />
              Report this product
            </button>
          </div>

          {/* Sticky bottom CTA — Blinkit style */}
          <div className="sticky bottom-0 bg-background border-t border-border p-4">
            {isCartAction ? (
              quantity === 0 ? (
                <Button className="w-full h-12 text-base font-bold bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl" onClick={handleAdd}>
                  Add to cart · ₹{product.price}
                </Button>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-lg font-bold text-foreground">₹{product.price * quantity}</span>
                    <span className="text-xs text-muted-foreground ml-1.5">{quantity} item{quantity > 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center bg-accent rounded-xl overflow-hidden">
                    <button className="px-3 py-2.5 text-accent-foreground" onClick={() => updateQuantity(product.product_id, quantity - 1)}>
                      <Minus size={16} strokeWidth={3} />
                    </button>
                    <span className="font-bold text-base text-accent-foreground min-w-[28px] text-center">{quantity}</span>
                    <button className="px-3 py-2.5 text-accent-foreground" onClick={() => updateQuantity(product.product_id, quantity + 1)}>
                      <Plus size={16} strokeWidth={3} />
                    </button>
                  </div>
                </div>
              )
            ) : (
              <Button className="w-full h-12 text-base font-bold bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl" onClick={handleAdd}>
                <ActionIcon size={18} className="mr-2" />
                {config.label}
              </Button>
            )}
          </div>

        </SheetContent>
      </Sheet>

      {actionType === 'contact_seller' && (
        <ContactSellerModal
          open={contactOpen}
          onOpenChange={setContactOpen}
          sellerName={product.seller_name}
          phone={product.contact_phone || ''}
        />
      )}

      {!isCartAction && actionType !== 'contact_seller' && (
        <ProductEnquirySheet
          open={enquiryOpen}
          onOpenChange={setEnquiryOpen}
          productId={product.product_id}
          productName={product.product_name}
          sellerId={product.seller_id}
          sellerName={product.seller_name}
          actionType={actionType}
          price={product.price}
        />
      )}

      <ReportSheet
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetType="product"
        targetId={product.product_id}
        targetName={product.product_name}
      />
    </>
  );
}
