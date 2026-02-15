import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { VegBadge } from '@/components/ui/veg-badge';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/hooks/useCart';
import { useSellerTrustSnapshot } from '@/hooks/queries/useProductTrustMetrics';
import { ContactSellerModal } from './ContactSellerModal';
import { ProductEnquirySheet } from './ProductEnquirySheet';
import { ProductActionType } from '@/types/database';
import { ACTION_CONFIG } from '@/lib/marketplace-constants';
import { Plus, Minus, Store, MapPin, Home, Clock, Truck, Users, Zap, RotateCcw, ChevronRight } from 'lucide-react';

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

    // Non-cart actions open the enquiry sheet
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

  // Dynamic label for "View Full Menu" based on category type
  const viewAllLabel = isCartAction ? 'View Full Menu →' : 'View All Listings →';

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>{product.product_name}</SheetTitle>
          </SheetHeader>

          {/* Big Product Image */}
          <div className="relative w-full aspect-[16/10] bg-muted">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.product_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-5xl">{categoryIcon || '🛍️'}</span>
              </div>
            )}
          </div>

          <div className="p-4 space-y-4">
            {/* Product Name + Price */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 min-w-0">
                {product.is_veg !== null && <VegBadge isVeg={product.is_veg} size="sm" className="mt-1" />}
                <div>
                  <h2 className="font-bold text-lg leading-tight">{product.product_name}</h2>
                  {categoryName && (
                    <span className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      {categoryIcon && <span>{categoryIcon}</span>}
                      {categoryName}
                    </span>
                  )}
                </div>
              </div>
              {actionType === 'contact_seller' ? (
                <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Contact for price</span>
              ) : (
                <span className="text-xl font-bold text-primary whitespace-nowrap">₹{product.price}</span>
              )}
            </div>

            {/* Quick info chips */}
            <div className="flex flex-wrap gap-2">
              {product.prep_time_minutes && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted rounded-full px-2.5 py-1">
                  <Clock size={12} />
                  <span>Ready in ~{product.prep_time_minutes} min</span>
                </div>
              )}
              {product.fulfillment_mode && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted rounded-full px-2.5 py-1">
                  <Truck size={12} />
                  <span>
                    {product.fulfillment_mode === 'self_pickup' && 'Self Pickup Only'}
                    {product.fulfillment_mode === 'delivery' && 'Seller Delivers'}
                    {product.fulfillment_mode === 'both' && 'Pickup or Delivery'}
                  </span>
                </div>
              )}
              {product.delivery_note && (
                <span className="text-xs text-muted-foreground italic">— {product.delivery_note}</span>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">{product.description}</p>
            )}

            {/* Seller Identity */}
            <Link
              to={`/seller/${product.seller_id}`}
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-3 bg-muted/60 rounded-xl p-3 border border-border/30"
            >
              <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center">
                <Store size={20} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{product.seller_name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {isNewSeller ? (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-secondary text-secondary-foreground">
                      New Seller
                    </Badge>
                  ) : null}
                  {product.is_same_society ? (
                    <span className="flex items-center gap-0.5 text-[11px] text-primary">
                      <Home size={10} /> Your neighbor
                    </span>
                  ) : (
                    <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                      <MapPin size={10} />
                      {product.distance_km != null ? `${product.distance_km} km away` : product.society_name}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </Link>

            {/* Trust Snapshot */}
            {trustSnapshot && (trustSnapshot.completed_orders > 0 || trustSnapshot.avg_response_min > 0) && (
              <div className="grid grid-cols-3 gap-2">
                {trustSnapshot.completed_orders > 0 && (
                  <div className="bg-muted/50 rounded-lg p-2.5 text-center">
                    <Users size={16} className="mx-auto text-primary mb-1" />
                    <p className="text-sm font-bold">{trustSnapshot.completed_orders}</p>
                    <p className="text-[10px] text-muted-foreground">Orders done</p>
                  </div>
                )}
                {trustSnapshot.avg_response_min > 0 && (
                  <div className="bg-muted/50 rounded-lg p-2.5 text-center">
                    <Zap size={16} className="mx-auto text-success mb-1" />
                    <p className="text-sm font-bold">~{trustSnapshot.avg_response_min}m</p>
                    <p className="text-[10px] text-muted-foreground">Response</p>
                  </div>
                )}
                {trustSnapshot.repeat_customer_pct > 0 && (
                  <div className="bg-muted/50 rounded-lg p-2.5 text-center">
                    <RotateCcw size={16} className="mx-auto text-accent mb-1" />
                    <p className="text-sm font-bold">{trustSnapshot.repeat_customer_pct}%</p>
                    <p className="text-[10px] text-muted-foreground">Repeat</p>
                  </div>
                )}
              </div>
            )}

            {/* Dynamic CTA */}
            <div className="pt-2">
              {isCartAction ? (
                quantity === 0 ? (
                  <Button className="w-full h-12 text-base font-semibold" onClick={handleAdd}>
                    <ActionIcon size={18} className="mr-2" />
                    {config.label} · ₹{product.price}
                  </Button>
                ) : (
                  <div className="flex items-center justify-between bg-primary rounded-xl px-4 h-12">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 w-9 p-0 text-primary-foreground hover:bg-primary-foreground/20"
                      onClick={() => updateQuantity(product.product_id, quantity - 1)}
                    >
                      <Minus size={18} />
                    </Button>
                    <span className="text-lg font-bold text-primary-foreground">{quantity} in cart</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 w-9 p-0 text-primary-foreground hover:bg-primary-foreground/20"
                      onClick={() => updateQuantity(product.product_id, quantity + 1)}
                    >
                      <Plus size={18} />
                    </Button>
                  </div>
                )
              ) : (
                <Button className="w-full h-12 text-base font-semibold" onClick={handleAdd}>
                  <ActionIcon size={18} className="mr-2" />
                  {config.label}
                </Button>
              )}
            </div>

            {/* View Full Menu/Listings link */}
            <Link
              to={`/seller/${product.seller_id}`}
              onClick={() => onOpenChange(false)}
              className="block text-center text-sm text-primary font-medium py-2"
            >
              {viewAllLabel}
            </Link>
          </div>
        </SheetContent>
      </Sheet>

      {/* Contact Seller Modal */}
      {actionType === 'contact_seller' && (
        <ContactSellerModal
          open={contactOpen}
          onOpenChange={setContactOpen}
          sellerName={product.seller_name}
          phone={product.contact_phone || ''}
        />
      )}

      {/* Enquiry Sheet for non-cart, non-contact actions */}
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
    </>
  );
}
