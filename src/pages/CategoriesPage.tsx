import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useCategoryConfigs } from '@/hooks/useCategoryBehavior';
import { useParentGroups } from '@/hooks/useParentGroups';
import { useProductsByCategory } from '@/hooks/queries/useProductsByCategory';
import { useNearbySocietySellers } from '@/hooks/queries/useStoreDiscovery';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Store, Sparkles, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHaptics } from '@/hooks/useHaptics';

export default function CategoriesPage() {
  const { user } = useAuth();
  const { configs, isLoading: configsLoading } = useCategoryConfigs();
  const { groups, isLoading: groupsLoading } = useParentGroups();
  const { data: productCategories = [], isLoading: productsLoading } = useProductsByCategory();
  const { selectionChanged } = useHaptics();

  const { data: prefs } = useQuery({
    queryKey: ['user-browse-prefs', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('browse_beyond_community, search_radius_km')
        .eq('id', user!.id)
        .single();
      return data as any;
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const browseBeyond = prefs?.browse_beyond_community ?? false;
  const { data: nearbyBands = [] } = useNearbySocietySellers();

  const activeCategorySet = useMemo(() => {
    const set = new Set(productCategories.map(c => c.category));
    if (browseBeyond && nearbyBands.length > 0) {
      for (const band of nearbyBands) {
        for (const society of band.societies) {
          for (const group of Object.keys(society.sellersByGroup)) {
            for (const seller of society.sellersByGroup[group]) {
              if (seller.categories) {
                seller.categories.forEach((cat: string) => set.add(cat));
              }
            }
          }
        }
      }
    }
    return set;
  }, [productCategories, browseBeyond, nearbyBands]);

  const isLoading = configsLoading || groupsLoading || productsLoading;

  // Build grouped data: parent groups that have at least one active sub-category
  const grouped = useMemo(() => {
    return groups
      .filter(g => g.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(group => ({
        ...group,
        categories: configs
          .filter(c => c.parentGroup === group.slug && c.isActive && activeCategorySet.has(c.category))
          .sort((a, b) => (a.displayOrder ?? 99) - (b.displayOrder ?? 99)),
      }))
      .filter(g => g.categories.length > 0);
  }, [groups, configs, activeCategorySet]);

  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  // Resolve active group: use state or default to first
  const resolvedActiveGroup = activeGroup && grouped.some(g => g.slug === activeGroup)
    ? activeGroup
    : grouped[0]?.slug ?? null;

  const activeCategories = grouped.find(g => g.slug === resolvedActiveGroup)?.categories ?? [];
  const isEmpty = !isLoading && grouped.length === 0;

  return (
    <AppLayout>
      <div className="px-4 py-2">
        <h2 className="text-sm font-bold text-foreground">All Categories</h2>
      </div>

      {isLoading ? (
        <div className="flex px-3 py-3 gap-3 pb-20">
          <div className="w-[72px] shrink-0 space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex flex-col items-center gap-1">
                <Skeleton className="w-11 h-11 rounded-full" />
                <Skeleton className="h-3 w-10" />
              </div>
            ))}
          </div>
          <div className="flex-1 grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map(j => (
              <div key={j} className="flex flex-col items-center gap-1">
                <Skeleton className="w-full aspect-square rounded-2xl" />
                <Skeleton className="h-3 w-14" />
              </div>
            ))}
          </div>
        </div>
      ) : isEmpty ? (
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
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
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
        <div className="flex pb-20" style={{ height: 'calc(100vh - 140px)' }}>
          {/* Left Sidebar */}
          <div className="w-[72px] shrink-0 border-r border-border overflow-y-auto bg-muted/30">
            <div className="flex flex-col py-2">
              {grouped.map(group => {
                const isActive = group.slug === resolvedActiveGroup;
                return (
                  <button
                    key={group.slug}
                    onClick={() => {
                      setActiveGroup(group.slug);
                      selectionChanged();
                    }}
                    className={cn(
                      'flex flex-col items-center py-3 px-1 relative transition-colors active:scale-[0.97]',
                      isActive
                        ? 'bg-primary/10'
                        : 'hover:bg-muted/50'
                    )}
                  >
                    {/* Active indicator bar */}
                    {isActive && (
                      <div className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-primary" />
                    )}
                    <div
                      className={cn(
                        'w-11 h-11 rounded-full flex items-center justify-center text-lg',
                        isActive
                          ? 'bg-primary/20'
                          : 'bg-muted'
                      )}
                    >
                      {group.icon}
                    </div>
                    <span
                      className={cn(
                        'text-[9px] mt-1 text-center leading-tight line-clamp-2 font-medium',
                        isActive ? 'text-primary' : 'text-muted-foreground'
                      )}
                    >
                      {group.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Panel */}
          <div className="flex-1 overflow-y-auto px-3 py-3">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 px-1">
              {grouped.find(g => g.slug === resolvedActiveGroup)?.name}
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {activeCategories.map(cat => (
                <Link
                  key={cat.category}
                  to={`/category/${cat.parentGroup}?sub=${cat.category}`}
                  onClick={() => selectionChanged()}
                  className="group flex flex-col items-center active:scale-[0.97] transition-transform"
                >
                  <div
                    className={cn(
                      'w-full aspect-square rounded-2xl overflow-hidden',
                      'bg-muted border border-border/30',
                      'transition-all duration-200 group-hover:scale-[1.03]',
                      'flex items-center justify-center'
                    )}
                  >
                    {cat.imageUrl ? (
                      <img
                        src={cat.imageUrl}
                        alt={cat.displayName}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-3xl">{cat.icon}</span>
                    )}
                  </div>
                  <span className="text-[10px] font-medium text-center leading-tight text-foreground line-clamp-2 mt-1.5 px-0.5">
                    {cat.displayName}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
