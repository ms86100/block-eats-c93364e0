import { useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useCategoryConfigs } from '@/hooks/useCategoryBehavior';
import { useParentGroups } from '@/hooks/useParentGroups';
import { useProductsByCategory } from '@/hooks/queries/useProductsByCategory';
import { useNearbySocietySellers } from '@/hooks/queries/useStoreDiscovery';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { Store, Sparkles, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSearchPlaceholder } from '@/hooks/useSearchPlaceholder';

export default function CategoriesPage() {
  const { profile, isLoading: authLoading, effectiveSocietyId } = useAuth();
  const { configs, isLoading: configsLoading } = useCategoryConfigs();
  const { groups, isLoading: groupsLoading } = useParentGroups();
  const { data: productCategories = [], isLoading: productsLoading } = useProductsByCategory();

  const browseBeyond = profile?.browse_beyond_community ?? true;
  const searchRadius = profile?.search_radius_km ?? 10;
  const { data: nearbyBands = [], isLoading: nearbyLoading } = useNearbySocietySellers(searchRadius, browseBeyond);

  const searchQuery = '';
  const [activeGroup, setActiveGroup] = useState<string>('all');
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Build product count map
  const productCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const pc of productCategories) {
      map[pc.category] = (pc.products?.length ?? 0);
    }
    return map;
  }, [productCategories]);

  // Compute active categories inline — useMemo was producing stale results
  const activeCategorySet = (() => {
    const s = new Set(productCategories.map(c => c.category));
    if (browseBeyond && nearbyBands.length > 0) {
      for (const band of nearbyBands) {
        for (const society of band.societies) {
          for (const group of Object.keys(society.sellersByGroup)) {
            for (const seller of society.sellersByGroup[group]) {
              if (seller.categories) {
                seller.categories.forEach((cat: string) => s.add(cat));
              }
            }
          }
        }
      }
    }
    return s;
  })();

  const isLoading = authLoading || !effectiveSocietyId || configsLoading || groupsLoading || productsLoading || (browseBeyond && nearbyLoading);

  // Compute grouped inline — useMemo was producing stale results
  const grouped = (() => {
    const q = searchQuery.toLowerCase().trim();
    return groups
      .filter(g => g.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(group => ({
        ...group,
        categories: configs
          .filter(c =>
            c.parentGroup === group.slug &&
            c.isActive &&
            activeCategorySet.has(c.category) &&
            (!q || c.displayName.toLowerCase().includes(q))
          )
          .sort((a, b) => (a.displayOrder ?? 99) - (b.displayOrder ?? 99)),
      }))
      .filter(g => g.categories.length > 0);
  })();

  const filteredGroups = activeGroup === 'all'
    ? grouped
    : grouped.filter(g => g.slug === activeGroup);

  const isEmpty = !isLoading && grouped.length === 0;
  

  const handlePillClick = (slug: string) => {
    setActiveGroup(slug);
    if (slug !== 'all' && sectionRefs.current[slug]) {
      sectionRefs.current[slug]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const activeParentGroups = useMemo(() => {
    const slugs = new Set(grouped.map(g => g.slug));
    return groups.filter(g => g.is_active && slugs.has(g.slug)).sort((a, b) => a.sort_order - b.sort_order);
  }, [groups, grouped]);

  const searchPlaceholder = useSearchPlaceholder();

  return (
    <AppLayout showHeader={false}>
      {/* Custom header: app top bar content + title + search */}
      <div className="sticky top-0 z-40 safe-top bg-background">
        {/* Title + subtitle + accent line */}
        <div className="px-4 pt-3 pb-1">
          <h1 className="text-lg font-bold text-foreground">Explore Categories</h1>
          <p className="text-xs text-muted-foreground mb-1">Find what you love</p>
          <div className="h-[2px] rounded-full bg-gradient-to-r from-primary via-primary/50 to-transparent" />
        </div>

        {/* Search bar — same as Header */}
        <div className="px-3 pb-2">
          <Link to="/search" className="block">
            <div className="flex items-center gap-2.5 bg-secondary rounded-2xl px-4 py-3">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground shrink-0">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.3-4.3"/>
              </svg>
              <span className="text-sm text-muted-foreground flex-1 transition-opacity duration-300">{searchPlaceholder}</span>
            </div>
          </Link>
        </div>
      </div>

      {/* Parent Group Pills */}
      {!isLoading && activeParentGroups.length > 0 && (
        <div className="flex gap-1.5 px-4 pb-2 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => handlePillClick('all')}
            className={cn(
              'px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all border',
              activeGroup === 'all'
                ? 'bg-primary text-primary-foreground border-primary scale-105'
                : 'bg-card text-muted-foreground border-border active:scale-[0.97]'
            )}
          >
            All
          </button>
          {activeParentGroups.map(g => (
            <button
              key={g.slug}
              onClick={() => handlePillClick(g.slug)}
              className={cn(
                'px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all border',
                activeGroup === g.slug
                  ? 'bg-primary text-primary-foreground border-primary scale-105'
                  : 'bg-card text-muted-foreground border-border active:scale-[0.97]'
              )}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="px-3 pb-20">
        {isLoading ? (
          <div className="space-y-5">
            {[1, 2].map(i => (
              <div key={i}>
                <Skeleton className="h-4 w-28 mb-2 rounded-full" />
                <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                  {[1, 2, 3, 4, 5, 6].map(j => (
                    <Skeleton key={j} className="aspect-[4/5] rounded-2xl" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : isEmpty ? (
          /* Keep existing empty state */
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="relative mb-6"
            >
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
                <Store size={40} className="text-primary" />
              </div>
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ repeat: 0, duration: 2, ease: 'easeInOut' }}
                className="absolute -top-2 -right-2"
              >
                <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center">
                  <Sparkles size={16} className="text-warning" />
                </div>
              </motion.div>
            </motion.div>
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="space-y-3"
            >
              <h2 className="text-lg font-bold text-foreground">Stay tuned — we're growing!</h2>
              <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                New sellers are joining your community. Products will be available here very soon.
              </p>
            </motion.div>
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.4 }}
              className="mt-6 flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded-full px-4 py-2"
            >
              <Clock size={14} />
              <span>Check back soon for new listings</span>
            </motion.div>
          </div>
        ) : (
          <div className="space-y-5">
            {filteredGroups.map((group, groupIdx) => (
              <motion.div
                key={group.slug}
                ref={el => { sectionRefs.current[group.slug] = el; }}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: groupIdx * 0.08, duration: 0.35 }}
              >
                {/* Section Header */}
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
                    {group.icon || '📦'} {group.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">({group.categories.length})</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Category Cards Grid */}
                <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                  {group.categories.map((cat, catIdx) => {
                    const count = productCountMap[cat.category] || 0;
                    return (
                      <motion.div
                        key={cat.category}
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: groupIdx * 0.08 + catIdx * 0.04, duration: 0.3 }}
                      >
                        <Link
                          to={`/category/${cat.parentGroup}?sub=${cat.category}`}
                          className="block relative aspect-[4/5] rounded-2xl overflow-hidden active:scale-[0.97] transition-transform group"
                        >
                          {/* Image or emoji fallback */}
                          {cat.imageUrl ? (
                            <img
                              src={cat.imageUrl}
                              alt={cat.displayName}
                              className="absolute inset-0 w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="absolute inset-0 bg-muted flex items-center justify-center">
                              <span className="text-3xl">{cat.icon}</span>
                            </div>
                          )}

                          {/* Gradient overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                          {/* Icon badge top-left */}
                          <div className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-xs shadow-sm">
                            {cat.icon}
                          </div>

                          {/* Product count badge top-right */}
                          {count > 0 && (
                            <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-primary/90 text-primary-foreground text-[8px] font-bold shadow-sm">
                              {count}
                            </div>
                          )}

                          {/* Category name */}
                          <div className="absolute bottom-0 left-0 right-0 p-2">
                            <span className="text-[10px] font-bold text-white leading-tight line-clamp-2 drop-shadow-md">
                              {cat.displayName}
                            </span>
                          </div>
                        </Link>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
