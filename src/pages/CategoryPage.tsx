import { useState, useMemo, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProductListingCard, ProductWithSeller } from '@/components/product/ProductListingCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useCategoryConfigs } from '@/hooks/useCategoryBehavior';
import { useAuth } from '@/contexts/AuthContext';
import { ProductCategory, Product } from '@/types/database';
import { SORT_OPTIONS, SortKey } from '@/lib/marketplace-constants';
import { ArrowLeft, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNearbyProducts, mergeProducts } from '@/hooks/queries/useNearbyProducts';
import { useSubcategories } from '@/hooks/useSubcategories';

type ProductWithSellerLocal = Product & {
  seller_id: string;
  seller?: {
    id: string;
    business_name: string;
    delivery_radius?: string;
    availability_start?: string;
    availability_end?: string;
    is_available: boolean;
    profile?: { block?: string; flat_number?: string };
  } | null;
};

export default function CategoryPage() {
  const { category } = useParams<{ category: ProductCategory }>();
  const { configs } = useCategoryConfigs();
  const { effectiveSocietyId } = useAuth();
  const [products, setProducts] = useState<ProductWithSellerLocal[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('relevance');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all');
  const { data: nearbyProducts } = useNearbyProducts();

  // Get all categories in the same parent group for the sidebar
  const categoryInfo = configs.find((c) => c.category === category);
  const categoryConfigId = categoryInfo?.id || null;
  const parentGroup = categoryInfo?.parentGroup;
  const { data: subcategories = [] } = useSubcategories(categoryConfigId);
  const siblingCategories = useMemo(() => {
    if (!parentGroup) return [];
    return configs
      .filter(c => c.parentGroup === parentGroup && c.isActive)
      .sort((a, b) => (a.displayOrder ?? 99) - (b.displayOrder ?? 99));
  }, [configs, parentGroup]);

  useEffect(() => {
    if (category) {
      fetchProducts();
    }
  }, [category, effectiveSocietyId]);

  const fetchProducts = async () => {
    setIsLoadingProducts(true);
    try {
      let q = supabase
        .from('products')
        .select('*, seller:seller_profiles!products_seller_id_fkey(id, business_name, rating, society_id, verification_status, fulfillment_mode, delivery_note)')
        .eq('category', category as string)
        .eq('is_available', true)
        .eq('approval_status', 'approved')
        .eq('seller.verification_status', 'approved');

      // Reset subcategory when category changes
      setSelectedSubcategory('all');

      if (effectiveSocietyId) {
        q = q.eq('seller.society_id', effectiveSocietyId);
      }

      const res = await q;
      const prodResults = (res.data || []).filter((p: any) => p.seller != null) as any[];
      const enriched = prodResults.map((p: any) => ({ ...p, seller: p.seller }));
      setProducts(enriched);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  const displayProducts = useMemo(() => {
    // Merge local products with cross-society nearby products for this category
    const nearbyForCategory = (nearbyProducts || []).filter(
      (p) => p.category === category
    );
    const allProducts = mergeProducts(products as any[], nearbyForCategory);

    let filtered = allProducts;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
      );
    }
    // Subcategory filter
    if (selectedSubcategory && selectedSubcategory !== 'all') {
      filtered = filtered.filter((p: any) => p.subcategory_id === selectedSubcategory);
    }
    const sorted = [...filtered];
    switch (sortBy) {
      case 'price_low': sorted.sort((a, b) => a.price - b.price); break;
      case 'price_high': sorted.sort((a, b) => b.price - a.price); break;
      case 'popular': sorted.sort((a, b) => (b.is_bestseller ? 1 : 0) - (a.is_bestseller ? 1 : 0)); break;
      case 'rating': sorted.sort((a, b) => ((b as any).seller?.rating || 0) - ((a as any).seller?.rating || 0)); break;
      case 'newest': sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
    }
    return sorted;
  }, [products, nearbyProducts, category, searchQuery, sortBy, selectedSubcategory]);

  return (
    <AppLayout showHeader={false}>
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-background border-b border-border safe-top">
        <div className="px-3 pt-2.5 pb-2">
          <div className="flex items-center gap-2 mb-2">
            <Link to="/" className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
              <ArrowLeft size={16} />
            </Link>
            <h1 className="text-sm font-bold flex items-center gap-1.5 flex-1 truncate">
              <span className="text-base">{categoryInfo?.icon}</span>
              {categoryInfo?.displayName || category}
            </h1>
          </div>

          {/* Search */}
          <div className="relative mb-1.5">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={`Search in ${categoryInfo?.displayName || category}…`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-7 h-8 bg-muted border-0 rounded-lg text-xs"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Filter/Sort bar */}
        <div className="flex gap-1.5 px-3 pb-2 overflow-x-auto scrollbar-hide">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key)}
              className={cn(
                'px-2 py-1 rounded-md text-[10px] font-medium whitespace-nowrap transition-colors border',
                sortBy === opt.key
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-card text-muted-foreground border-border'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Subcategory filter chips */}
        {subcategories.length > 0 && (
          <div className="flex gap-1.5 px-3 pb-2 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setSelectedSubcategory('all')}
              className={cn(
                'px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors border',
                selectedSubcategory === 'all'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border'
              )}
            >
              All
            </button>
            {subcategories.map(sub => (
              <button
                key={sub.id}
                onClick={() => setSelectedSubcategory(sub.id)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors border',
                  selectedSubcategory === sub.id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-muted-foreground border-border'
                )}
              >
                {sub.icon || ''} {sub.display_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main: Left sidebar + Right product grid */}
      <div className="flex min-h-[calc(100vh-180px)]">
        {/* Left sidebar — sub-category thumbnails */}
        {siblingCategories.length > 1 && (
          <div className="w-[72px] shrink-0 border-r border-border bg-card overflow-y-auto scrollbar-hide py-2">
            {siblingCategories.map((cat) => {
              const isActive = cat.category === category;
              return (
                <Link
                  key={cat.category}
                  to={`/category/${cat.category}`}
                  className={cn(
                    'flex flex-col items-center gap-1 px-1 py-2 relative transition-colors',
                    isActive && 'bg-primary/10'
                  )}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-primary" />
                  )}
                  <div className={cn(
                    'w-11 h-11 rounded-full flex items-center justify-center text-lg border-2 transition-colors',
                    isActive
                      ? 'border-primary bg-primary/10'
                      : 'border-transparent bg-muted'
                  )}>
                    {cat.imageUrl ? (
                      <img src={cat.imageUrl} alt={cat.displayName} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <span className="text-base">{cat.icon}</span>
                    )}
                  </div>
                  <span className={cn(
                    'text-[8px] leading-tight text-center line-clamp-2 w-full px-0.5',
                    isActive ? 'font-bold text-primary' : 'text-muted-foreground font-medium'
                  )}>
                    {cat.displayName}
                  </span>
                </Link>
              );
            })}
          </div>
        )}

        {/* Right product grid */}
        <div className="flex-1 p-2 pb-6 overflow-y-auto">
          {isLoadingProducts ? (
            <div className="grid grid-cols-2 gap-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-48 w-full rounded-xl" />
              ))}
            </div>
          ) : displayProducts.length > 0 ? (
            <>
              <p className="text-[10px] text-muted-foreground mb-2 px-1">
                {displayProducts.length} item{displayProducts.length !== 1 ? 's' : ''}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {displayProducts.map((product) => (
                  <ProductListingCard
                    key={product.id}
                    product={product as any}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <span className="text-3xl mb-3 block">{categoryInfo?.icon}</span>
              <h3 className="font-semibold text-sm mb-1">No items found</h3>
              <p className="text-xs text-muted-foreground mb-3">
                {searchQuery ? 'Try a different search' : 'No products in this category yet'}
              </p>
              {!searchQuery && (
                <Link to="/become-seller">
                  <Button variant="outline" size="sm" className="text-xs">Be the first to sell here!</Button>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
