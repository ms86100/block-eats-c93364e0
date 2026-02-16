import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useProductsByCategory } from '@/hooks/queries/useProductsByCategory';
import { useParentGroups } from '@/hooks/useParentGroups';
import { ParentGroupTabs } from '@/components/home/ParentGroupTabs';
import { CategoryImageGrid } from '@/components/home/CategoryImageGrid';
import { FeaturedBanners } from '@/components/home/FeaturedBanners';
import { ShopByStore } from '@/components/home/ShopByStore';
import { ProductListingCard, ProductWithSeller } from '@/components/product/ProductListingCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Store, ChevronRight } from 'lucide-react';
import { escapeIlike } from '@/lib/query-utils';

export function MarketplaceSection() {
  const navigate = useNavigate();
  const { user, profile, effectiveSocietyId } = useAuth();

  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  const { data: localCategories = [], isLoading: loadingLocal } = useProductsByCategory(200);
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

      {/* ━━━ Shop by Store ━━━ */}
      <ShopByStore />
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
      <div className="text-center py-12 px-4">
        <Store className="mx-auto text-muted-foreground/40 mb-3" size={32} />
        <p className="text-sm text-muted-foreground">No products available yet</p>
        <p className="text-xs text-muted-foreground mt-1">Check back soon or become a seller!</p>
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
