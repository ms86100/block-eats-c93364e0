import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { Star, Store, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const STORE_TINTS = [
  'from-[hsl(var(--tint-food))] to-card',
  'from-[hsl(var(--tint-services))] to-card',
  'from-[hsl(var(--tint-personal))] to-card',
  'from-[hsl(var(--tint-resale))] to-card',
  'from-[hsl(var(--tint-events))] to-card',
  'from-[hsl(var(--tint-default))] to-card',
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
            <Skeleton key={i} className="w-28 h-36 rounded-2xl shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (sellers.length === 0) return null;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between px-4 mb-3">
        <h3 className="font-bold text-base text-foreground">Shop by store</h3>
        <button className="flex items-center gap-0.5 bg-card/80 border border-border/40 text-[10px] font-semibold text-primary px-2.5 py-1 rounded-full hover:bg-card transition-colors">
          see all <ChevronRight size={10} />
        </button>
      </div>

      {/* Carousel with peek effect */}
      <div className="relative">
        <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4 pb-1">
          {sellers.map((seller: any, idx: number) => (
            <div
              key={seller.id}
              onClick={() => navigate(`/seller/${seller.id}`)}
              className={cn(
                'shrink-0 w-28 rounded-2xl overflow-hidden cursor-pointer',
                'border border-white/30 transition-all duration-200 hover:shadow-lg hover:scale-[1.03] active:scale-95',
                'bg-gradient-to-b shadow-sm',
                STORE_TINTS[idx % STORE_TINTS.length]
              )}
            >
              <div className="h-20 flex items-center justify-center p-2">
                {seller.profile_image_url || seller.cover_image_url ? (
                  <img
                    src={seller.profile_image_url || seller.cover_image_url}
                    alt={seller.business_name}
                    className="w-14 h-14 rounded-xl object-cover shadow-sm"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-muted/50 flex items-center justify-center">
                    <Store className="text-muted-foreground" size={24} />
                  </div>
                )}
              </div>
              <div className="px-2 pb-2.5 text-center">
                <p className="text-[11px] font-semibold text-foreground line-clamp-2 leading-tight">
                  {seller.business_name}
                </p>
                {seller.rating > 0 && (
                  <div className="flex items-center justify-center gap-0.5 mt-1">
                    <Star size={9} className="text-accent fill-accent" />
                    <span className="text-[9px] font-bold text-muted-foreground">
                      {seller.rating}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        {/* Right fade for peek effect */}
        <div className="absolute right-0 top-0 bottom-1 w-8 pointer-events-none bg-gradient-to-l from-background to-transparent" />
      </div>
    </div>
  );
}
