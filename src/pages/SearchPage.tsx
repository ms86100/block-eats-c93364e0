import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/hooks/useCart';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { SearchFilters, FilterState, defaultFilters } from '@/components/search/SearchFilters';
import { FilterPresets } from '@/components/search/FilterPresets';
import { Skeleton } from '@/components/ui/skeleton';
import { ProductDetailSheet } from '@/components/product/ProductDetailSheet';
import { ProductGridCard, ProductWithSeller } from '@/components/product/ProductGridCard';
import { useCategoryConfigs } from '@/hooks/useCategoryBehavior';
import { ArrowLeft, Search as SearchIcon, X, Globe, ShoppingBag } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';


// ── Types ──────────────────────────────────────────────
interface ProductSearchResult {
  product_id: string;
  product_name: string;
  price: number;
  image_url: string | null;
  is_veg: boolean | null;
  category: string | null;
  description?: string | null;
  prep_time_minutes?: number | null;
  fulfillment_mode?: string | null;
  delivery_note?: string | null;
  action_type?: string | null;
  contact_phone?: string | null;
  seller_id: string;
  seller_name: string;
  seller_rating: number;
  seller_reviews: number;
  society_name: string | null;
  distance_km: number | null;
  is_same_society: boolean;
}

// ── Helpers ────────────────────────────────────────────
const FILTER_STORAGE_KEY = 'sociva_search_filters';

const loadSavedFilters = (): FilterState => {
  try {
    const saved = localStorage.getItem(FILTER_STORAGE_KEY);
    if (saved) return { ...defaultFilters, ...JSON.parse(saved) };
  } catch {
    localStorage.removeItem(FILTER_STORAGE_KEY);
  }
  return defaultFilters;
};

function useDebounce<T>(value: T, delay: number): T {
  const [d, setD] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return d;
}

