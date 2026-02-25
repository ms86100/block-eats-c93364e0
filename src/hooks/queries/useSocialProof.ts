import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { jitteredStaleTime } from '@/lib/query-utils';

/**
 * Fetches society-scoped social proof for a batch of product IDs.
 * Returns a Map<productId, familiesThisWeek>.
 */
export function useSocialProof(productIds: string[]) {
  const { effectiveSocietyId } = useAuth();

  return useQuery({
    queryKey: ['social-proof', effectiveSocietyId, productIds.slice(0, 5).join(',')],
    queryFn: async (): Promise<Map<string, number>> => {
      if (!effectiveSocietyId || productIds.length === 0) return new Map();

      const { data, error } = await supabase.rpc('get_society_order_stats', {
        _product_ids: productIds,
        _society_id: effectiveSocietyId,
      });

      if (error) {
        console.warn('[SocialProof] RPC error:', error.message);
        return new Map();
      }

      const map = new Map<string, number>();
      for (const row of data || []) {
        if (row.families_this_week > 0) {
          map.set(row.product_id, row.families_this_week);
        }
      }
      return map;
    },
    enabled: !!effectiveSocietyId && productIds.length > 0,
    staleTime: jitteredStaleTime(5 * 60 * 1000),
  });
}
