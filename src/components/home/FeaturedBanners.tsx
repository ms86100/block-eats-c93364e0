import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function FeaturedBanners() {
  const { effectiveSocietyId } = useAuth();
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(0);

  const queryClient = useQueryClient();

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
    staleTime: 60_000,
    refetchOnMount: true,
  });

  // Realtime subscription for featured_items — new banners appear immediately
  useEffect(() => {
    const channel = supabase
      .channel('featured-items-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'featured_items' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['featured-banners'] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Auto-scroll with pause on user interaction — uses per-banner interval or default 4s
  const [userInteracting, setUserInteracting] = useState(false);
  const autoRotateMs = ((banners[activeIndex] as any)?.auto_rotate_seconds || 4) * 1000;
  useEffect(() => {
    if (banners.length <= 1 || userInteracting) return;
    const interval = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % banners.length);
    }, autoRotateMs);
    return () => clearInterval(interval);
  }, [banners.length, userInteracting, autoRotateMs]);

  useEffect(() => {
    const container = document.getElementById('banner-carousel');
    if (!container) return;
    let resumeTimeout: ReturnType<typeof setTimeout>;
    const handleTouchStart = () => {
      setUserInteracting(true);
      clearTimeout(resumeTimeout);
    };
    const handleTouchEnd = () => {
      resumeTimeout = setTimeout(() => setUserInteracting(false), 8000);
    };
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchend', handleTouchEnd);
      clearTimeout(resumeTimeout);
    };
  }, []);

  useEffect(() => {
    const container = document.getElementById('banner-carousel');
    if (container && container.children[activeIndex]) {
      const child = container.children[activeIndex] as HTMLElement;
      child.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeIndex]);

  useEffect(() => {
    const container = document.getElementById('banner-carousel');
    if (!container || banners.length <= 1) return;

    let scrollTimeout: ReturnType<typeof setTimeout>;
    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const containerRect = container.getBoundingClientRect();
        const centerX = containerRect.left + containerRect.width / 2;
        let closestIdx = 0;
        let closestDist = Infinity;
        Array.from(container.children).forEach((child, idx) => {
          const childRect = (child as HTMLElement).getBoundingClientRect();
          const childCenter = childRect.left + childRect.width / 2;
          const dist = Math.abs(childCenter - centerX);
          if (dist < closestDist) {
            closestDist = dist;
            closestIdx = idx;
          }
        });
        setActiveIndex(closestIdx);
      }, 80);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, [banners.length]);

  const scrollToIndex = useCallback((idx: number) => {
    setActiveIndex(idx);
  }, []);

  if (isLoading) {
    return (
      <div className="px-4 my-4">
        <Skeleton className="h-36 rounded-2xl" />
      </div>
    );
  }

  if (banners.length === 0) return null;

  return (
    <div className="my-4">
      <div
        id="banner-carousel"
        className="flex gap-3 overflow-x-auto scrollbar-hide px-4 pb-1 snap-x snap-mandatory"
      >
        {banners.map((banner: any) => (
          <div
            key={banner.id}
            onClick={() => banner.link_url && navigate(banner.link_url)}
            className={cn(
              'shrink-0 w-[85vw] sm:w-[400px] rounded-3xl overflow-hidden snap-center',
              'border border-border',
              'transition-all duration-200 hover:shadow-md active:scale-[0.99]',
              banner.link_url && 'cursor-pointer'
            )}
          >
            <BannerContent banner={banner} />
          </div>
        ))}
      </div>

      {banners.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2.5">
          {banners.map((_: any, idx: number) => (
            <button
              key={idx}
              onClick={() => scrollToIndex(idx)}
              aria-label={`Go to banner ${idx + 1}`}
              className="rounded-full transition-all duration-300 min-h-[24px] min-w-[24px] flex items-center justify-center"
            >
              <span className={cn(
                'rounded-full transition-all duration-300',
                idx === activeIndex
                  ? 'w-5 h-1.5 bg-primary'
                  : 'w-1.5 h-1.5 bg-border'
              )} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Template-based rendering ── */
function BannerContent({ banner }: { banner: any }) {
  const template = banner.template || 'image_only';
  const { title, subtitle, image_url, button_text, bg_color = '#16a34a' } = banner;

  if (template === 'image_only') {
    return image_url ? (
      <img src={image_url} alt={title || 'Featured'} className="w-full h-36 object-cover" loading="lazy" />
    ) : (
      <div className="w-full h-36 flex items-center justify-center p-6 bg-primary">
        <h3 className="text-lg font-bold text-primary-foreground text-center">{title || 'Featured'}</h3>
      </div>
    );
  }

  if (template === 'text_overlay') {
    return (
      <div className="relative w-full h-36">
        {image_url ? (
          <img src={image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full" style={{ backgroundColor: bg_color }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent flex flex-col justify-end p-4">
          <h3 className="text-white font-bold text-base">{title}</h3>
          {subtitle && <p className="text-white/80 text-xs mt-0.5">{subtitle}</p>}
          {button_text && (
            <span className="mt-2 inline-block bg-white text-black text-xs font-bold px-3 py-1 rounded-full w-fit">
              {button_text}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (template === 'split_left') {
    return (
      <div className="flex h-36" style={{ backgroundColor: bg_color }}>
        <div className="flex-1 flex flex-col justify-center p-4">
          <h3 className="text-white font-bold text-sm leading-tight">{title}</h3>
          {subtitle && <p className="text-white/80 text-[10px] mt-1">{subtitle}</p>}
          {button_text && (
            <span className="mt-2 inline-block bg-white text-xs font-bold px-3 py-1 rounded-full w-fit" style={{ color: bg_color }}>
              {button_text}
            </span>
          )}
        </div>
        {image_url && (
          <div className="w-2/5 shrink-0">
            <img src={image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
          </div>
        )}
      </div>
    );
  }

  if (template === 'gradient_cta') {
    return (
      <div
        className="w-full h-36 flex flex-col items-center justify-center text-center p-4"
        style={{ background: `linear-gradient(135deg, ${bg_color}, ${bg_color}cc)` }}
      >
        <h3 className="text-white font-extrabold text-lg">{title}</h3>
        {subtitle && <p className="text-white/85 text-xs mt-1 max-w-[80%]">{subtitle}</p>}
        {button_text && (
          <span className="mt-3 bg-white text-xs font-bold px-4 py-1.5 rounded-full" style={{ color: bg_color }}>
            {button_text}
          </span>
        )}
      </div>
    );
  }

  // minimal_text
  return (
    <div className="w-full h-36 flex flex-col items-center justify-center p-6 bg-card border-l-4" style={{ borderColor: bg_color }}>
      <h3 className="font-bold text-base text-foreground">{title}</h3>
      {subtitle && <p className="text-xs text-muted-foreground mt-1 text-center">{subtitle}</p>}
      {button_text && (
        <span className="mt-3 text-xs font-bold px-4 py-1.5 rounded-full border" style={{ color: bg_color, borderColor: bg_color }}>
          {button_text}
        </span>
      )}
    </div>
  );
}
