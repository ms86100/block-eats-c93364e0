import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { SellerCard } from '@/components/seller/SellerCard';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { SellerProfile } from '@/types/database';
import { Heart, ArrowLeft } from 'lucide-react';

export default function FavoritesPage() {
  const { user, effectiveSocietyId } = useAuth();
  const [favorites, setFavorites] = useState<SellerProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchFavorites();
    }
  }, [user]);

  const fetchFavorites = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('favorites')
        .select(`
          seller:seller_profiles(
            *,
            profile:profiles!seller_profiles_user_id_fkey(name, block)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const sellers = data
        ?.map((f: any) => f.seller)
        .filter((s: any) => s && s.verification_status === 'approved' && s.is_available !== false && (!effectiveSocietyId || s.society_id === effectiveSocietyId)) || [];
      
      setFavorites(sellers);
    } catch (error) {
      console.error('Error fetching favorites:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppLayout showHeader={false}>
      <div className="p-4">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/profile">
            <ArrowLeft size={24} />
          </Link>
          <div className="flex items-center gap-2">
            <Heart className="text-primary" size={24} />
            <h1 className="text-xl font-bold">My Favorites</h1>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-full rounded-xl" />
            ))}
          </div>
        ) : favorites.length > 0 ? (
          <div className="space-y-3">
            {favorites.map((seller) => (
              <SellerCard 
                key={seller.id} 
                seller={seller as any}
                showFavorite={true}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Heart size={32} className="text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold mb-2">No favorites yet</h2>
            <p className="text-muted-foreground mb-4">
              Save your favorite sellers for quick access
            </p>
            <Link to="/" className="text-primary font-medium">
              Explore sellers
            </Link>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
