import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ProductWithSeller } from '@/components/product/ProductListingCard';
import { jitteredStaleTime } from '@/lib/query-utils';

/**
 * Shared hook that calls `search_nearby_sellers` RPC and returns
 * a flat, deduplicated list of cross-society products in the
 * `ProductWithSeller` shape.
 *
 * Only fires when the buyer has `browse_beyond_community = true`.
 * The RPC already enforces seller `sell_beyond_community`, delivery
 * radius, distance, approval status, and product availability.
 */
export function useNearbyProducts() {
  const { effectiveSocietyId, profile } = useAuth();

  const browseBeyond = profile?.browse_beyond_community !== false;
  const searchRadius = profile?.search_radius_km ?? 10;

  return useQuery({
    queryKey: ['nearby-products', effectiveSocietyId, searchRadius],
    queryFn: async (): Promise<ProductWithSeller[]> => {
      const { data, error } = await supabase.rpc('search_nearby_sellers', {
        _buyer_society_id: effectiveSocietyId!,
        _radius_km: searchRadius,
      });

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Flatten: each seller row has a `matching_products` JSONB array
      const products: ProductWithSeller[] = [];
      for (const seller of data as any[]) {
        const items = seller.matching_products;
        if (!Array.isArray(items)) continue;

        for (const p of items) {
          products.push({
            id: p.id,
            seller_id: seller.seller_id,
            name: p.name,
            price: p.price,
            image_url: p.image_url,
            category: p.category,
            is_veg: p.is_veg ?? true,
            is_available: true,
            is_bestseller: false,
            is_recommended: false,
            is_urgent: false,
            description: null,
            action_type: p.action_type || 'add_to_cart',
            contact_phone: p.contact_phone || null,
            mrp: p.mrp || null,
            discount_percentage: p.discount_percentage || null,
            seller_name: seller.business_name || 'Seller',
            seller_rating: seller.rating || 0,
            fulfillment_mode: null,
            delivery_note: null,
            created_at: '',
            updated_at: '',
          });
        }
      }
      return products;
    },
    enabled: !!effectiveSocietyId && browseBeyond,
    staleTime: jitteredStaleTime(5 * 60 * 1000),
  });
}

/** Utility: merge local products with nearby products, dedup by id */
export function mergeProducts(
  local: ProductWithSeller[],
  nearby: ProductWithSeller[] | undefined,
): ProductWithSeller[] {
  if (!nearby || nearby.length === 0) return local;
  const seen = new Set(local.map((p) => p.id));
  const merged = [...local];
  for (const p of nearby) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      merged.push(p);
    }
  }
  return merged;
}
