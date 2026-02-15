import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ProductWithSeller } from '@/components/product/ProductGridCard';

interface CategoryGroup {
  category: string;
  displayName: string;
  icon: string;
  products: ProductWithSeller[];
}

export function useProductsByCategory(limit = 50) {
  const { effectiveSocietyId } = useAuth();

  return useQuery({
    queryKey: ['products-by-category', effectiveSocietyId, limit],
    queryFn: async (): Promise<CategoryGroup[]> => {
      // Fetch category configs
      const { data: configs } = await supabase
        .from('category_config')
        .select('category, display_name, icon, supports_cart')
        .eq('is_active', true)
        .order('display_order');

      // Fetch products with seller info
      let query = supabase
        .from('products')
        .select(`
          *,
          seller:seller_profiles!products_seller_id_fkey(
            id, business_name, rating, society_id, verification_status, fulfillment_mode, delivery_note
          )
        `)
        .eq('is_available', true)
        .eq('approval_status', 'approved')
        .order('is_bestseller', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (effectiveSocietyId) {
        query = query.eq('seller.society_id', effectiveSocietyId);
      }

      const { data: products, error } = await query;
      if (error) throw error;

      const approved = (products || [])
        .filter((p: any) => p.seller?.verification_status === 'approved')
        .map((p: any) => ({
          ...p,
          seller_name: p.seller?.business_name || 'Seller',
          seller_rating: p.seller?.rating || 0,
          seller_id: p.seller_id,
          fulfillment_mode: p.seller?.fulfillment_mode || null,
          delivery_note: p.seller?.delivery_note || null,
        }));

      // Group by category
      const configMap = new Map(
        (configs || []).map((c: any) => [c.category, c])
      );

      const grouped: Record<string, ProductWithSeller[]> = {};
      for (const product of approved) {
        const cat = product.category;
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(product);
      }

      // Build ordered result using config order
      const result: CategoryGroup[] = [];
      for (const [category, items] of Object.entries(grouped)) {
        const cfg = configMap.get(category);
        result.push({
          category,
          displayName: cfg?.display_name || category,
          icon: cfg?.icon || '📦',
          products: items,
        });
      }

      return result;
    },
    enabled: !!effectiveSocietyId,
    staleTime: 5 * 60 * 1000,
  });
}
