import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { Star, Store } from 'lucide-react';
import { cn } from '@/lib/utils';

const STORE_COLORS = [
  'from-rose-500/20 to-rose-500/5',
  'from-amber-500/20 to-amber-500/5',
  'from-emerald-500/20 to-emerald-500/5',
  'from-sky-500/20 to-sky-500/5',
  'from-violet-500/20 to-violet-500/5',
  'from-pink-500/20 to-pink-500/5',
];

export function ShopByStore() {
  const { effectiveSocietyId } = useAuth();
  const navigate = useNavigate();

  const { data: sellers = [], isLoading } = useQuery({
    queryKey: ['shop-by-store', effectiveSocietyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seller_profiles')
        .select('id, business_name, profile_image_url, cover_image_url, rating, total_reviews, primary_group, is_featured')
        .eq('verification_status', 'approved')
        .eq('is_available', true)
        .eq('society_id', effectiveSocietyId!)
        .order('is_featured', { ascending: false })
        .order('rating', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: !!effectiveSocietyId,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="px-4">
        <Skeleton className="h-5 w-32 mb-3" />
        <div className="flex gap-3">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="w-28 h-36 rounded-xl shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (sellers.length === 0) return null;

  return (
    <div>
      <h3 className="font-bold text-base text-foreground px-4 mb-3">Shop by store</h3>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4 pb-1">
        {sellers.map((seller: any, idx: number) => (
          <div
            key={seller.id}
            onClick={() => navigate(`/seller/${seller.id}`)}
            className={cn(
              'shrink-0 w-28 rounded-xl overflow-hidden cursor-pointer',
              'border border-border/30 transition-all hover:shadow-md active:scale-95',
              'bg-gradient-to-b',
              STORE_COLORS[idx % STORE_COLORS.length]
            )}
          >
            <div className="h-20 flex items-center justify-center p-2">
              {seller.profile_image_url || seller.cover_image_url ? (
                <img
                  src={seller.profile_image_url || seller.cover_image_url}
                  alt={seller.business_name}
                  className="w-14 h-14 rounded-lg object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-muted/50 flex items-center justify-center">
                  <Store className="text-muted-foreground" size={24} />
                </div>
              )}
            </div>
            <div className="px-2 pb-2 text-center">
              <p className="text-[11px] font-semibold text-foreground line-clamp-2 leading-tight">
                {seller.business_name}
              </p>
              {seller.rating > 0 && (
                <div className="flex items-center justify-center gap-0.5 mt-1">
                  <Star size={9} className="text-amber-500 fill-amber-500" />
                  <span className="text-[9px] font-medium text-muted-foreground">
                    {seller.rating}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
