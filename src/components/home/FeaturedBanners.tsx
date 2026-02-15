import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';

export function FeaturedBanners() {
  const { effectiveSocietyId } = useAuth();
  const navigate = useNavigate();

  const { data: banners = [], isLoading } = useQuery({
    queryKey: ['featured-banners', effectiveSocietyId],
    queryFn: async () => {
      let query = supabase
        .from('featured_items')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (effectiveSocietyId) {
        // Show society-specific + global banners
        query = query.or(`society_id.eq.${effectiveSocietyId},society_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="px-4">
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  if (banners.length === 0) return null;

  return (
    <div className="px-4">
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
        {banners.map((banner: any) => (
          <div
            key={banner.id}
            onClick={() => banner.link_url && navigate(banner.link_url)}
            className="shrink-0 w-[85vw] sm:w-[400px] rounded-2xl overflow-hidden cursor-pointer
              bg-gradient-to-br from-primary/10 to-accent/30 border border-border/20
              transition-transform hover:scale-[1.01] active:scale-[0.99]"
          >
            {banner.image_url ? (
              <img
                src={banner.image_url}
                alt={banner.title || 'Featured'}
                className="w-full h-40 object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-40 flex items-center justify-center p-6">
                <h3 className="text-lg font-bold text-foreground text-center">
                  {banner.title || 'Featured'}
                </h3>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
