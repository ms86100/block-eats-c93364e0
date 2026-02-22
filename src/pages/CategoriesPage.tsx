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

export default function CategoriesPage() {
  const { user } = useAuth();
  const { configs, isLoading: configsLoading } = useCategoryConfigs();
  const { groups, isLoading: groupsLoading } = useParentGroups();
  const { data: productCategories = [], isLoading: productsLoading } = useProductsByCategory();

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

  const browseBeyond = prefs?.browse_beyond_community ?? true;
  const { data: nearbyBands = [] } = useNearbySocietySellers();

  const activeCategorySet = new Set(productCategories.map(c => c.category));

  if (browseBeyond && nearbyBands.length > 0) {
    for (const band of nearbyBands) {
      for (const society of band.societies) {
        for (const group of Object.keys(society.sellersByGroup)) {
          for (const seller of society.sellersByGroup[group]) {
            if (seller.categories) {
              seller.categories.forEach(cat => activeCategorySet.add(cat));
            }
          }
        }
      }
    }
  }

  const isLoading = configsLoading || groupsLoading || productsLoading;

  const grouped = groups
    .filter(g => g.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(group => ({
      ...group,
      categories: configs
        .filter(c => c.parentGroup === group.slug && c.isActive && activeCategorySet.has(c.category))
        .sort((a, b) => (a.displayOrder ?? 99) - (b.displayOrder ?? 99)),
    }))
    .filter(g => g.categories.length > 0);

  const isEmpty = !isLoading && grouped.length === 0;

  return (
    <AppLayout>
      <div className="px-4 py-2">
        <h2 className="text-sm font-bold text-foreground">All Categories</h2>
      </div>

      <div className="px-3 py-3 pb-20">
        {isLoading ? (
          <div className="space-y-6">
            {[1, 2, 3].map(i => (
              <div key={i}>
                <Skeleton className="h-4 w-32 mb-2" />
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map(j => (
                    <Skeleton key={j} className="aspect-square rounded-xl" />
                  ))}
                </div>
              </div>
            ))}
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
          <div className="space-y-5">
            {grouped.map(group => (
              <div key={group.slug}>
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                  {group.name}
                </h2>
                <div className="grid grid-cols-4 gap-2">
                  {group.categories.map(cat => (
                    <Link
                      key={cat.category}
                      to={`/category/${cat.parentGroup}?sub=${cat.category}`}
                      className="flex flex-col items-center"
                    >
                      <div className="w-full aspect-square rounded-xl bg-card border border-border flex items-center justify-center mb-1 overflow-hidden">
                        {cat.imageUrl ? (
                          <img src={cat.imageUrl} alt={cat.displayName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl">{cat.icon}</span>
                        )}
                      </div>
                      <span className="text-[10px] font-medium text-foreground text-center leading-tight line-clamp-2">
                        {cat.displayName}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
