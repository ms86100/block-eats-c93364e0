import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useProductsByCategory } from '@/hooks/queries/useProductsByCategory';
import { useParentGroups } from '@/hooks/useParentGroups';
import { ParentGroupTabs } from '@/components/home/ParentGroupTabs';
import { CategoryImageGrid } from '@/components/home/CategoryImageGrid';
import { FeaturedBanners } from '@/components/home/FeaturedBanners';
import { ShopByStoreDiscovery } from '@/components/home/ShopByStoreDiscovery';
import { ProductListingCard, ProductWithSeller } from '@/components/product/ProductListingCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Store, ChevronRight, ShoppingBag, Sparkles, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { escapeIlike } from '@/lib/query-utils';

export function MarketplaceSection() {
  const navigate = useNavigate();
  const { user, profile, effectiveSocietyId } = useAuth();

  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  const { data: localCategories = [], isLoading: loadingLocal } = useProductsByCategory(80);
  const { parentGroupInfos } = useParentGroups();

  const filteredCategories = activeGroup
    ? localCategories.filter(cat => cat.parentGroup === activeGroup)
    : localCategories;

  const activeCategorySet = new Set(localCategories.map(c => c.category));
  const activeParentGroupSet = new Set(localCategories.map(c => c.parentGroup));

  const activeParentGroups = activeGroup
    ? parentGroupInfos.filter(g => g.value === activeGroup && activeParentGroupSet.has(g.value))
    : parentGroupInfos.filter(g => activeParentGroupSet.has(g.value));

  return (
    <div className="pb-2">
      {/* ━━━ Parent Group Pill Tabs ━━━ */}
      <div className="pt-2 pb-3">
        <ParentGroupTabs activeGroup={activeGroup} onGroupChange={setActiveGroup} activeParentGroups={activeParentGroupSet} />
      </div>

      {/* ━━━ Category Image Sections ━━━ */}
      {activeParentGroups.slice(0, 4).map((group) => (
        <CategoryImageGrid
          key={group.value}
          parentGroup={group.value}
          title={group.label}
          activeCategories={activeCategorySet}
        />
      ))}

      {/* ━━━ Featured Banners ━━━ */}
      <FeaturedBanners />

      {/* ━━━ Product Listings ━━━ */}
      <ProductListings
        categories={filteredCategories}
        isLoading={loadingLocal}
      />

      {/* ━━━ Shop by Store Discovery ━━━ */}
      <ShopByStoreDiscovery />
    </div>
  );
}

// ── Product Listings by Category ──
function ProductListings({
  categories, isLoading,
}: {
  categories: { category: string; parentGroup: string; displayName: string; icon: string; products: ProductWithSeller[] }[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="px-4 space-y-4 mt-4">
        {[1, 2].map(i => (
          <div key={i}>
            <Skeleton className="h-5 w-40 mb-3" />
            <div className="flex gap-2.5">
              {[1, 2, 3].map(j => <Skeleton key={j} className="w-[140px] h-52 rounded-xl shrink-0" />)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="relative mb-6"
        >
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
            <ShoppingBag size={40} className="text-primary" />
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
          <h2 className="text-lg font-bold text-foreground">Your marketplace is getting ready!</h2>
          <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
            Sellers from your community are setting up shop. Fresh products, homemade food & services — all coming your way.
          </p>
        </motion.div>

        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="mt-6 flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded-full px-4 py-2"
        >
          <Clock size={14} />
          <span>New listings appear here automatically</span>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-5 mt-4">
      {categories.map(cat => (
        <div key={cat.category}>
          <div className="flex items-center justify-between px-4 mb-2">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
              <span className="text-base">{cat.icon}</span>
              {cat.displayName}
            </h3>
            <a
              href={`#/category/${cat.parentGroup}?sub=${cat.category}`}
              className="text-[11px] font-semibold text-primary flex items-center gap-0.5"
            >
              see all <ChevronRight size={11} />
            </a>
          </div>
          <div className="relative">
            <div className="flex gap-2.5 overflow-x-auto scrollbar-hide px-4 pb-1">
              {cat.products.slice(0, 8).map(product => (
                <div key={product.id} className="w-[140px] shrink-0">
                  <ProductListingCard product={product} />
                </div>
              ))}
            </div>
            <div className="absolute right-0 top-0 bottom-1 w-8 pointer-events-none bg-gradient-to-l from-background to-transparent" />
          </div>
        </div>
      ))}
    </div>
  );
}
