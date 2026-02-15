import { useState, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useSellersByCategory, SellerInCategory, CategoryWithSellers } from '@/hooks/queries/useSellersByCategory';
import { useNearbySellers } from '@/hooks/queries/useNearbySellers';
import { useOpenNowSellers, useFavoriteSellers } from '@/hooks/queries/useHomeSellers';
import { CategoryGroupGrid } from '@/components/category/CategoryGroupGrid';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search, Store, MapPin, ChevronRight, Users, Globe,
  Heart, Truck, Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function MarketplaceSection() {
  const navigate = useNavigate();
  const { user, profile, effectiveSocietyId } = useAuth();

  const [activeTab, setActiveTab] = useState<'local' | 'nearby'>('local');
  const [searchRadius, setSearchRadiusLocal] = useState(
    (profile as any)?.search_radius_km ?? 5
  );
  const [searchQuery, setSearchQuery] = useState('');

  const { data: localCategories = [], isLoading: loadingLocal } = useSellersByCategory(effectiveSocietyId);
  const { data: nearbySellers = [], isLoading: loadingNearby } = useNearbySellers(searchRadius, activeTab === 'nearby');
  const { data: openNowSellers = [] } = useOpenNowSellers();
  const { data: favorites = [] } = useFavoriteSellers();

  const persistPreference = useCallback(async (field: string, value: any) => {
    if (!user) return;
    await supabase.from('profiles').update({ [field]: value } as any).eq('id', user.id);
  }, [user]);

  const setSearchRadius = useCallback((val: number) => {
    setSearchRadiusLocal(val);
    persistPreference('search_radius_km', val);
  }, [persistPreference]);

  // Filter categories by search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return localCategories;
    const q = searchQuery.toLowerCase();
    return localCategories
      .map(cat => ({
        ...cat,
        sellers: cat.sellers.filter(s =>
          s.business_name.toLowerCase().includes(q)
        ),
      }))
      .filter(cat =>
        cat.sellers.length > 0 ||
        cat.displayName.toLowerCase().includes(q)
      );
  }, [localCategories, searchQuery]);

  // Process nearby sellers into category groups
  const nearbyByCategory = useMemo(() => {
    if (!nearbySellers.length) return [];
    const catMap: Record<string, { sellers: Array<SellerInCategory & { distance_km: number; society_name: string }> }> = {};

    for (const seller of nearbySellers as any[]) {
      const products = (seller.matching_products as any[]) || [];
      // Group this seller's products by category
      const catPrices: Record<string, number> = {};
      for (const p of products) {
        const cat = p.category || 'other';
        catPrices[cat] = Math.min(catPrices[cat] ?? Infinity, p.price);
      }

      for (const [cat, minPrice] of Object.entries(catPrices)) {
        if (!catMap[cat]) catMap[cat] = { sellers: [] };
        catMap[cat].sellers.push({
          seller_id: seller.seller_id,
          business_name: seller.business_name,
          profile_image_url: null,
          rating: seller.rating || 0,
          completed_order_count: 0,
          fulfillment_mode: null,
          is_available: true,
          min_price: minPrice,
          product_count: products.filter((p: any) => (p.category || 'other') === cat).length,
          distance_km: seller.distance_km,
          society_name: seller.society_name,
        });
      }
    }

    return Object.entries(catMap).map(([cat, data]) => ({
      category: cat,
      sellers: data.sellers.sort((a, b) => a.min_price - b.min_price),
    }));
  }, [nearbySellers]);

  return (
    <div className="mt-6">
      {/* Search Bar */}
      <div className="px-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input
            placeholder="Search sellers, products, services…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-muted border-0 h-12 rounded-xl text-sm font-medium"
          />
        </div>
      </div>

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
        <LocalTab
          categories={filteredCategories}
          isLoading={loadingLocal}
          openNowSellers={openNowSellers}
          favorites={favorites}
        />
      ) : (
        <NearbyTab
          radius={searchRadius}
          onRadiusChange={setSearchRadius}
          categories={nearbyByCategory}
          isLoading={loadingNearby}
        />
      )}
    </div>
  );
}

