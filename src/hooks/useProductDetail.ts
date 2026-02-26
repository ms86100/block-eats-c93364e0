import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/hooks/useCart';
import { useSellerTrustSnapshot } from '@/hooks/queries/useProductTrustMetrics';
import { ProductActionType } from '@/types/database';
import { ACTION_CONFIG } from '@/lib/marketplace-constants';
import { useCurrency } from '@/hooks/useCurrency';
import { hapticImpact } from '@/lib/haptics';

export interface ProductDetail {
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
  specifications?: Record<string, any> | null;
  seller_id: string;
  seller_name: string;
  seller_rating: number;
  seller_reviews: number;
  society_name: string | null;
  distance_km: number | null;
  is_same_society: boolean;
}

export function useProductDetail(product: ProductDetail | null, open: boolean, onOpenChange?: (open: boolean) => void) {
  const { items, addItem, updateQuantity } = useCart();
  const { data: trustSnapshot } = useSellerTrustSnapshot(product?.seller_id || null);
  const [contactOpen, setContactOpen] = useState(false);
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [similarProducts, setSimilarProducts] = useState<any[]>([]);
  const [loadedSpecs, setLoadedSpecs] = useState<Record<string, any> | null>(null);
  const { formatPrice } = useCurrency();

  useEffect(() => {
    if (!product || !open) return;
    setLoadedSpecs(null);

    const fetchData = async () => {
      const [specsRes, similarRes] = await Promise.all([
        supabase.from('products').select('specifications').eq('id', product.product_id).maybeSingle(),
        supabase.from('products')
          .select('id, name, price, image_url, is_veg, seller_id, seller:seller_profiles!products_seller_id_fkey(business_name, society_id)')
          .eq('category', product.category as string)
          .eq('is_available', true).eq('approval_status', 'approved')
          .neq('id', product.product_id).limit(6),
      ]);
      setLoadedSpecs(specsRes.data?.specifications as Record<string, any> | null);
      // Filter similar products to same society when applicable
      const rawSimilar = similarRes.data || [];
      const filtered = product.is_same_society
        ? rawSimilar.filter((p: any) => !p.seller?.society_id || p.seller.society_id === (product as any).seller?.society_id)
        : rawSimilar;
      setSimilarProducts(filtered);
    };
    fetchData();
  }, [product?.product_id, open]);

  const actionType: ProductActionType = (product?.action_type as ProductActionType) || 'add_to_cart';
  const config = ACTION_CONFIG[actionType] || ACTION_CONFIG.add_to_cart;
  const isCartAction = config.isCart;

  const cartItem = items.find((item) => item.product_id === product?.product_id);
  const quantity = cartItem?.quantity || 0;

  const navigate = useNavigate();

  const handleAdd = useCallback(() => {
    if (!product) return;
    if (actionType === 'contact_seller') { setContactOpen(true); return; }
    if (!isCartAction) { setEnquiryOpen(true); return; }
    hapticImpact('medium');
    addItem({
      id: product.product_id, seller_id: product.seller_id,
      name: product.product_name, price: product.price,
      image_url: product.image_url, is_veg: product.is_veg ?? true,
      is_available: true, category: product.category as any,
      description: product.description || null,
      is_bestseller: false, is_recommended: false, is_urgent: false,
      created_at: '', updated_at: '',
    });
    // Only navigate to cart for buy_now; add_to_cart stays on sheet with stepper
    if (actionType === 'buy_now') {
      onOpenChange?.(false);
      navigate('/cart');
    }
  }, [product, actionType, isCartAction, addItem, onOpenChange, navigate]);

  const isNewSeller = (product?.seller_reviews === 0) || (product?.seller_rating === 0);
  const ActionIcon = config.icon;
  const viewAllLabel = isCartAction ? 'View Full Menu →' : 'View All Listings →';

  return {
    trustSnapshot, contactOpen, setContactOpen, enquiryOpen, setEnquiryOpen,
    showDetails, setShowDetails, reportOpen, setReportOpen,
    similarProducts, loadedSpecs, formatPrice,
    actionType, config, isCartAction, cartItem, quantity,
    handleAdd, isNewSeller, ActionIcon, viewAllLabel,
    items, updateQuantity,
  };
}
