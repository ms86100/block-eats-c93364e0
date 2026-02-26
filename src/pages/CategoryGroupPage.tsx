import { useState, useMemo, useCallback } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProductListingCard, ProductWithSeller } from '@/components/product/ProductListingCard';
import { ProductDetailSheet } from '@/components/product/ProductDetailSheet';
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
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useNearbyProducts } from '@/hooks/queries/useNearbyProducts';

export default function CategoryGroupPage() {
  const { category } = useParams<{ category: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const subCategory = searchParams.get('sub') as ServiceCategory | null;

  const { effectiveSocietyId } = useAuth();
  const { groupedConfigs, configs, isLoading: configsLoading } = useCategoryConfigs();
  const { getGroupBySlug, isLoading: groupsLoading } = useParentGroups();
  const [activeSubCategory, setActiveSubCategory] = useState<ServiceCategory | null>(subCategory);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('relevance');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { configs: categoryConfigs } = useCategoryConfigs();

  const handleProductTap = useCallback((product: ProductWithSeller) => {
    const catConfig = categoryConfigs.find(c => c.category === product.category);
    setSelectedProduct({
      product_id: product.id,
      product_name: product.name,
      price: product.price,
      image_url: product.image_url,
      is_veg: product.is_veg,
      category: product.category,
      description: product.description,
      seller_id: product.seller_id,
      seller_name: product.seller_name || 'Seller',
      seller_rating: product.seller_rating || 0,
      seller_reviews: product.seller_reviews || 0,
      action_type: product.action_type,
      contact_phone: product.contact_phone,
      prep_time_minutes: product.prep_time_minutes,
      fulfillment_mode: product.fulfillment_mode,
      delivery_note: product.delivery_note,
      _catIcon: catConfig?.icon || '🛍️',
      _catName: catConfig?.displayName || product.category,
    });
    setDetailOpen(true);
  }, [categoryConfigs]);

  const parentGroup = category ? getGroupBySlug(category) : undefined;
  const allSubCategories = category ? groupedConfigs[category] || [] : [];

  const { data: allProducts = [], isLoading: productsLoading } = useCategoryProducts(
    category || null,
    effectiveSocietyId
  );

  const { data: nearbyProducts } = useNearbyProducts();

  // Filter sub-categories to only those with at least one product
  const activeCategorySet = useMemo(
    () => new Set(allProducts.map((p) => p.category)),
    [allProducts]
  );
  const subCategories = useMemo(
    () => allSubCategories.filter((c) => activeCategorySet.has(c.category)),
    [allSubCategories, activeCategorySet]
  );
  const showAllTab = subCategories.length > 1;

  // Extract nearby sellers for this parent group from RPC data
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
    enabled: !!category && !!effectiveSocietyId,
  });

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

  const isLoading = groupsLoading || configsLoading;

  if (isLoading) {
    return (
      <AppLayout showHeader={false}>
        <div className="p-4">
          <Skeleton className="h-10 w-full rounded-xl mb-4" />
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

  if (!parentGroup && !groupsLoading && effectiveSocietyId !== undefined) {
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

  // Guard against undefined parentGroup before rendering its properties
  if (!parentGroup) return null;

  return (
    <AppLayout showHeader={false}>
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-background safe-top">
        <div className="px-4 pt-1 pb-2">
          {/* Back + title */}
          <div className="flex items-center gap-2.5 mb-2.5">
            <button onClick={() => navigate(-1)} className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              <ArrowLeft size={18} className="text-foreground" />
            </button>
            <h1 className="text-base font-bold flex items-center gap-1.5 flex-1 min-w-0">
              <span>{parentGroup.icon}</span>
              <span className="truncate">{parentGroup.label}</span>
            </h1>
          </div>

          {/* Search */}
          <div className="relative mb-2">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={`Search in ${parentGroup.label}…`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 h-9 bg-muted border-0 rounded-xl text-sm focus-visible:ring-1"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Sub-category pills — horizontal scroll */}
          {subCategories.length > 0 && (
            <ScrollArea className="pb-1">
              <div className="flex gap-1.5 pb-1">
                {showAllTab && (
                  <button
                    onClick={() => handleSubCategorySelect(null)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap border transition-colors',
                      !activeSubCategory 
                        ? 'bg-foreground text-background border-foreground' 
                        : 'bg-background text-foreground border-border'
                    )}
                  >
                    All
                  </button>
                )}
                {subCategories.map((config) => (
                  <button
                    key={config.category}
                    onClick={() => handleSubCategorySelect(config.category)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap border transition-colors flex items-center gap-1',
                      activeSubCategory === config.category 
                        ? 'bg-foreground text-background border-foreground' 
                        : 'bg-background text-foreground border-border'
                    )}
                  >
                    <span className="text-xs">{config.icon}</span>
                    {config.displayName}
                  </button>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          )}
        </div>

        {/* Sort bar */}
        <div className="border-t border-border/40">
          <ScrollArea className="px-4 py-2">
            <div className="flex gap-1.5">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSortBy(opt.key)}
                  className={cn(
                    'px-3 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap border transition-colors',
                    sortBy === opt.key 
                      ? 'bg-primary/10 text-primary border-primary' 
                      : 'bg-background text-muted-foreground border-border'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
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
            <p className="text-[11px] text-muted-foreground mb-3">
              {displayProducts.length} item{displayProducts.length !== 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {displayProducts.map((product) => (
                <ProductListingCard
                  key={product.id}
                  product={product}
                  onTap={handleProductTap}
                  onNavigate={navigate}
                  categoryConfigs={categoryConfigs as any}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">{parentGroup.icon}</div>
            <h3 className="font-semibold text-sm mb-2">No items found</h3>
            <p className="text-xs text-muted-foreground mb-4">
              {searchQuery ? 'Try a different search' : 'Check back soon for new listings!'}
            </p>
            {!searchQuery && (
              <Link to="/">
                <Button variant="outline" size="sm">Browse other categories</Button>
              </Link>
            )}
          </div>
        )}

        {/* Top Sellers section */}
        {topSellers.length > 0 && !searchQuery && (
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">⭐</span>
              <h3 className="font-bold text-sm">
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

      <ProductDetailSheet
        product={selectedProduct}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onSelectProduct={(sp) => {
          const catConfig = categoryConfigs.find(c => c.category === sp.category);
          setSelectedProduct({
            product_id: sp.id,
            product_name: sp.name,
            price: sp.price,
            image_url: sp.image_url,
            is_veg: sp.is_veg ?? true,
            category: sp.category,
            description: sp.description || null,
            seller_id: sp.seller_id,
            seller_name: sp.seller?.business_name || 'Seller',
            seller_rating: 0,
            seller_reviews: 0,
            action_type: sp.action_type,
            _catIcon: catConfig?.icon || '🛍️',
            _catName: catConfig?.displayName || sp.category,
          });
        }}
        categoryIcon={selectedProduct?._catIcon}
        categoryName={selectedProduct?._catName}
      />
    </AppLayout>
  );
}
