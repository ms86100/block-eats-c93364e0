import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { CategoryGrid } from '@/components/category/CategoryGrid';
import { SellerCard } from '@/components/seller/SellerCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { SellerProfile } from '@/types/database';
import { Search, ChevronRight, Store, Clock } from 'lucide-react';
import heroBanner from '@/assets/hero-banner.jpg';

export default function HomePage() {
  const { profile, isApproved, isSeller } = useAuth();
  const [sellers, setSellers] = useState<SellerProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSellers();
  }, []);

  const fetchSellers = async () => {
    try {
      const { data, error } = await supabase
        .from('seller_profiles')
        .select(`
          *,
          profile:profiles(name, block)
        `)
        .eq('verification_status', 'approved')
        .order('rating', { ascending: false })
        .limit(10);

      if (error) throw error;
      setSellers((data as any) || []);
    } catch (error) {
      console.error('Error fetching sellers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isApproved) {
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
                Name: {profile?.name}<br />
                Block: {profile?.block}<br />
                Flat: {profile?.flat_number}
              </p>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="pb-4">
        {/* Hero Banner */}
        <div className="relative h-40 mx-4 mt-4 rounded-2xl overflow-hidden">
          <img
            src={heroBanner}
            alt="Community marketplace"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-center px-4">
            <h2 className="text-white text-lg font-bold">Fresh from your neighbors</h2>
            <p className="text-white/80 text-sm mt-1">
              Homemade food & local goods
            </p>
          </div>
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
          <CategoryGrid variant="scroll" />
        </div>

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

        {/* Popular Sellers */}
        <div className="mt-6">
          <div className="flex items-center justify-between px-4 mb-3">
            <h3 className="font-semibold">Popular Sellers</h3>
            <Link to="/sellers" className="text-sm text-primary font-medium">
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
            ) : sellers.length > 0 ? (
              sellers.map((seller) => (
                <SellerCard key={seller.id} seller={seller as any} />
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No sellers available yet</p>
                <Link to="/become-seller">
                  <Button variant="link" className="text-primary">
                    Be the first to start selling!
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
