import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { jitteredStaleTime } from '@/lib/query-utils';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { Star, Store } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ShopByStore() {
  const { effectiveSocietyId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Realtime subscription for seller_profiles changes (e.g. is_featured toggle)
  useEffect(() => {
    if (!effectiveSocietyId) return;
    const channel = supabase
      .channel('seller-profiles-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'seller_profiles', filter: `society_id=eq.${effectiveSocietyId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['shop-by-store'] });
          queryClient.invalidateQueries({ queryKey: ['local-sellers'] });
          queryClient.invalidateQueries({ queryKey: ['nearby-sellers'] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [effectiveSocietyId, queryClient]);

  const { data: sellers = [], isLoading } = useQuery({
    queryKey: ['shop-by-store', effectiveSocietyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seller_profiles')
        .select('id, business_name, profile_image_url, cover_image_url, rating, total_reviews, primary_group, is_featured, products!inner(id)')
        .eq('verification_status', 'approved')
        .eq('is_available', true)
        .eq('society_id', effectiveSocietyId!)
        .eq('products.is_available', true)
        .eq('products.approval_status', 'approved')
        .order('is_featured', { ascending: false })
        .order('rating', { ascending: false })
        .limit(10);

      if (error) throw error;
      // Remove the joined products array from the response to keep shape clean
      return (data || []).map(({ products, ...rest }: any) => rest);
    },
    enabled: !!effectiveSocietyId,
    staleTime: jitteredStaleTime(60_000),
  });

  if (isLoading) {
    return (
      <div className="px-4 mt-4">
        <Skeleton className="h-5 w-32 mb-3" />
        <div className="flex gap-3">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="w-24 h-32 rounded-2xl shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (sellers.length === 0) return null;

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between px-4 mb-2.5">
        <h3 className="font-bold text-sm text-foreground">Shop by store</h3>
      </div>

      <div className="relative">
        <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4 pb-1">
          {sellers.map((seller: any) => (
            <div
              key={seller.id}
              onClick={() => navigate(`/seller/${seller.id}`)}
              className={cn(
                'shrink-0 w-24 rounded-2xl overflow-hidden cursor-pointer',
                'bg-card border border-border/30',
                'transition-all duration-200 hover:shadow-md hover:scale-[1.03] active:scale-95'
              )}
            >
              <div className="h-16 flex items-center justify-center p-2 bg-muted/50">
                {seller.profile_image_url || seller.cover_image_url ? (
                  <img
                    src={seller.profile_image_url || seller.cover_image_url}
                    alt={seller.business_name}
                    className="w-12 h-12 rounded-xl object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                    <Store className="text-muted-foreground" size={22} />
                  </div>
                )}
              </div>
              <div className="px-1.5 pb-2 pt-1.5 text-center">
                <p className="text-[10px] font-semibold text-foreground line-clamp-2 leading-tight">
                  {seller.business_name}
                </p>
                {seller.rating > 0 && (
                  <div className="flex items-center justify-center gap-0.5 mt-0.5">
                    <Star size={8} className="text-warning fill-warning" />
                    <span className="text-[9px] font-bold text-muted-foreground tabular-nums">
                      {seller.rating}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="absolute right-0 top-0 bottom-1 w-8 pointer-events-none bg-gradient-to-l from-background to-transparent" />
      </div>
    </div>
  );
}
