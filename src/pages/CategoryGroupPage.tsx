import { useState, useMemo } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProductGridCard, ProductWithSeller } from '@/components/product/ProductGridCard';
// ProductDetailSheet removed — cards navigate directly to seller page
import { SellerCard } from '@/components/seller/SellerCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCategoryConfigs } from '@/hooks/useCategoryBehavior';
import { useParentGroups } from '@/hooks/useParentGroups';
import { useCategoryProducts } from '@/hooks/queries/usePopularProducts';
import { ServiceCategory } from '@/types/categories';
import { SORT_OPTIONS, SortKey } from '@/lib/marketplace-constants';
import { ArrowLeft, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

export default function CategoryGroupPage() {
  const { category } = useParams<{ category: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const subCategory = searchParams.get('sub') as ServiceCategory | null;

  const { effectiveSocietyId } = useAuth();
  const { groupedConfigs, configs, isLoading: configsLoading } = useCategoryConfigs();
  const { getGroupBySlug, isLoading: groupsLoading } = useParentGroups();
  const [activeSubCategory, setActiveSubCategory] = useState<ServiceCategory | null>(subCategory);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('relevance');
  // No popup — product cards navigate to seller store directly

  const parentGroup = category ? getGroupBySlug(category) : undefined;
  const subCategories = category ? groupedConfigs[category] || [] : [];

  const { data: allProducts = [], isLoading: productsLoading } = useCategoryProducts(
    category || null,
    effectiveSocietyId
  );

  const { data: topSellers = [] } = useQuery({
    queryKey: ['category-sellers', category, effectiveSocietyId],
    queryFn: async () => {
      let query = supabase
        .from('seller_profiles')
        .select(`*, profile:profiles!seller_profiles_user_id_fkey(name, block)`)
        .eq('verification_status', 'approved')
        .eq('primary_group', category!)
        .order('rating', { ascending: false })
        .limit(10);

      if (effectiveSocietyId) {
        query = query.eq('society_id', effectiveSocietyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as any) || [];
    },
    enabled: !!category,
  });

  const getBehavior = (cat: string) => {
    const config = configs.find((c) => c.category === cat);
    return config?.behavior || null;
  };

  const displayProducts = useMemo(() => {
    let filtered = activeSubCategory
      ? allProducts.filter((p) => p.category === activeSubCategory)
      : allProducts;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
      );
    }

    const sorted = [...filtered];
    switch (sortBy) {
      case 'price_low': sorted.sort((a, b) => a.price - b.price); break;
      case 'price_high': sorted.sort((a, b) => b.price - a.price); break;
      case 'popular': sorted.sort((a, b) => (b.is_bestseller ? 1 : 0) - (a.is_bestseller ? 1 : 0)); break;
    }
    return sorted;
  }, [allProducts, activeSubCategory, searchQuery, sortBy]);

  const handleSubCategorySelect = (cat: ServiceCategory | null) => {
    setActiveSubCategory(cat);
    if (cat) {
      setSearchParams({ sub: cat });
    } else {
      setSearchParams({});
    }
  };

  // No-op: cards navigate to seller page directly via ProductGridCard default behavior

  const isLoading = groupsLoading || configsLoading;

  if (isLoading) {
    return (
      <AppLayout showHeader={false}>
        <div className="p-4">
          <Skeleton className="h-12 w-full rounded-xl mb-4" />
          <div className="flex gap-2 mb-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-8 w-20 rounded-full" />
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-56 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!parentGroup) {
    return (
      <AppLayout showHeader={false}>
        <div className="p-4 text-center">
          <p>Category not found</p>
          <Link to="/">
            <Button className="mt-4">Go Home</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout showHeader={false}>
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-background border-b border-border/40">
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center gap-3 mb-3">
            <Link to="/" className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-bold flex items-center gap-2 flex-1">
              <span>{parentGroup.icon}</span>
              {parentGroup.label}
            </h1>
          </div>

          {/* Search */}
          <div className="relative mb-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={`Search in ${parentGroup.label}…`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 h-9 bg-muted border-0 rounded-lg text-sm"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Sub-category tabs */}
          {subCategories.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4">
              <button
                onClick={() => handleSubCategorySelect(null)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                  !activeSubCategory ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                )}
              >
                All
              </button>
              {subCategories.map((config) => (
                <button
                  key={config.category}
                  onClick={() => handleSubCategorySelect(config.category)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1',
                    activeSubCategory === config.category ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                  )}
                >
                  <span className="text-xs">{config.icon}</span>
                  {config.displayName}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sort bar */}
        <div className="flex gap-2 px-4 pb-2 overflow-x-auto scrollbar-hide">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key)}
              className={cn(
                'px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors',
                sortBy === opt.key ? 'bg-foreground text-background' : 'bg-muted/60 text-muted-foreground'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      <div className="p-4 pb-6">
        {productsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-56 w-full rounded-xl" />
            ))}
          </div>
        ) : displayProducts.length > 0 ? (
          <>
            <p className="text-xs text-muted-foreground mb-3">
              {displayProducts.length} item{displayProducts.length !== 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {displayProducts.map((product) => (
                <ProductGridCard
                  key={product.id}
                  product={product}
                  behavior={getBehavior(product.category)}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">{parentGroup.icon}</div>
            <h3 className="font-semibold mb-2">No items found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery ? 'Try a different search' : 'Check back soon for new listings!'}
            </p>
            {!searchQuery && (
              <Link to="/become-seller">
                <Button variant="outline" size="sm">Become a Seller</Button>
              </Link>
            )}
          </div>
        )}

        {/* Top Sellers section */}
        {topSellers.length > 0 && !searchQuery && (
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">⭐</span>
              <h3 className="font-semibold text-sm">
                Top Sellers in {parentGroup.label}
              </h3>
            </div>
            <div className="space-y-3">
              {topSellers.slice(0, 5).map((seller: any) => (
                <SellerCard key={seller.id} seller={seller} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Popup removed — cards navigate directly to seller store */}
    </AppLayout>
  );
}
