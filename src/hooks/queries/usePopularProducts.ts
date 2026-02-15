import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ProductWithSeller } from '@/components/product/ProductGridCard';

export function usePopularProducts(limit = 12) {
  const { effectiveSocietyId } = useAuth();

  return useQuery({
    queryKey: ['popular-products', effectiveSocietyId, limit],
    queryFn: async (): Promise<ProductWithSeller[]> => {
      // Fetch products that have the most order_items
      // We'll use a simple approach: get products ordered by bestseller flag + recent activity
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

      // Filter by sellers in the user's society
      if (effectiveSocietyId) {
        query = query.eq('seller.society_id', effectiveSocietyId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || [])
        .filter((p: any) => p.seller?.verification_status === 'approved')
        .map((p: any) => ({
          ...p,
          seller_name: p.seller?.business_name || 'Seller',
          seller_rating: p.seller?.rating || 0,
          seller_id: p.seller_id,
          fulfillment_mode: p.seller?.fulfillment_mode || null,
          delivery_note: p.seller?.delivery_note || null,
        }));
    },
    enabled: !!effectiveSocietyId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCategoryProducts(parentGroup: string | null, societyId: string | null) {
  return useQuery({
    queryKey: ['category-products', parentGroup, societyId],
    queryFn: async (): Promise<ProductWithSeller[]> => {
      // Fetch all products where seller's primary_group matches
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          seller:seller_profiles!products_seller_id_fkey(
            id, business_name, rating, society_id, verification_status, primary_group, fulfillment_mode
          )
        `)
        .eq('is_available', true)
        .eq('approval_status', 'approved')
        .order('is_bestseller', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || [])
        .filter((p: any) => {
          const seller = p.seller;
          if (!seller || seller.verification_status !== 'approved') return false;
          if (parentGroup && seller.primary_group !== parentGroup) return false;
          if (societyId && seller.society_id !== societyId) return false;
          return true;
        })
        .map((p: any) => ({
          ...p,
          seller_name: p.seller?.business_name || 'Seller',
          seller_rating: p.seller?.rating || 0,
          seller_id: p.seller_id,
          fulfillment_mode: p.seller?.fulfillment_mode || null,
          delivery_note: p.seller?.delivery_note || null,
        }));
    },
    enabled: !!parentGroup,
    staleTime: 3 * 60 * 1000,
  });
}
