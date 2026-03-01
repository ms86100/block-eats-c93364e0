import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import useEmblaCarousel from 'embla-carousel-react';
import { supabase } from '@/integrations/supabase/client';
import { useParentGroups, ParentGroupInfo } from '@/hooks/useParentGroups';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { 
  Utensils, ShoppingBag, Wrench, GraduationCap, Package,
  Star, Shield, MapPin, Users, ChevronRight, Sparkles,
  TrendingUp, BadgeCheck, Lock, Ticket,
  type LucideIcon,
} from 'lucide-react';

interface LandingSlideConfig {
  key: string;
  heading: string;
  subheading?: string;
  highlight?: string;
  bullets?: string[];
  cta?: { label: string; link: string };
}

const AUTOPLAY_INTERVAL = 8000;

function useAutoplay(emblaApi: any, interval: number) {
  useEffect(() => {
    if (!emblaApi) return;
    let id: ReturnType<typeof setInterval>;
    const start = () => { id = setInterval(() => emblaApi.scrollNext(), interval); };
    const stop = () => clearInterval(id);
    start();
    // Pause on user interaction, resume after
    emblaApi.on('pointerDown', stop);
    emblaApi.on('pointerUp', () => { stop(); start(); });
    return () => { stop(); emblaApi.off('pointerDown', stop); };
  }, [emblaApi, interval]);
}

const ICON_MAP: Record<string, LucideIcon> = {
  Utensils, ShoppingBag, Wrench, GraduationCap, Package, Ticket, Users, Star, Shield,
};

const GROUP_COLORS = [
  'bg-primary/10 text-primary',
  'bg-secondary/30 text-secondary-foreground',
  'bg-accent/20 text-accent-foreground',
  'bg-muted text-muted-foreground',
  'bg-primary/10 text-primary',
  'bg-warning/10 text-warning',
];

