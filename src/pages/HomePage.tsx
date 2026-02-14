import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { CategoryGroupGrid } from '@/components/category/CategoryGroupGrid';
import { SellerCard } from '@/components/seller/SellerCard';
import { OnboardingWalkthrough, useOnboarding } from '@/components/onboarding/OnboardingWalkthrough';
import { TrustScoreDetailed } from '@/components/trust/TrustScoreDetailed';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { SellerProfile } from '@/types/database';
import { Search, ChevronRight, Store, Clock, Heart, Award, MapPin, Utensils, Star, TrendingUp } from 'lucide-react';
import heroBanner from '@/assets/hero-banner.jpg';

export default function HomePage() {
  const { user, profile, isApproved, isSeller, society } = useAuth();
  const { showOnboarding, hasChecked, completeOnboarding } = useOnboarding();
  const [openNowSellers, setOpenNowSellers] = useState<SellerProfile[]>([]);
  const [nearbyBlockSellers, setNearbyBlockSellers] = useState<SellerProfile[]>([]);
  const [topRatedSellers, setTopRatedSellers] = useState<SellerProfile[]>([]);
  const [featuredSellers, setFeaturedSellers] = useState<SellerProfile[]>([]);
  const [favorites, setFavorites] = useState<SellerProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isApproved) {
      fetchData();
    }
  }, [user, isApproved, profile]);

  const fetchData = async () => {
    try {
      const currentHour = new Date().getHours();
      const currentTime = `${String(currentHour).padStart(2, '0')}:00`;

      // Fetch all approved sellers in the user's society
      let query = supabase
        .from('seller_profiles')
        .select(`*, profile:profiles!seller_profiles_user_id_fkey(name, block)`)
        .eq('verification_status', 'approved')
        .order('rating', { ascending: false });

      if (profile?.society_id) {
        query = query.eq('society_id', profile.society_id);
      }

      const { data: allSellers } = await query;

      const sellers = (allSellers as any) || [];

      // Filter for Open Now (available and within hours)
      const openNow = sellers.filter((s: any) => {
        if (!s.is_available) return false;
        if (!s.availability_start || !s.availability_end) return true;
        return s.availability_start <= currentTime && s.availability_end >= currentTime;
      }).slice(0, 6);
      setOpenNowSellers(openNow);

      // Filter for nearby block
      if (profile?.block) {
        const nearby = sellers.filter((s: any) => s.profile?.block === profile.block).slice(0, 5);
        setNearbyBlockSellers(nearby);
      }

      // Top rated (4+ rating)
      const topRated = sellers.filter((s: any) => s.rating >= 4).slice(0, 5);
      setTopRatedSellers(topRated);

      // Featured sellers
      const featured = sellers.filter((s: any) => s.is_featured).slice(0, 5);
      setFeaturedSellers(featured);

      // Fetch user favorites
      if (user) {
        const { data: favData } = await supabase
          .from('favorites')
          .select(`seller:seller_profiles(*, profile:profiles!seller_profiles_user_id_fkey(name, block))`)
          .eq('user_id', user.id)
          .limit(5);

        const favSellers = favData
          ?.map((f: any) => f.seller)
          .filter((s: any) => s && s.verification_status === 'approved') || [];
        
        setFavorites(favSellers);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Show onboarding for new users
  if (hasChecked && showOnboarding && isApproved) {
    return <OnboardingWalkthrough onComplete={completeOnboarding} />;
  }

  // Only show verification pending if we have profile data (not during initial load)
  if (!isApproved && profile) {
    return (
      <AppLayout showCart={false}>
        <div className="px-4 py-8">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-warning/20 flex items-center justify-center">
              <Clock className="text-warning" size={40} />
            </div>
            <h2 className="text-xl font-bold mb-2">Verification Pending</h2>
            <p className="text-muted-foreground mb-6">
              Your profile is being verified by the community admin. You'll be able to browse and order once approved.
            </p>
            <div className="bg-muted rounded-lg p-4 text-left">
              <h3 className="font-semibold mb-2">Your Details</h3>
              <p className="text-sm text-muted-foreground">
                Name: {profile.name}<br />
                Block: {profile.block}<br />
                Flat: {profile.flat_number}
              </p>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }
  
  // Show loading while profile is being fetched
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
        {/* Hero Banner with Primary CTA */}
        <div className="relative h-44 mx-4 mt-4 rounded-2xl overflow-hidden">
          <img
            src={heroBanner}
            alt="Community marketplace"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-black/30" />
          <div className="absolute inset-0 flex flex-col justify-center px-4">
            <h2 className="text-white text-xl font-bold">Fresh from your neighbors</h2>
            <p className="text-white/80 text-sm mt-1 mb-4">
              Homemade food & local goods
            </p>
            <Link to="/search">
              <Button className="w-fit">
                <Utensils size={16} className="mr-2" />
                Order Food Now
              </Button>
            </Link>
          </div>
        </div>

        {/* Trust Score */}
        <div className="px-4 mt-4">
          <TrustScoreDetailed />
        </div>

        {/* Search Bar */}
        <div className="px-4 mt-4">
          <Link to="/search">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
              <Input
                placeholder="Search for food, snacks, groceries..."
                className="pl-10 bg-muted border-0"
                readOnly
              />
            </div>
          </Link>
        </div>

        {/* Categories */}
        <div className="mt-6 px-4">
          <h3 className="font-semibold mb-3">What are you looking for?</h3>
          <CategoryGroupGrid variant="compact" excludeGroups={['services']} />
        </div>

        {/* Open Now Section */}
        {openNowSellers.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between px-4 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <h3 className="font-semibold">Open Now</h3>
              </div>
              <Link to="/search?filter=open" className="text-sm text-primary font-medium">
                See all
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4">
              {openNowSellers.map((seller) => (
                <Link key={seller.id} to={`/seller/${seller.id}`} className="shrink-0 w-40">
                  <div className="bg-card rounded-xl overflow-hidden shadow-sm">
                    <div className="h-20 relative">
                      {seller.cover_image_url ? (
                        <img src={seller.cover_image_url} alt={seller.business_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                          <span className="text-2xl">🍴</span>
                        </div>
                      )}
                      <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-success text-[10px] text-white font-medium">
                        Open
                      </div>
                    </div>
                    <div className="p-2">
                      <p className="font-medium text-sm truncate">{seller.business_name}</p>
                      {seller.rating > 0 && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Star size={10} className="fill-warning text-warning" />
                          {seller.rating.toFixed(1)}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Near Your Block Section */}
        {nearbyBlockSellers.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between px-4 mb-3">
              <div className="flex items-center gap-2">
                <MapPin className="text-info" size={18} />
                <h3 className="font-semibold">Near Block {profile?.block}</h3>
              </div>
            </div>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4">
              {nearbyBlockSellers.map((seller) => (
                <Link key={seller.id} to={`/seller/${seller.id}`} className="shrink-0 w-40">
                  <div className="bg-card rounded-xl overflow-hidden shadow-sm">
                    <div className="h-20 relative">
                      {seller.cover_image_url ? (
                        <img src={seller.cover_image_url} alt={seller.business_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-info/20 to-accent/20 flex items-center justify-center">
                          <span className="text-2xl">🏠</span>
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="font-medium text-sm truncate">{seller.business_name}</p>
                      <p className="text-xs text-muted-foreground">Block {(seller as any).profile?.block}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Favorites Section */}
        {favorites.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between px-4 mb-3">
              <div className="flex items-center gap-2">
                <Heart className="text-primary" size={18} />
                <h3 className="font-semibold">Your Favorites</h3>
              </div>
              <Link to="/favorites" className="text-sm text-primary font-medium">
                See all
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4">
              {favorites.map((seller) => (
                <Link key={seller.id} to={`/seller/${seller.id}`} className="shrink-0 w-48">
                  <div className="bg-card rounded-xl overflow-hidden shadow-sm">
                    <div className="h-24 relative">
                      {seller.cover_image_url ? (
                        <img src={seller.cover_image_url} alt={seller.business_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                          <span className="text-2xl">🍴</span>
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="font-medium text-sm truncate">{seller.business_name}</p>
                      {seller.rating > 0 && (
                        <p className="text-xs text-muted-foreground">⭐ {seller.rating.toFixed(1)}</p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Featured Sellers */}
        {featuredSellers.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between px-4 mb-3">
              <div className="flex items-center gap-2">
                <Award className="text-warning" size={18} />
                <h3 className="font-semibold">Featured Sellers</h3>
              </div>
            </div>
            <div className="px-4 space-y-3">
              {featuredSellers.map((seller) => (
                <SellerCard key={seller.id} seller={seller as any} />
              ))}
            </div>
          </div>
        )}

        {/* Become a Seller CTA */}
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

        {/* Top Rated Section */}
        {topRatedSellers.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between px-4 mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="text-primary" size={18} />
                <h3 className="font-semibold">Top Rated</h3>
              </div>
              <Link to="/search?sort=rating" className="text-sm text-primary font-medium">
                See all
              </Link>
            </div>
            
            <div className="px-4 space-y-3">
              {isLoading ? (
                <>
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-48 w-full rounded-xl" />
                  ))}
                </>
              ) : (
                topRatedSellers.map((seller) => (
                  <SellerCard key={seller.id} seller={seller as any} />
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
