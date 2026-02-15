import { useState, useCallback, useRef, useEffect } from 'react';
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
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Store, X } from 'lucide-react';
import { escapeIlike } from '@/lib/query-utils';

export function MarketplaceSection() {
  const navigate = useNavigate();
  const { user, profile, effectiveSocietyId } = useAuth();

  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProductWithSeller[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const { data: localCategories = [], isLoading: loadingLocal } = useProductsByCategory(200);
  const { parentGroupInfos } = useParentGroups();

  // Filter categories by active parent group
  const filteredCategories = activeGroup
    ? localCategories.filter(cat => cat.parentGroup === activeGroup)
    : localCategories;

  // Get parent groups that have products for category image sections
  const activeParentGroups = activeGroup
    ? parentGroupInfos.filter(g => g.value === activeGroup)
    : parentGroupInfos.filter(g =>
        localCategories.some(cat => cat.parentGroup === g.value)
      );

  // Debounced keyword search
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) { setSearchResults(null); return; }
    if (q.length < 2) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const escaped = escapeIlike(q);
        let query = supabase
          .from('products')
          .select(`*, seller:seller_profiles!products_seller_id_fkey(
            id, business_name, rating, society_id, verification_status, fulfillment_mode, delivery_note
          )`)
          .eq('is_available', true)
          .eq('approval_status', 'approved')
          .ilike('name', `%${escaped}%`)
          .order('is_bestseller', { ascending: false })
          .limit(30);

        if (effectiveSocietyId) {
          query = query.eq('seller.society_id', effectiveSocietyId);
        }

        const { data, error } = await query;
        if (controller.signal.aborted) return;
        if (error) throw error;

        const results = (data || [])
          .filter((p: any) => p.seller?.verification_status === 'approved')
          .map((p: any) => ({
            ...p,
            seller_name: p.seller?.business_name || 'Seller',
            seller_rating: p.seller?.rating || 0,
            seller_id: p.seller_id,
            fulfillment_mode: p.seller?.fulfillment_mode || null,
            delivery_note: p.seller?.delivery_note || null,
          }));

        setSearchResults(results);
      } catch (err) {
        if (!controller.signal.aborted) console.error('Search error:', err);
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, 300);

    return () => { clearTimeout(timer); controller.abort(); };
  }, [searchQuery, effectiveSocietyId]);

  return (
    <div className="mt-2 space-y-5">
      {/* ━━━ Search Bar ━━━ */}
      <div className="px-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input
            placeholder="Search products, services…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-9 bg-muted border-0 h-12 rounded-xl text-sm font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* ━━━ Search Results ━━━ */}
      {searchResults !== null ? (
        <SearchResultsView
          results={searchResults}
          loading={searchLoading}
          query={searchQuery}
        />
      ) : (
        <>
          {/* ━━━ Parent Group Tabs ━━━ */}
          <ParentGroupTabs activeGroup={activeGroup} onGroupChange={setActiveGroup} />

          {/* ━━━ Category Image Sections (Blinkit style) ━━━ */}
          {activeParentGroups.slice(0, 4).map(group => (
            <CategoryImageGrid
              key={group.value}
              parentGroup={group.value}
              title={group.label}
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
        </>
      )}
    </div>
  );
}

// ── Search Results View ──
function SearchResultsView({
  results,
  loading,
  query,
}: {
  results: ProductWithSeller[];
  loading: boolean;
  query: string;
}) {
  return (
    <div className="px-4 pb-4">
      <h3 className="font-semibold text-sm mb-3 text-foreground">
        {loading ? 'Searching…' : `${results.length} results for "${query}"`}
      </h3>
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-52 rounded-xl" />)}
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-12">
          <Search className="mx-auto text-muted-foreground/40 mb-3" size={32} />
          <p className="text-sm text-muted-foreground">No products found</p>
          <p className="text-xs text-muted-foreground mt-1">Try a different keyword</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {results.map(product => (
            <ProductListingCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Product Listings by Category ──
function ProductListings({
  categories,
  isLoading,
}: {
  categories: { category: string; parentGroup: string; displayName: string; icon: string; products: ProductWithSeller[] }[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="px-4 space-y-4">
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
    <div className="space-y-5">
      {categories.map(cat => (
        <div key={cat.category}>
          <div className="flex items-center justify-between px-4 mb-2">
            <h3 className="font-bold text-sm text-foreground">
              {cat.icon} {cat.displayName}
            </h3>
            <a
              href={`#/category/${cat.parentGroup}?sub=${cat.category}`}
              className="text-xs font-semibold text-success hover:underline"
            >
              see all
            </a>
          </div>
          <div className="flex gap-2.5 overflow-x-auto scrollbar-hide px-4 pb-1">
            {cat.products.slice(0, 8).map(product => (
              <div key={product.id} className="w-[140px] shrink-0">
                <ProductListingCard product={product} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