// ── Local Tab ──────────────────────────────────────────
function LocalTab({
  categories,
  isLoading,
  openNowSellers,
  favorites,
}: {
  categories: CategoryWithSellers[];
  isLoading: boolean;
  openNowSellers: any[];
  favorites: any[];
}) {
  if (isLoading) {
    return (
      <div className="px-4 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i}>
            <Skeleton className="h-6 w-40 mb-3" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl mt-2" />
          </div>
        ))}
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <Store className="mx-auto text-muted-foreground/40 mb-3" size={32} />
        <p className="text-sm text-muted-foreground">No sellers available yet</p>
        <p className="text-xs text-muted-foreground mt-1">Check back soon or become a seller!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-4">
      {/* Open Now quick row */}
      {openNowSellers.length > 0 && (
        <div className="px-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <h3 className="font-semibold text-sm">Open Now</h3>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
            {openNowSellers.slice(0, 6).map((seller: any) => (
              <Link key={seller.id} to={`/seller/${seller.id}`} className="shrink-0">
                <div className="flex items-center gap-2 bg-card border border-border/50 rounded-lg px-3 py-2 hover:shadow-sm transition-shadow">
                  {seller.profile_image_url ? (
                    <img src={seller.profile_image_url} alt={seller.business_name} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Store size={14} className="text-primary" />
                    </div>
                  )}
                  <span className="text-xs font-medium whitespace-nowrap">{seller.business_name}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Category → Sellers */}
      {categories.map(cat => (
        <CategorySellerGroup key={cat.category} category={cat} />
      ))}

      {/* Favorites */}
      {favorites.length > 0 && (
        <div className="px-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Heart className="text-primary" size={16} />
              <h3 className="font-semibold text-sm">Your Favorites</h3>
            </div>
            <Link to="/favorites" className="text-xs text-primary font-medium">See all</Link>
          </div>
          <div className="space-y-2">
            {favorites.slice(0, 3).map((seller: any) => (
              <SellerRow
                key={seller.id}
                sellerId={seller.id}
                name={seller.business_name}
                imageUrl={seller.profile_image_url}
                minPrice={seller.products?.length ? Math.min(...seller.products.map((p: any) => p.price)) : null}
                fulfillmentMode={seller.fulfillment_mode}
                rating={seller.rating}
                completedOrders={seller.completed_order_count}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Category Seller Group ──────────────────────────────
function CategorySellerGroup({ category }: { category: CategoryWithSellers }) {
  const minPrice = Math.min(...category.sellers.map(s => s.min_price));
  const navigate = useNavigate();

  return (
    <div className="px-4">
      <div
        className="flex items-center justify-between mb-2 cursor-pointer"
        onClick={() => navigate(`/category/${category.category}`)}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{category.icon}</span>
          <h3 className="font-bold text-sm text-foreground">{category.displayName}</h3>
          <span className="text-xs text-muted-foreground">({category.sellers.length})</span>
          <span className="text-xs font-semibold text-success">Starting ₹{minPrice}</span>
        </div>
        <ChevronRight size={16} className="text-muted-foreground" />
      </div>

      <div className="space-y-2">
        {category.sellers.slice(0, 4).map(seller => (
          <SellerRow
            key={seller.seller_id}
            sellerId={seller.seller_id}
            name={seller.business_name}
            imageUrl={seller.profile_image_url}
            minPrice={seller.min_price}
            fulfillmentMode={seller.fulfillment_mode}
            rating={seller.rating}
            completedOrders={seller.completed_order_count}
            productCount={seller.product_count}
          />
        ))}
        {category.sellers.length > 4 && (
          <Link
            to={`/category/${category.category}`}
            className="block text-center text-xs text-primary font-medium py-2"
          >
            View all {category.sellers.length} sellers →
          </Link>
        )}
      </div>
    </div>
  );
}

// ── Nearby Tab ─────────────────────────────────────────
function NearbyTab({
  radius,
  onRadiusChange,
  categories,
  isLoading,
}: {
  radius: number;
  onRadiusChange: (val: number) => void;
  categories: { category: string; sellers: any[] }[];
  isLoading: boolean;
}) {
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
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-12">
          <Globe className="mx-auto text-muted-foreground/40 mb-3" size={32} />
          <p className="text-sm text-muted-foreground">No sellers found nearby</p>
          <p className="text-xs text-muted-foreground mt-1">Try increasing the search radius</p>
        </div>
      ) : (
        <div className="space-y-5">
          {categories.map(({ category, sellers }) => (
            <div key={category}>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-bold text-sm text-foreground capitalize">{category.replace(/_/g, ' ')}</h3>
                <span className="text-xs text-muted-foreground">({sellers.length})</span>
                <span className="text-xs font-semibold text-success">
                  Starting ₹{Math.min(...sellers.map((s: any) => s.min_price))}
                </span>
              </div>
              <div className="space-y-2">
                {sellers.map((seller: any) => (
                  <SellerRow
                    key={seller.seller_id}
                    sellerId={seller.seller_id}
                    name={seller.business_name}
                    imageUrl={seller.profile_image_url}
                    minPrice={seller.min_price}
                    fulfillmentMode={seller.fulfillment_mode}
                    rating={seller.rating}
                    completedOrders={seller.completed_order_count}
                    distance={seller.distance_km}
                    societyName={seller.society_name}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shared Seller Row Card ─────────────────────────────
function SellerRow({
  sellerId,
  name,
  imageUrl,
  minPrice,
  fulfillmentMode,
  rating,
  completedOrders,
  productCount,
  distance,
  societyName,
}: {
  sellerId: string;
  name: string;
  imageUrl?: string | null;
  minPrice: number | null;
  fulfillmentMode?: string | null;
  rating?: number;
  completedOrders?: number;
  productCount?: number;
  distance?: number;
  societyName?: string;
}) {
  return (
    <Link to={`/seller/${sellerId}`}>
      <div className="bg-card rounded-xl border border-border/50 p-3 hover:shadow-sm transition-shadow">
        <div className="flex items-center gap-3">
          {imageUrl ? (
            <img src={imageUrl} alt={name} className="w-11 h-11 rounded-lg object-cover" />
          ) : (
            <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center">
              <Store className="text-primary" size={18} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{name}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {minPrice !== null && (
                <span className="text-xs font-semibold text-success">Starting ₹{minPrice}</span>
              )}
              {fulfillmentMode && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  {fulfillmentMode === 'delivery' ? <Truck size={9} /> : fulfillmentMode === 'both' ? <Package size={9} /> : <MapPin size={9} />}
                  {fulfillmentMode === 'delivery' ? 'Delivers' : fulfillmentMode === 'both' ? 'Pickup & Delivery' : 'Pickup'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {distance != null && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <MapPin size={9} />
                  {distance} km away
                </span>
              )}
              {societyName && (
                <span className="text-[10px] text-muted-foreground truncate">{societyName}</span>
              )}
              {(completedOrders ?? 0) > 0 && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <Users size={9} />
                  {completedOrders} orders
                </span>
              )}
              {productCount != null && productCount > 0 && (
                <span className="text-[10px] text-muted-foreground">{productCount} items</span>
              )}
            </div>
          </div>
          <ChevronRight size={16} className="text-muted-foreground shrink-0" />
        </div>
      </div>
    </Link>
  );
}
