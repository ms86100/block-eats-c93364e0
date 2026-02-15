import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { SearchFilters, FilterState, defaultFilters } from '@/components/search/SearchFilters';
import { FilterPresets } from '@/components/search/FilterPresets';
import { Skeleton } from '@/components/ui/skeleton';
import { VegBadge } from '@/components/ui/veg-badge';
import { ArrowLeft, Search as SearchIcon, X, Globe, Star, MapPin, Home, Tag } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';

// ── Types ──────────────────────────────────────────────
interface ProductSearchResult {
  product_id: string;
  product_name: string;
  price: number;
  image_url: string | null;
  is_veg: boolean | null;
  category: string | null;
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

const CATEGORY_LABELS: Record<string, string> = {
  food_drinks: 'Food',
  home_food: 'Home Food',
  groceries: 'Grocery',
  education: 'Classes',
  rentals: 'Rentals',
  pets: 'Pets',
  wellness: 'Wellness',
  services: 'Services',
  fashion: 'Fashion',
  electronics: 'Electronics',
};

// ── Component ──────────────────────────────────────────
export default function SearchPage() {
  const { user, effectiveSocietyId, profile } = useAuth();
  const [searchParams] = useSearchParams();

  // Search state
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [filters, setFilters] = useState<FilterState>(loadSavedFilters);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Cross-society browsing – initialised from profile
  const [browseBeyond, setBrowseBeyondLocal] = useState(
    (profile as any)?.browse_beyond_community ?? false,
  );
  const [searchRadius, setSearchRadiusLocal] = useState(
    (profile as any)?.search_radius_km ?? 5,
  );

  // ── Persist preferences (same pattern as HomePage) ──
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

  // ── URL-driven presets on mount ──
  useEffect(() => {
    const sort = searchParams.get('sort');
    if (sort === 'rating') {
      handlePresetSelect('top_rated', { minRating: 4, sortBy: 'rating' });
    }
  }, []);

  // ── Fire search on query / filter change ──
  useEffect(() => {
    if (debouncedQuery.length >= 1 || hasActiveFilters()) {
      runSearch(debouncedQuery);
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
    } else {
      setResults([]);
      setHasSearched(false);
    }
  }, [debouncedQuery, filters, browseBeyond, searchRadius]);

  const hasActiveFilters = () =>
    filters.minRating > 0 ||
    filters.isVeg !== null ||
    filters.categories.length > 0 ||
    filters.block !== null ||
    filters.sortBy !== null ||
    filters.priceRange[0] > 0 ||
    filters.priceRange[1] < 1000;

  // ── Core search ──────────────────────────────────────
  const runSearch = async (term: string) => {
    setIsLoading(true);
    setHasSearched(true);

    try {
      const products: ProductSearchResult[] = [];

      // 1) Same-society search
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
      }

      // 2) Cross-society search (only when toggled on)
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
              // Deduplicate by product_id
              if (!products.some((x) => x.product_id === p.id)) {
                products.push({
                  product_id: p.id,
                  product_name: p.name,
                  price: p.price,
                  image_url: p.image_url,
                  is_veg: p.is_veg,
                  category: p.category,
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
      if (filters.categories.length > 0) filtered = filtered.filter((p) => p.category && filters.categories.includes(p.category as any));
      if (filters.priceRange[0] > 0 || filters.priceRange[1] < 1000) {
        filtered = filtered.filter((p) => p.price >= filters.priceRange[0] && p.price <= filters.priceRange[1]);
      }

      // Sort: same-society first, then by distance, then by rating
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

      setResults(filtered);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Filter helpers ──
  const clearFilters = () => {
    setQuery('');
    setFilters(defaultFilters);
    setActivePreset(null);
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

  // Active-filter pills
  const pills: string[] = [];
  if (query) pills.push(`"${query}"`);
  if (filters.minRating > 0) pills.push(`${filters.minRating}+★`);
  if (filters.isVeg === true) pills.push('Veg');
  if (filters.isVeg === false) pills.push('Non-veg');
  if (filters.categories.length) pills.push(...filters.categories.map((c) => CATEGORY_LABELS[c] || c));
  if (filters.sortBy) {
    const labels: Record<string, string> = { rating: 'Top Rated', newest: 'Newest', price_low: '₹ Low→High', price_high: '₹ High→Low' };
    pills.push(labels[filters.sortBy]);
  }

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
              placeholder="Search products, food, classes…"
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

        {/* ─── Filter presets ─── */}
        <FilterPresets activePreset={activePreset} onPresetSelect={handlePresetSelect} />

        {/* ─── Browse-beyond toggle (compact) ─── */}
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
        {isLoading ? (
          <div className="space-y-3 mt-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : hasSearched ? (
          results.length > 0 ? (
            <div className="space-y-2 mt-2">
              <p className="text-xs text-muted-foreground px-1">
                {results.length} product{results.length !== 1 && 's'} found
              </p>
              {results.map((p) => (
                <ProductResultCard key={p.product_id} product={p} />
              ))}
            </div>
          ) : (
            <EmptyState />
          )
        ) : (
          <IdleState />
        )}
      </div>
    </AppLayout>
  );
}

// ── Product Result Card ────────────────────────────────
function ProductResultCard({ product: p }: { product: ProductSearchResult }) {
  return (
    <Link to={`/seller/${p.seller_id}`} className="block">
      <div className="flex gap-3 bg-card border border-border rounded-xl p-3 hover:shadow-sm transition-shadow">
        {/* Image */}
        {p.image_url ? (
          <img
            src={p.image_url}
            alt={p.product_name}
            className="w-20 h-20 rounded-lg object-cover shrink-0"
            loading="lazy"
          />
        ) : (
          <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Tag className="text-muted-foreground" size={20} />
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          {/* Row 1: Name + Price */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {p.is_veg !== null && <VegBadge isVeg={p.is_veg} size="sm" />}
              <span className="font-semibold text-sm truncate">{p.product_name}</span>
            </div>
            <span className="text-sm font-bold text-primary whitespace-nowrap">₹{p.price}</span>
          </div>

          {/* Row 2: Category tag */}
          {p.category && (
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded w-fit">
              {CATEGORY_LABELS[p.category] || p.category}
            </span>
          )}

          {/* Row 3: Seller + rating */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="truncate">{p.seller_name}</span>
            {p.seller_rating > 0 && (
              <span className="flex items-center gap-0.5 bg-success/10 text-success px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0">
                <Star size={9} className="fill-success" />
                {Number(p.seller_rating).toFixed(1)}
                {p.seller_reviews > 0 && <span className="text-muted-foreground ml-0.5">({p.seller_reviews})</span>}
              </span>
            )}
          </div>

          {/* Row 4: Location / Distance */}
          <div className="flex items-center gap-1 text-[10px]">
            {p.is_same_society ? (
              <span className="flex items-center gap-0.5 text-primary">
                <Home size={9} />
                Your community
              </span>
            ) : (
              <span className="flex items-center gap-0.5 text-muted-foreground">
                <MapPin size={9} />
                {p.society_name}
                {p.distance_km != null && (
                  <span className="ml-1 text-primary font-medium">{p.distance_km} km</span>
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Empty / Idle states ────────────────────────────────
function EmptyState() {
  return (
    <div className="text-center py-16">
      <SearchIcon className="mx-auto text-muted-foreground mb-3" size={28} />
      <p className="font-medium text-sm text-muted-foreground">No products found</p>
      <p className="text-xs text-muted-foreground mt-1">Try a different term or adjust your filters</p>
    </div>
  );
}

function IdleState() {
  return (
    <div className="text-center py-16">
      <SearchIcon className="mx-auto text-muted-foreground/40 mb-3" size={32} />
      <p className="text-sm text-muted-foreground">Search for products across sellers</p>
      <p className="text-xs text-muted-foreground mt-1">Try "biryani", "yoga", "pet grooming"</p>
    </div>
  );
}