// ── Component ──────────────────────────────────────────
export default function SearchPage() {
  const { user, effectiveSocietyId, profile } = useAuth();
  const { items: cartItems, addItem, updateQuantity } = useCart();
  const [searchParams] = useSearchParams();
  const [selectedProduct, setSelectedProduct] = useState<ProductSearchResult | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const { configs: categoryConfigs, isLoading: categoriesLoading } = useCategoryConfigs();

  // Build a lookup map: category slug -> { icon, displayName, supportsCart, etc. }
  const categoryMap = useMemo(() => {
    const m: Record<string, { icon: string; displayName: string; color: string; supportsCart?: boolean; enquiryOnly?: boolean; requiresTimeSlot?: boolean }> = {};
    categoryConfigs.forEach((c) => {
      m[c.category] = {
        icon: c.icon,
        displayName: c.displayName,
        color: c.color,
        supportsCart: c.behavior?.supportsCart ?? false,
        enquiryOnly: c.behavior?.enquiryOnly ?? false,
        requiresTimeSlot: c.behavior?.requiresTimeSlot ?? false,
      };
    });
    return m;
  }, [categoryConfigs]);

  // Search state
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [filters, setFilters] = useState<FilterState>(loadSavedFilters);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [popularProducts, setPopularProducts] = useState<ProductSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPopular, setIsLoadingPopular] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);

  // Cross-society browsing
  const [browseBeyond, setBrowseBeyondLocal] = useState(
    (profile as any)?.browse_beyond_community ?? false,
  );
  const [searchRadius, setSearchRadiusLocal] = useState(
    (profile as any)?.search_radius_km ?? 5,
  );

  const persistPreference = useCallback(
    async (field: string, value: any) => {
      if (!user) return;
      await supabase.from('profiles').update({ [field]: value } as any).eq('id', user.id);
    },
    [user],
  );

  const setBrowseBeyond = useCallback(
    (val: boolean) => {
      setBrowseBeyondLocal(val);
      persistPreference('browse_beyond_community', val);
    },
    [persistPreference],
  );

  const setSearchRadius = useCallback(
    (val: number) => {
      setSearchRadiusLocal(val);
      persistPreference('search_radius_km', val);
    },
    [persistPreference],
  );

  // ── Load popular products on mount ──
  useEffect(() => {
    loadPopularProducts();
  }, [effectiveSocietyId]);

  const loadPopularProducts = async () => {
    setIsLoadingPopular(true);
    try {
      let query = supabase
        .from('products')
        .select('id, name, price, description, prep_time_minutes, image_url, is_veg, category, seller_id, action_type, contact_phone, seller:seller_profiles!inner(id, business_name, rating, total_reviews, society_id, verification_status, fulfillment_mode, delivery_note)')
        .eq('is_available', true)
        .eq('approval_status', 'approved')
        .eq('seller.verification_status', 'approved')
        .order('created_at', { ascending: false })
        .limit(30);

      if (effectiveSocietyId) {
        query = query.eq('seller.society_id', effectiveSocietyId);
      }

      const { data } = await query;
      if (data) {
        const mapped: ProductSearchResult[] = data.map((p: any) => ({
          product_id: p.id,
          product_name: p.name,
          price: p.price,
          image_url: p.image_url,
          is_veg: p.is_veg,
          category: p.category,
          description: p.description,
          prep_time_minutes: p.prep_time_minutes,
          fulfillment_mode: p.seller?.fulfillment_mode || null,
          delivery_note: p.seller?.delivery_note || null,
          action_type: p.action_type || null,
          contact_phone: p.contact_phone || null,
          seller_id: p.seller?.id || p.seller_id,
          seller_name: p.seller?.business_name || '',
          seller_rating: p.seller?.rating || 0,
          seller_reviews: p.seller?.total_reviews || 0,
          society_name: null,
          distance_km: null,
          is_same_society: true,
        }));
        setPopularProducts(mapped);
      }
    } catch (err) {
      console.error('Error loading popular products:', err);
    } finally {
      setIsLoadingPopular(false);
    }
  };

  // ── URL-driven presets on mount ──
  useEffect(() => {
    const sort = searchParams.get('sort');
    if (sort === 'rating') {
      handlePresetSelect('top_rated', { minRating: 4, sortBy: 'rating' });
    }
  }, []);

  const hasActiveFilters = () =>
    filters.minRating > 0 ||
    filters.isVeg !== null ||
    filters.categories.length > 0 ||
    filters.sortBy !== null ||
    filters.priceRange[0] > 0 ||
    filters.priceRange[1] < 5000;

  // ── Determine if we're in "active search" mode ──
  const isSearchActive = debouncedQuery.length >= 1 || hasActiveFilters() || selectedCategory !== null;

  // ── Fire search on query / filter / category change ──
  useEffect(() => {
    if (isSearchActive) {
      runSearch(debouncedQuery);
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
    } else {
      setResults([]);
      setHasSearched(false);
    }
  }, [debouncedQuery, filters, browseBeyond, searchRadius, selectedCategory]);

  // Abort controller ref for cancelling stale searches
  const abortRef = useRef<AbortController | null>(null);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  // ── Core search ──
  const runSearch = async (term: string) => {
    // Cancel any in-flight search
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setHasSearched(true);

    try {
      const products: ProductSearchResult[] = [];

      // Combine selectedCategory with filter categories
      const effectiveCategories = selectedCategory
        ? [selectedCategory, ...filters.categories.filter(c => c !== selectedCategory)]
        : filters.categories;

      // 1) Same-society search via RPC (needs search term)
      if (term.length >= 1) {
        const { data } = await supabase.rpc('search_marketplace', {
          search_term: term,
          user_society_id: effectiveSocietyId || null,
        });
        if (data) {
          (data as any[]).forEach((seller) => {
            const items = (seller.matching_products as any[]) || [];
            items.forEach((p: any) => {
              products.push({
                product_id: p.id,
                product_name: p.name,
                price: p.price,
                image_url: p.image_url,
                is_veg: p.is_veg,
                category: p.category,
                action_type: p.action_type || null,
                contact_phone: p.contact_phone || null,
                seller_id: seller.seller_id,
                seller_name: seller.business_name,
                seller_rating: seller.rating,
                seller_reviews: seller.total_reviews,
                society_name: null,
                distance_km: null,
                is_same_society: true,
              });
            });
          });
        }
      } else if (selectedCategory || effectiveCategories.length > 0) {
        // Category-only browse (no search term) - direct query
        let q = supabase
          .from('products')
          .select('id, name, price, description, prep_time_minutes, image_url, is_veg, category, seller_id, action_type, contact_phone, seller:seller_profiles!inner(id, business_name, rating, total_reviews, society_id, verification_status, fulfillment_mode, delivery_note)')
          .eq('is_available', true)
          .eq('approval_status', 'approved')
          .eq('seller.verification_status', 'approved')
          .order('created_at', { ascending: false })
          .limit(50);

        if (effectiveSocietyId) {
          q = q.eq('seller.society_id', effectiveSocietyId);
        }

        const targetCategory = selectedCategory || effectiveCategories[0];
        if (targetCategory) {
          q = q.eq('category', targetCategory);
        }

        const { data } = await q;
        if (data) {
          data.forEach((p: any) => {
            products.push({
              product_id: p.id,
              product_name: p.name,
              price: p.price,
              image_url: p.image_url,
              is_veg: p.is_veg,
              category: p.category,
              description: p.description,
              prep_time_minutes: p.prep_time_minutes,
              fulfillment_mode: p.seller?.fulfillment_mode || null,
              delivery_note: p.seller?.delivery_note || null,
              action_type: p.action_type || null,
              contact_phone: p.contact_phone || null,
              seller_id: p.seller?.id || p.seller_id,
              seller_name: p.seller?.business_name || '',
              seller_rating: p.seller?.rating || 0,
              seller_reviews: p.seller?.total_reviews || 0,
              society_name: null,
              distance_km: null,
              is_same_society: true,
            });
          });
        }
      }

      // 2) Cross-society search
      if (browseBeyond && effectiveSocietyId && term.length >= 1) {
        const { data: nearby } = await supabase.rpc('search_nearby_sellers', {
          _buyer_society_id: effectiveSocietyId,
          _radius_km: searchRadius,
          _search_term: term,
        });
        if (nearby) {
          (nearby as any[]).forEach((seller) => {
            const items = (seller.matching_products as any[]) || [];
            items.forEach((p: any) => {
              if (!products.some((x) => x.product_id === p.id)) {
                products.push({
                  product_id: p.id,
                  product_name: p.name,
                  price: p.price,
                  image_url: p.image_url,
                  is_veg: p.is_veg,
                  category: p.category,
                  action_type: p.action_type || null,
                  contact_phone: p.contact_phone || null,
                  seller_id: seller.seller_id,
                  seller_name: seller.business_name,
                  seller_rating: seller.rating,
                  seller_reviews: seller.total_reviews,
                  society_name: seller.society_name,
                  distance_km: seller.distance_km,
                  is_same_society: false,
                });
              }
            });
          });
        }
      }

      // 3) Apply client-side filters
      let filtered = products;
      if (filters.minRating > 0) filtered = filtered.filter((p) => p.seller_rating >= filters.minRating);
      if (filters.isVeg === true) filtered = filtered.filter((p) => p.is_veg === true);
      if (filters.isVeg === false) filtered = filtered.filter((p) => p.is_veg === false);
      if (effectiveCategories.length > 0 && term.length >= 1) {
        filtered = filtered.filter((p) => p.category && effectiveCategories.includes(p.category as any));
      }
      if (filters.priceRange[0] > 0 || filters.priceRange[1] < 5000) {
        filtered = filtered.filter((p) => p.price >= filters.priceRange[0] && p.price <= filters.priceRange[1]);
      }

      // Sort
      if (filters.sortBy === 'price_low') {
        filtered.sort((a, b) => a.price - b.price);
      } else if (filters.sortBy === 'price_high') {
        filtered.sort((a, b) => b.price - a.price);
      } else if (filters.sortBy === 'rating') {
        filtered.sort((a, b) => b.seller_rating - a.seller_rating);
      } else {
        filtered.sort((a, b) => {
          if (a.is_same_society !== b.is_same_society) return a.is_same_society ? -1 : 1;
          return (a.distance_km ?? 0) - (b.distance_km ?? 0);
        });
      }

      // Only update if this search wasn't cancelled
      if (!controller.signal.aborted) {
        setResults(filtered);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        console.error('Search error:', err);
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  };

  // ── Filter helpers ──
  const clearFilters = () => {
    setQuery('');
    setFilters(defaultFilters);
    setActivePreset(null);
    setSelectedCategory(null);
    setResults([]);
    setHasSearched(false);
    localStorage.removeItem(FILTER_STORAGE_KEY);
  };

  const handleFiltersChange = (f: FilterState) => {
    setFilters(f);
    setActivePreset(null);
  };

  const handlePresetSelect = (id: string | null, pf: Partial<FilterState>) => {
    setActivePreset(id);
    setFilters(id ? { ...defaultFilters, ...pf } : defaultFilters);
  };

  const handleCategoryTap = (cat: string) => {
    setSelectedCategory(prev => prev === cat ? null : cat);
  };

  // Active-filter pills
  const pills: string[] = [];
  if (query) pills.push(`"${query}"`);
  if (selectedCategory) pills.push(categoryMap[selectedCategory]?.displayName || selectedCategory);
  if (filters.minRating > 0) pills.push(`${filters.minRating}+★`);
  if (filters.isVeg === true) pills.push('Veg');
  if (filters.isVeg === false) pills.push('Non-veg');
  if (filters.categories.length) pills.push(...filters.categories.map((c) => categoryMap[c]?.displayName || c));
  if (filters.sortBy) {
    const labels: Record<string, string> = { rating: 'Top Rated', newest: 'Newest', price_low: '₹ Low→High', price_high: '₹ High→Low' };
    pills.push(labels[filters.sortBy]);
  }

  // Products to display
  const displayProducts = isSearchActive ? results : popularProducts;
  const showLoading = isSearchActive ? isLoading : isLoadingPopular;

  const handleProductTap = (p: ProductSearchResult) => {
    setSelectedProduct(p);
    setDetailSheetOpen(true);
  };

  // ── Render ───────────────────────────────────────────
  return (
    <AppLayout showHeader={false}>
      <div className="p-4 pb-24">
        {/* ─── Search bar ─── */}
        <div className="flex items-center gap-3 mb-3">
          <Link to="/" className="shrink-0">
            <ArrowLeft size={22} />
          </Link>
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              placeholder="Search products, food, services…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 pr-9 h-10 rounded-xl text-sm"
              autoFocus
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <X size={16} />
              </button>
            )}
          </div>
          <SearchFilters filters={filters} onFiltersChange={handleFiltersChange} showPriceFilter />
        </div>

        {/* ─── Category Bubbles ─── */}
        <CategoryBubbleRow
          categories={categoryConfigs}
          selectedCategory={selectedCategory}
          onCategoryTap={handleCategoryTap}
          isLoading={categoriesLoading}
        />

        {/* ─── Filter presets ─── */}
        <FilterPresets activePreset={activePreset} onPresetSelect={handlePresetSelect} />

        {/* ─── Browse-beyond toggle ─── */}
        <div className="flex items-center justify-between mt-3 mb-1 px-1">
          <button
            onClick={() => setBrowseBeyond(!browseBeyond)}
            className="flex items-center gap-2 text-sm"
          >
            <Globe size={14} className={browseBeyond ? 'text-primary' : 'text-muted-foreground'} />
            <span className={browseBeyond ? 'text-primary font-medium' : 'text-muted-foreground'}>
              Nearby societies
            </span>
          </button>
          <Switch checked={browseBeyond} onCheckedChange={setBrowseBeyond} className="scale-90" />
        </div>

        {browseBeyond && (
          <div className="flex items-center gap-3 px-1 mb-3">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Radius</span>
            <Slider
              value={[searchRadius]}
              onValueChange={([v]) => setSearchRadius(v)}
              min={1}
              max={10}
              step={1}
              className="flex-1"
            />
            <span className="text-xs font-semibold text-primary w-10 text-right">{searchRadius} km</span>
          </div>
        )}

        {/* ─── Active filter pills ─── */}
        {pills.length > 0 && (
          <div className="flex items-center gap-1.5 mb-3 overflow-x-auto scrollbar-hide">
            {pills.map((label, i) => (
              <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary whitespace-nowrap">
                {label}
              </span>
            ))}
            <button onClick={clearFilters} className="text-[11px] text-muted-foreground underline whitespace-nowrap ml-1">
              Clear
            </button>
          </div>
        )}

        {/* ─── Results ─── */}
        {showLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-56 w-full rounded-xl" />
            ))}
          </div>
        ) : displayProducts.length > 0 ? (
          <ProductGridByCategory
            products={displayProducts}
            categoryMap={categoryMap}
            categoryConfigs={categoryConfigs}
            onProductTap={handleProductTap}
            showCount={isSearchActive}
          />
        ) : isSearchActive ? (
          <EmptyState />
        ) : (
          <EmptyMarketplace />
        )}
      </div>

      {/* Product Detail Sheet */}
      <ProductDetailSheet
        product={selectedProduct}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        categoryIcon={selectedProduct?.category ? categoryMap[selectedProduct.category]?.icon : undefined}
        categoryName={selectedProduct?.category ? categoryMap[selectedProduct.category]?.displayName : undefined}
      />
    </AppLayout>
  );
}

