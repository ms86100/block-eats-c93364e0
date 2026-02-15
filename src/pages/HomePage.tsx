import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { SocietyHealthDashboard } from '@/components/dashboard/SocietyHealthDashboard';
import { CategoryGroupGrid } from '@/components/category/CategoryGroupGrid';
import { OnboardingWalkthrough, useOnboarding } from '@/components/onboarding/OnboardingWalkthrough';
import { ActivityFeed } from '@/components/activity/ActivityFeed';
import { VerificationPendingScreen } from '@/components/onboarding/VerificationPendingScreen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { ProductGridCard, ProductWithSeller } from '@/components/product/ProductGridCard';
import { SellerCard } from '@/components/seller/SellerCard';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveFeatures } from '@/hooks/useEffectiveFeatures';
import { useCategoryConfigs } from '@/hooks/useCategoryBehavior';
import {
  Search, ChevronRight, Store, Heart, Award, MapPin, TrendingUp,
  Activity, Shield, Globe, Users
} from 'lucide-react';
import {
  useOpenNowSellers,
  useNearbyBlockSellers,
  useTopRatedSellers,
  useFeaturedSellers,
  useFavoriteSellers,
} from '@/hooks/queries/useHomeSellers';
import { useNearbySellers } from '@/hooks/queries/useNearbySellers';
import { usePopularProducts } from '@/hooks/queries/usePopularProducts';