export default function LandingPage() {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [activeSlide, setActiveSlide] = useState(0);
  const [stats, setStats] = useState({ societies: 0, sellers: 0, categories: 0 });
  const { parentGroupInfos } = useParentGroups();
  const settings = useSystemSettings();
  const { platformName, landingSlidesJson } = settings;

  // Parse CMS slides config if available
  const cmsSlides = useMemo<LandingSlideConfig[] | null>(() => {
    if (!landingSlidesJson) return null;
    try {
      const parsed = JSON.parse(landingSlidesJson);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
    } catch { return null; }
  }, [landingSlidesJson]);

  const displayGroups = useMemo(() => {
    const active = parentGroupInfos.filter(g => g.label);
    return active.slice(0, 6).map((g, i) => ({
      icon: ICON_MAP[g.icon] || Package,
      title: g.label,
      desc: g.description || '',
      color: GROUP_COLORS[i % GROUP_COLORS.length],
    }));
  }, [parentGroupInfos]);

  useAutoplay(emblaApi, AUTOPLAY_INTERVAL);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setActiveSlide(emblaApi.selectedScrollSnap());
    emblaApi.on('select', onSelect);
    return () => { emblaApi.off('select', onSelect); };
  }, [emblaApi]);

  useEffect(() => {
    async function fetchStats() {
      const [{ count: sCount }, { count: selCount }, { count: catCount }] = await Promise.all([
        supabase.from('societies').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('seller_profiles').select('*', { count: 'exact', head: true }).eq('verification_status', 'approved'),
        supabase.from('parent_groups').select('*', { count: 'exact', head: true }).eq('is_active', true),
      ]);
      setStats({ societies: sCount || 0, sellers: selCount || 0, categories: catCount || 0 });
    }
    fetchStats();
  }, []);

  // CMS-driven slide renderer
  const renderCmsSlide = (slide: LandingSlideConfig, index: number) => (
    <div key={slide.key || index} className="min-h-[100dvh] flex flex-col justify-center items-center text-center px-6 bg-gradient-to-br from-primary/10 via-background to-accent/10">
      <div className="max-w-sm mx-auto">
        <h2 className="text-3xl font-bold mb-4">{slide.heading}</h2>
        {slide.highlight && <p className="text-primary text-xl font-semibold mb-2">{slide.highlight}</p>}
        {slide.subheading && <p className="text-muted-foreground text-base mb-6">{slide.subheading}</p>}
        {slide.bullets && slide.bullets.length > 0 && (
          <div className="space-y-3 mb-6 text-left">
            {slide.bullets.map((b, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <ChevronRight className="text-primary" size={14} />
                </div>
                <span className="text-sm">{b}</span>
              </div>
            ))}
          </div>
        )}
        {slide.cta && (
          <Link to={slide.cta.link || '/auth'}>
            <Button size="lg" className="w-full font-semibold">{slide.cta.label}</Button>
          </Link>
        )}
      </div>
    </div>
  );

  const defaultSlides = [
    // Slide 1: Hero
    <div key="hero" className="min-h-[100dvh] flex flex-col justify-center items-center text-center px-6 bg-gradient-to-br from-primary/10 via-background to-accent/10">
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/15 border border-primary/20 mb-6">
        <Sparkles className="text-primary" size={16} />
        <span className="text-sm font-semibold text-primary">Private & Verified</span>
      </div>
      <h1 className="text-4xl font-extrabold leading-tight mb-4">
        Your Society.<br />
        <span className="text-primary">Your Marketplace.</span>
      </h1>
      <p className="text-muted-foreground text-lg max-w-sm mb-8">
        Buy, sell, and connect with trusted neighbors in your residential community.
      </p>
      <div className="flex gap-3">
        <Link to="/auth">
          <Button size="lg" className="font-semibold px-8">
            Join Now <ChevronRight size={18} className="ml-1" />
          </Button>
        </Link>
        <Link to="/auth">
          <Button size="lg" variant="outline" className="font-semibold">Sign In</Button>
        </Link>
      </div>
    </div>,

    // Slide 2: Trust & Safety
    <div key="trust" className="min-h-[100dvh] flex flex-col justify-center px-6 bg-gradient-to-br from-secondary via-background to-secondary/30">
      <div className="max-w-sm mx-auto">
        <Shield className="text-primary mb-6" size={48} />
        <h2 className="text-3xl font-bold mb-4">Only Verified<br />Residents</h2>
        <p className="text-muted-foreground text-base mb-8">
          Every member is GPS-verified and community-authenticated. Your community, your safety.
        </p>
        <div className="space-y-4">
          {[
            { icon: MapPin, text: 'GPS location verification at signup' },
            { icon: Lock, text: 'Society invite code required' },
            { icon: BadgeCheck, text: 'Verified residential communities' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3 bg-card p-3 rounded-xl border border-border">
              <Icon className="text-primary shrink-0" size={20} />
              <span className="text-sm font-medium">{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>,

    // Slide 3: What You Can Do
    <div key="categories" className="min-h-[100dvh] flex flex-col justify-center px-6 bg-gradient-to-br from-accent/10 via-background to-primary/5">
      <div className="max-w-sm mx-auto">
        <h2 className="text-3xl font-bold mb-2">Everything You Need</h2>
        <p className="text-muted-foreground mb-6">From your neighbors, for your community.</p>
        <div className="grid grid-cols-2 gap-3">
          {displayGroups.map(({ icon: Icon, title, desc, color }) => (
            <div key={title} className="p-4 rounded-xl bg-card border border-border">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${color}`}>
                <Icon size={20} />
              </div>
              <h3 className="font-semibold text-sm">{title}</h3>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>,

    // Slide 4: For Sellers
    <div key="sellers" className="min-h-[100dvh] flex flex-col justify-center px-6 bg-gradient-to-br from-primary/5 via-background to-accent/10">
      <div className="max-w-sm mx-auto">
        <TrendingUp className="text-primary mb-6" size={48} />
        <h2 className="text-3xl font-bold mb-4">Turn Your Passion<br />Into <span className="text-primary">Income</span></h2>
        <p className="text-muted-foreground text-base mb-8">
          Set up your store in minutes. Reach hundreds of neighbors instantly.
        </p>
        <div className="space-y-3">
          {['Zero listing fee to start', 'Built-in coupon & promotion tools', 'Real-time order dashboard', 'UPI & COD payments supported'].map((text) => (
            <div key={text} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <ChevronRight className="text-primary" size={14} />
              </div>
              <span className="text-sm">{text}</span>
            </div>
          ))}
        </div>
        <Link to="/auth" className="block mt-8">
          <Button size="lg" className="w-full font-semibold">Start Selling Today</Button>
        </Link>
      </div>
    </div>,

    // Slide 5: Social Proof + CTA
    <div key="social" className="min-h-[100dvh] flex flex-col justify-center px-6 bg-gradient-to-br from-secondary/20 via-background to-primary/10">
      <div className="max-w-sm mx-auto text-center">
        <div className="bg-card rounded-2xl p-6 border border-border shadow-sm mb-8">
          <div className="flex justify-center gap-1 mb-3">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="fill-warning text-warning" size={18} />
            ))}
          </div>
          <p className="text-sm italic text-foreground/80 mb-3">
            "A marketplace built exclusively for our community — trusted neighbors, verified sellers, all in one place."
          </p>
          <p className="text-xs font-medium text-muted-foreground">— The {platformName} Team</p>
        </div>

        <div className="flex justify-around mb-8 bg-card rounded-xl p-4 border border-border">
          <div>
            <p className="text-2xl font-bold text-primary">{stats.societies > 0 ? `${stats.societies}+` : '—'}</p>
            <p className="text-xs text-muted-foreground">Societies</p>
          </div>
          <div className="w-px bg-border" />
          <div>
            <p className="text-2xl font-bold text-primary">{stats.sellers > 0 ? `${stats.sellers}+` : '—'}</p>
            <p className="text-xs text-muted-foreground">Sellers</p>
          </div>
          <div className="w-px bg-border" />
          <div>
            <p className="text-2xl font-bold text-primary">{stats.categories > 0 ? `${stats.categories}+` : '—'}</p>
            <p className="text-xs text-muted-foreground">Categories</p>
          </div>
        </div>

        <Link to="/auth" className="block">
          <Button className="w-full h-14 text-base font-semibold" size="lg">
            Get Started <ChevronRight className="ml-2" size={20} />
          </Button>
        </Link>
        <p className="text-xs text-muted-foreground mt-4">
          <Link to="/auth" className="text-primary hover:underline">Already have an account? Sign in</Link>
        </p>
      </div>
    </div>,
  ];

  const slides = cmsSlides ? cmsSlides.map(renderCmsSlide) : defaultSlides;

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Carousel */}
      <div className="relative overflow-hidden" ref={emblaRef}>
        <div className="flex transition-transform duration-500 ease-out">
          {slides.map((slide, i) => (
            <div key={i} className="min-w-0 shrink-0 grow-0 basis-full">
              <div className={`transition-opacity duration-500 ${activeSlide === i ? 'opacity-100' : 'opacity-70'}`}>
                {slide}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dot Indicators */}
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 flex gap-2 bg-card/80 backdrop-blur-sm px-4 py-2.5 rounded-full border border-border shadow-lg safe-bottom">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => emblaApi?.scrollTo(i)}
            className={`h-2.5 rounded-full transition-all duration-300 ${
              activeSlide === i ? 'bg-primary w-6' : 'bg-muted-foreground/30 w-2.5'
            }`}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="fixed top-4 right-4 z-50">
        <Link to="/auth">
          <Button size="sm" variant="secondary" className="font-medium shadow-lg">
            Sign In
          </Button>
        </Link>
      </div>

      {/* Legal Footer */}
      <div className="fixed bottom-4 left-0 right-0 z-40 flex justify-center gap-4 text-xs text-muted-foreground safe-bottom">
        <Link to="/privacy-policy" className="hover:text-foreground">Privacy</Link>
        <span>•</span>
        <Link to="/terms" className="hover:text-foreground">Terms</Link>
        <span>•</span>
        <Link to="/pricing" className="hover:text-foreground">Pricing</Link>
      </div>
    </div>
  );
}