// ── Category Bubble Row ────────────────────────────────
function CategoryBubbleRow({
  categories,
  selectedCategory,
  onCategoryTap,
  isLoading,
}: {
  categories: { category: string; displayName: string; icon: string; color: string }[];
  selectedCategory: string | null;
  onCategoryTap: (cat: string) => void;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex gap-2 mb-3 overflow-hidden">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-16 w-16 rounded-2xl shrink-0" />
        ))}
      </div>
    );
  }

  return (
    <ScrollArea className="mb-3">
      <div className="flex gap-2 pb-2">
        {categories.map((cat) => {
          const isActive = selectedCategory === cat.category;
          return (
            <button
              key={cat.category}
              onClick={() => onCategoryTap(cat.category)}
              className={`flex flex-col items-center gap-1 px-2 py-2 rounded-2xl min-w-[64px] transition-all shrink-0 ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-md scale-105'
                  : 'bg-muted/60 hover:bg-muted'
              }`}
            >
              <span className="text-xl leading-none">{cat.icon}</span>
              <span className={`text-[10px] font-medium leading-tight text-center line-clamp-1 ${
                isActive ? 'text-primary-foreground' : 'text-foreground'
              }`}>
                {cat.displayName}
              </span>
            </button>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

// ── Product Grid By Category (Blinkit-style) ──────────
function ProductGridByCategory({
  products,
  categoryMap,
  categoryConfigs,
  onProductTap,
  showCount,
}: {
  products: ProductSearchResult[];
  categoryMap: Record<string, { icon: string; displayName: string; color: string }>;
  categoryConfigs: { category: string; displayName: string; icon: string; behavior?: any }[];
  onProductTap: (p: ProductSearchResult) => void;
  showCount?: boolean;
}) {
  const grouped = useMemo(() => {
    const g: Record<string, ProductSearchResult[]> = {};
    products.forEach((p) => {
      const cat = p.category || 'other';
      if (!g[cat]) g[cat] = [];
      g[cat].push(p);
    });
    return g;
  }, [products]);

  const categories = Object.keys(grouped);

  const toProductWithSeller = (p: ProductSearchResult): ProductWithSeller => ({
    id: p.product_id,
    seller_id: p.seller_id,
    name: p.product_name,
    price: p.price,
    image_url: p.image_url,
    is_veg: p.is_veg ?? true,
    is_available: true,
    is_bestseller: false,
    is_recommended: false,
    is_urgent: false,
    category: p.category || '',
    description: p.description || null,
    created_at: '',
    updated_at: '',
    seller_name: p.seller_name,
    seller_rating: p.seller_rating,
    fulfillment_mode: p.fulfillment_mode || null,
    delivery_note: p.delivery_note || null,
    action_type: p.action_type || null,
    contact_phone: p.contact_phone || null,
  } as ProductWithSeller);

  const handleGridProductTap = (pw: ProductWithSeller) => {
    const original = products.find((p) => p.product_id === pw.id);
    if (original) onProductTap(original);
  };

  const totalCount = products.length;

  return (
    <div className="mt-2 space-y-5">
      {showCount && (
        <p className="text-xs text-muted-foreground">
          {totalCount} item{totalCount !== 1 ? 's' : ''} found
        </p>
      )}
      {categories.map((cat) => {
        const items = grouped[cat];
        const catInfo = categoryMap[cat];
        const config = categoryConfigs.find((c) => c.category === cat);
        return (
          <div key={cat}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base leading-none">{catInfo?.icon || '📦'}</span>
              <h3 className="font-semibold text-sm text-foreground">
                {catInfo?.displayName || cat}
              </h3>
              <span className="text-xs text-muted-foreground">({items.length})</span>
              <span className="text-xs font-semibold text-success ml-1">
                Starting ₹{Math.min(...items.map(p => p.price))}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {items.map((p) => (
                <ProductGridCard
                  key={p.product_id}
                  product={toProductWithSeller(p)}
                  behavior={config?.behavior || null}
                  onTap={handleGridProductTap}
                  viewOnly
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Empty / Idle states ────────────────────────────────
function EmptyState() {
  return (
    <div className="text-center py-16">
      <SearchIcon className="mx-auto text-muted-foreground mb-3" size={28} />
      <p className="font-medium text-sm text-muted-foreground">No products found</p>
      <p className="text-xs text-muted-foreground mt-1">Try a different term or tap a category above</p>
    </div>
  );
}

function EmptyMarketplace() {
  return (
    <div className="text-center py-16">
      <ShoppingBag className="mx-auto text-muted-foreground/40 mb-3" size={32} />
      <p className="text-sm text-muted-foreground">No products available yet</p>
      <p className="text-xs text-muted-foreground mt-1">Check back soon or try searching</p>
    </div>
  );
}