export default function HomePage() {
  const { user, profile, isApproved, isSeller, society } = useAuth();
  const { showOnboarding, hasChecked, completeOnboarding } = useOnboarding();
  const { isFeatureEnabled } = useEffectiveFeatures();
  const { configs } = useCategoryConfigs();

  // Cross-society browsing state
  const [browseBeyond, setBrowseBeyondLocal] = useState((profile as any)?.browse_beyond_community ?? false);
  const [searchRadius, setSearchRadiusLocal] = useState((profile as any)?.search_radius_km ?? 5);

  const persistPreference = useCallback(async (field: string, value: any) => {
    if (!user) return;
    await supabase.from('profiles').update({ [field]: value } as any).eq('id', user.id);
  }, [user]);

  const setBrowseBeyond = useCallback((val: boolean) => {
    setBrowseBeyondLocal(val);
    persistPreference('browse_beyond_community', val);
  }, [persistPreference]);

  const setSearchRadius = useCallback((val: number) => {
    setSearchRadiusLocal(val);
    persistPreference('search_radius_km', val);
  }, [persistPreference]);

  const { data: openNowSellers = [], isLoading: loadingOpen } = useOpenNowSellers();
  const { data: nearbyBlockSellers = [] } = useNearbyBlockSellers();
  const { data: topRatedSellers = [], isLoading: loadingTop } = useTopRatedSellers();
  const { data: featuredSellers = [] } = useFeaturedSellers();
  const { data: favorites = [] } = useFavoriteSellers();
  const { data: nearbySellers = [] } = useNearbySellers(searchRadius, browseBeyond);
  const { data: popularProducts = [] } = usePopularProducts(20);

  const isLoading = loadingOpen || loadingTop;

  // Get behavior for a product
  const getBehavior = (category: string) => {
    const config = configs.find((c) => c.category === category);
    return config?.behavior || null;
  };

  if (hasChecked && showOnboarding && isApproved) {
    return <OnboardingWalkthrough onComplete={completeOnboarding} />;
  }

  if (!isApproved && profile) {
    return <VerificationPendingScreen />;
  }

  if (!profile) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-pulse text-primary text-xl font-bold">Loading...</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="pb-4">
        {/* Gate Entry Button */}
        {isFeatureEnabled('resident_identity_verification') && (
          <div className="px-4 pt-4">
            <Link to="/gate-entry">
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <Shield className="text-primary" size={24} />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground">Gate Entry</h4>
                  <p className="text-sm text-muted-foreground">Show QR code to security</p>
                </div>
                <ChevronRight className="text-muted-foreground" size={20} />
              </div>
            </Link>
          </div>
        )}

        {/* ═══ SOCIETY HEALTH DASHBOARD ═══ */}
        <div className="px-4 pt-4">
          <SocietyHealthDashboard />
        </div>

        {/* Society Activity Feed */}
        <div className="px-4 mt-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="text-primary" size={18} />
            <h3 className="font-semibold text-sm">Recent Activity</h3>
          </div>
          <ActivityFeed />
        </div>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* MARKETPLACE — BLINKIT-INSPIRED PRODUCT-FIRST LAYOUT    */}
        {/* ═══════════════════════════════════════════════════════ */}
        <div className="mt-6">
          {/* ─── Prominent Search Bar ─── */}
          <div className="px-4 mb-4">
            <Link to="/search">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  placeholder="Search for groceries, food, services…"
                  className="pl-10 bg-muted border-0 h-12 rounded-xl text-sm font-medium"
                  readOnly
                />
              </div>
            </Link>
          </div>

          {/* ─── Category Strip — horizontal scroll ─── */}
          <div className="px-4 mb-5">
            <CategoryGroupGrid variant="compact" excludeGroups={['services']} />
          </div>

          {/* ─── Product Grid: Popular in Your Society ─── */}
          {popularProducts.length > 0 && (
            <div className="px-4 mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-base text-foreground">Popular nearby</h3>
                <Link to="/search" className="text-xs text-primary font-medium flex items-center gap-0.5">
                  See all <ChevronRight size={14} />
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {popularProducts.slice(0, 9).map((product) => (
                  <ProductGridCard
                    key={product.id}
                    product={product}
                    behavior={getBehavior(product.category)}
                  />
                ))}
              </div>
              {popularProducts.length > 9 && (
                <Link to="/search" className="block mt-3">
                  <Button variant="outline" className="w-full h-9 text-xs font-medium border-border text-muted-foreground">
                    View all {popularProducts.length} items
                  </Button>
                </Link>
              )}
            </div>
          )}

          {/* ─── Open Now sellers (compact horizontal) ─── */}
          {openNowSellers.length > 0 && (
            <OpenNowSection sellers={openNowSellers} />
          )}

          {/* ─── Near Your Block ─── */}
          {nearbyBlockSellers.length > 0 && (
            <NearBlockSection sellers={nearbyBlockSellers} block={profile?.block} />
          )}

          {/* ─── Your Favorites ─── */}
          {favorites.length > 0 && (
            <FavoritesSection sellers={favorites} />
          )}

          {/* ─── Trusted Local Sellers ─── */}
          {featuredSellers.length > 0 && (
            <div className="mt-6 px-4">
              <div className="flex items-center gap-2 mb-3">
                <Award className="text-accent" size={18} />
                <h3 className="font-semibold text-sm">Trusted Local Sellers</h3>
              </div>
              <div className="space-y-3">
                {featuredSellers.map((seller: any) => (
                  <SellerCard key={seller.id} seller={seller} />
                ))}
              </div>
            </div>
          )}

          {/* ─── Browse Beyond Community ─── */}
          <div className="mx-4 mt-6">
            <div className="border border-border/60 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe className="text-primary" size={20} />
                  <div>
                    <p className="font-medium text-sm">Browse beyond my community</p>
                    <p className="text-xs text-muted-foreground">
                      Discover sellers from nearby societies
                    </p>
                  </div>
                </div>
                <Switch checked={browseBeyond} onCheckedChange={setBrowseBeyond} />
              </div>
              {browseBeyond && (
                <div className="space-y-2 pt-2 border-t border-border/40">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Search Radius</span>
                    <span className="text-sm font-medium text-primary">{searchRadius} km</span>
                  </div>
                  <Slider
                    value={[searchRadius]}
                    onValueChange={([v]) => setSearchRadius(v)}
                    min={1}
                    max={10}
                    step={1}
                  />
                </div>
              )}
            </div>
          </div>

          {/* ─── Nearby Society Sellers ─── */}
          {browseBeyond && nearbySellers.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between px-4 mb-3">
                <div className="flex items-center gap-2">
                  <Globe className="text-primary" size={18} />
                  <h3 className="font-semibold text-sm">Nearby Sellers</h3>
                </div>
              </div>
              <div className="px-4 space-y-2">
                {nearbySellers.map((seller: any) => (
                  <Link key={seller.seller_id} to={`/seller/${seller.seller_id}`}>
                    <div className="bg-card rounded-xl overflow-hidden border border-border/50 p-3 hover:shadow-sm transition-shadow">
                      <div className="flex items-center gap-3">
                        {seller.profile_image_url ? (
                          <img src={seller.profile_image_url} alt={seller.business_name} className="w-12 h-12 rounded-lg object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Store className="text-primary" size={20} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{seller.business_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{seller.society_name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {seller.rating > 0 && (
                              <span className="text-[10px] flex items-center gap-0.5 bg-muted px-1.5 py-0.5 rounded-full">
                                <Users size={9} className="text-primary" />
                                {Number(seller.rating).toFixed(1)}
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              {seller.distance_km} km away
                            </span>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-muted-foreground" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* ─── Become a Seller CTA ─── */}
          {!isSeller && (
            <div className="mx-4 mt-6">
              <Link to="/become-seller">
                <div className="bg-secondary rounded-xl p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-secondary-foreground/10 flex items-center justify-center">
                    <Store className="text-secondary-foreground" size={24} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-secondary-foreground">Start Selling</h4>
                    <p className="text-sm text-secondary-foreground/70">
                      Share your homemade food with neighbors
                    </p>
                  </div>
                  <ChevronRight className="text-secondary-foreground" size={20} />
                </div>
              </Link>
            </div>
          )}

          {/* ─── Top Rated ─── */}
          {topRatedSellers.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between px-4 mb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="text-primary" size={18} />
                  <h3 className="font-semibold text-sm">Top Rated</h3>
                </div>
                <Link to="/search?sort=rating" className="text-sm text-primary font-medium">
                  See all
                </Link>
              </div>
              <div className="px-4 space-y-3">
                {isLoading ? (
                  [1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-48 w-full rounded-xl" />
                  ))
                ) : (
                  topRatedSellers.map((seller: any) => (
                    <SellerCard key={seller.id} seller={seller} />
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

// ── Sub-components for seller sections ──────────────────

function OpenNowSection({ sellers }: { sellers: any[] }) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between px-4 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <h3 className="font-semibold text-sm">Open Now</h3>
        </div>
        <Link to="/search" className="text-sm text-primary font-medium">
          See all
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4">
        {sellers.map((seller: any) => (
          <Link key={seller.id} to={`/seller/${seller.id}`} className="shrink-0 w-36">
            <div className="bg-card rounded-xl overflow-hidden border border-border/50">
              <div className="h-20 relative">
                {seller.cover_image_url ? (
                  <img src={seller.cover_image_url} alt={seller.business_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                    <Store className="text-primary/40" size={24} />
                  </div>
                )}
                <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-success text-[10px] text-white font-medium">
                  Open
                </div>
              </div>
              <div className="p-2">
                <p className="font-semibold text-xs truncate">{seller.business_name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  {(seller as any).completed_order_count > 0 ? (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <Users size={9} />
                      {(seller as any).completed_order_count} orders
                    </span>
                  ) : (
                    <span className="text-[10px] text-secondary-foreground bg-secondary px-1.5 py-0.5 rounded-full">
                      New
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function NearBlockSection({ sellers, block }: { sellers: any[]; block?: string }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 px-4 mb-3">
        <MapPin className="text-info" size={18} />
        <h3 className="font-semibold text-sm">Near Block {block}</h3>
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4">
        {sellers.map((seller: any) => (
          <Link key={seller.id} to={`/seller/${seller.id}`} className="shrink-0 w-36">
            <div className="bg-card rounded-xl overflow-hidden border border-border/50">
              <div className="h-20 relative">
                {seller.cover_image_url ? (
                  <img src={seller.cover_image_url} alt={seller.business_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-info/10 to-accent/10 flex items-center justify-center">
                    <Store className="text-info/40" size={24} />
                  </div>
                )}
              </div>
              <div className="p-2">
                <p className="font-semibold text-xs truncate">{seller.business_name}</p>
                <p className="text-[10px] text-muted-foreground">Block {seller.profile?.block}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function FavoritesSection({ sellers }: { sellers: any[] }) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between px-4 mb-3">
        <div className="flex items-center gap-2">
          <Heart className="text-primary" size={18} />
          <h3 className="font-semibold text-sm">Your Favorites</h3>
        </div>
        <Link to="/favorites" className="text-sm text-primary font-medium">
          See all
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4">
        {sellers.map((seller: any) => (
          <Link key={seller.id} to={`/seller/${seller.id}`} className="shrink-0 w-40">
            <div className="bg-card rounded-xl overflow-hidden border border-border/50">
              <div className="h-24 relative">
                {seller.cover_image_url ? (
                  <img src={seller.cover_image_url} alt={seller.business_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                    <Store className="text-primary/40" size={24} />
                  </div>
                )}
              </div>
              <div className="p-2">
                <p className="font-semibold text-sm truncate">{seller.business_name}</p>
                {(seller as any).completed_order_count > 0 && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                    <Users size={9} />
                    {(seller as any).completed_order_count} orders fulfilled
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
