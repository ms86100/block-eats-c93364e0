import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useProductsByCategory } from '@/hooks/queries/useProductsByCategory';
import { useNearbySellers } from '@/hooks/queries/useNearbySellers';
import { CategoryGroupGrid } from '@/components/category/CategoryGroupGrid';
import { ProductGridCard, ProductWithSeller } from '@/components/product/ProductGridCard';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search, Store, MapPin, ChevronRight, Globe, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { escapeIlike } from '@/lib/query-utils';

export function MarketplaceSection() {
  const navigate = useNavigate();
  const { user, profile, effectiveSocietyId } = useAuth();

  const [activeTab, setActiveTab] = useState<'local' | 'nearby'>('local');
  const [searchRadius, setSearchRadiusLocal] = useState(
    (profile as any)?.search_radius_km ?? 5
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProductWithSeller[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const { data: localCategories = [], isLoading: loadingLocal } = useProductsByCategory(200);
  const { data: nearbySellers = [], isLoading: loadingNearby } = useNearbySellers(searchRadius, activeTab === 'nearby');

  const persistPreference = useCallback(async (field: string, value: any) => {
    if (!user) return;
    await supabase.from('profiles').update({ [field]: value } as any).eq('id', user.id);
  }, [user]);

  const setSearchRadius = useCallback((val: number) => {
    setSearchRadiusLocal(val);
    persistPreference('search_radius_km', val);
  }, [persistPreference]);

  // Debounced keyword search
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
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
          .select(`
            *,
            seller:seller_profiles!products_seller_id_fkey(
              id, business_name, rating, society_id, verification_status, fulfillment_mode, delivery_note
            )
          `)
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

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery, effectiveSocietyId]);

  return (
    <div className="mt-6">
      {/* Search Bar */}
      <div className="px-4 mb-4">
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

      {/* Search Results */}
      {searchResults !== null ? (
        <div className="px-4 pb-4">
          <h3 className="font-semibold text-sm mb-3 text-foreground">
            {searchLoading ? 'Searching…' : `${searchResults.length} results for "${searchQuery}"`}
          </h3>
          {searchLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-52 rounded-xl" />)}
            </div>
          ) : searchResults.length === 0 ? (
            <div className="text-center py-12">
              <Search className="mx-auto text-muted-foreground/40 mb-3" size={32} />
              <p className="text-sm text-muted-foreground">No products found</p>
              <p className="text-xs text-muted-foreground mt-1">Try a different keyword</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {searchResults.map(product => (
                <ProductGridCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Category Strip */}
          <div className="px-4 mb-4">
            <CategoryGroupGrid variant="compact" excludeGroups={['services']} />
          </div>

          {/* Tabs */}
          <div className="px-4 mb-4">
            <div className="flex bg-muted rounded-xl p-1">
              <button
                onClick={() => setActiveTab('local')}
                className={cn(
                  'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all',
                  activeTab === 'local'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground'
                )}
              >
                My Society
              </button>
              <button
                onClick={() => setActiveTab('nearby')}
                className={cn(
                  'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5',
                  activeTab === 'nearby'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground'
                )}
              >
                <Globe size={14} />
                Nearby
              </button>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'local' ? (
            <LocalProductsTab categories={localCategories} isLoading={loadingLocal} />
          ) : (
            <NearbyTab
              radius={searchRadius}
              onRadiusChange={setSearchRadius}
              sellers={nearbySellers}
              isLoading={loadingNearby}
            />
          )}
        </>
      )}
    </div>
  );
}

// ── Local Products Tab (Amazon/Blinkit grid) ──
function LocalProductsTab({
  categories,
  isLoading,
}: {
  categories: { category: string; displayName: string; icon: string; products: ProductWithSeller[] }[];
  isLoading: boolean;
}) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="px-4 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i}>
            <Skeleton className="h-6 w-40 mb-3" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-52 rounded-xl" />
              <Skeleton className="h-52 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <Store className="mx-auto text-muted-foreground/40 mb-3" size={32} />
        <p className="text-sm text-muted-foreground">No products available yet</p>
        <p className="text-xs text-muted-foreground mt-1">Check back soon or become a seller!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-4">
      {categories.map(cat => {
        const minPrice = Math.min(...cat.products.map(p => p.price));
        return (
          <div key={cat.category} className="px-4">
            <div
              className="flex items-center justify-between mb-3 cursor-pointer"
              onClick={() => navigate(`/category/${cat.category}`)}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{cat.icon}</span>
                <h3 className="font-bold text-sm text-foreground">{cat.displayName}</h3>
                <span className="text-xs text-muted-foreground">({cat.products.length})</span>
                <span className="text-xs font-semibold text-success">Starting ₹{minPrice}</span>
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {cat.products.slice(0, 4).map(product => (
                <ProductGridCard key={product.id} product={product} />
              ))}
            </div>
            {cat.products.length > 4 && (
              <Link
                to={`/category/${cat.category}`}
                className="block text-center text-xs text-primary font-medium py-2 mt-2"
              >
                View all {cat.products.length} items →
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Nearby Tab ──
function NearbyTab({
  radius,
  onRadiusChange,
  sellers,
  isLoading,
}: {
  radius: number;
  onRadiusChange: (val: number) => void;
  sellers: any[];
  isLoading: boolean;
}) {
  const navigate = useNavigate();

  return (
    <div className="px-4 space-y-4 pb-4">
      {/* Radius Control */}
      <div className="border border-border/60 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="text-primary" size={18} />
            <span className="text-sm font-medium">Search Radius</span>
          </div>
          <span className="text-sm font-bold text-primary">{radius} km</span>
        </div>
        <Slider
          value={[radius]}
          onValueChange={([v]) => onRadiusChange(v)}
          min={1}
          max={10}
          step={1}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : sellers.length === 0 ? (
        <div className="text-center py-12">
          <Globe className="mx-auto text-muted-foreground/40 mb-3" size={32} />
          <p className="text-sm text-muted-foreground">No sellers found nearby</p>
          <p className="text-xs text-muted-foreground mt-1">Try increasing the search radius</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sellers.map((seller: any) => (
            <Link key={seller.seller_id} to={`/seller/${seller.seller_id}`}>
              <div className="bg-card rounded-xl border border-border/50 p-3 hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Store className="text-primary" size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{seller.business_name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <MapPin size={9} />
                        {seller.distance_km} km away
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate">{seller.society_name}</span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
