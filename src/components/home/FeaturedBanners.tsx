import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function FeaturedBanners() {
  const { effectiveSocietyId } = useAuth();
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(0);

  const { data: banners = [], isLoading } = useQuery({
    queryKey: ['featured-banners', effectiveSocietyId],
    queryFn: async () => {
      let query = supabase
        .from('featured_items')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (effectiveSocietyId) {
        query = query.or(`society_id.eq.${effectiveSocietyId},society_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Auto-scroll
  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % banners.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [banners.length]);

  const scrollToIndex = useCallback((idx: number) => {
    setActiveIndex(idx);
    const container = document.getElementById('banner-carousel');
    if (container) {
      const child = container.children[idx] as HTMLElement;
      child?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, []);

  // Sync scroll position with activeIndex
  useEffect(() => {
    const container = document.getElementById('banner-carousel');
    if (container && container.children[activeIndex]) {
      const child = container.children[activeIndex] as HTMLElement;
      child.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeIndex]);

  if (isLoading) {
    return (
      <div className="px-4">
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  if (banners.length === 0) return null;

  return (
    <div className="animate-fade-in">
      <div
        id="banner-carousel"
        className="flex gap-3 overflow-x-auto scrollbar-hide px-4 pb-1 snap-x snap-mandatory"
      >
        {banners.map((banner: any, idx: number) => (
          <div
            key={banner.id}
            onClick={() => banner.link_url && navigate(banner.link_url)}
            className={cn(
              'shrink-0 w-[85vw] sm:w-[400px] rounded-2xl overflow-hidden cursor-pointer snap-center',
              'border border-border/10 shadow-md',
              'transition-all duration-300 hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]'
            )}
          >
            {banner.image_url ? (
              <img
                src={banner.image_url}
                alt={banner.title || 'Featured'}
                className="w-full h-40 object-cover"
                loading="lazy"
              />
            ) : (
              <div
                className="w-full h-40 flex items-center justify-center p-6"
                style={{ background: 'var(--gradient-warm)' }}
              >
                <h3 className="text-lg font-bold text-primary-foreground text-center drop-shadow-sm">
                  {banner.title || 'Featured'}
                </h3>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Dot indicators */}
      {banners.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {banners.map((_: any, idx: number) => (
            <button
              key={idx}
              onClick={() => scrollToIndex(idx)}
              className={cn(
                'rounded-full transition-all duration-300',
                idx === activeIndex
                  ? 'w-5 h-1.5 bg-primary'
                  : 'w-1.5 h-1.5 bg-border hover:bg-muted-foreground/40'
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
