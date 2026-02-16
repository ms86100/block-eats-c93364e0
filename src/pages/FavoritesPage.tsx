import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { SellerProfile } from '@/types/database';
import { Heart, ArrowLeft, Store } from 'lucide-react';
import { FavoriteButton } from '@/components/favorite/FavoriteButton';

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

  const handleRemoved = (sellerId: string) => {
    setFavorites(prev => prev.filter(s => s.id !== sellerId));
  };

  return (
    <AppLayout showHeader={false}>
      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-background border-b border-border px-4 py-3 safe-top flex items-center gap-3">
        <Link to="/profile">
          <ArrowLeft size={22} className="text-foreground" />
        </Link>
        <h1 className="text-lg font-bold text-foreground">Favourites</h1>
        {favorites.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">{favorites.length} saved</span>
        )}
      </div>

      <div className="p-3">
        {isLoading ? (
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="aspect-square rounded-xl" />
            ))}
          </div>
        ) : favorites.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {favorites.map((seller) => (
              <FavoriteSellerCard
                key={seller.id}
                seller={seller}
                onRemoved={() => handleRemoved(seller.id)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
              <Heart size={28} className="text-muted-foreground" />
            </div>
            <h2 className="text-base font-semibold mb-1">No favourites yet</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Tap the heart icon on any store to save it here
            </p>
            <Link to="/" className="text-sm font-semibold text-accent">
              Browse stores →
            </Link>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function FavoriteSellerCard({ seller, onRemoved }: { seller: any; onRemoved: () => void }) {
  return (
    <Link to={`/seller/${seller.id}`} className="block">
      <div className="relative rounded-xl border border-border bg-card overflow-hidden">
        {/* Image */}
        <div className="aspect-square bg-muted flex items-center justify-center relative">
          {seller.logo_url ? (
            <img
              src={seller.logo_url}
              alt={seller.store_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <Store size={28} className="text-muted-foreground" />
          )}

          {/* Heart overlay top-right */}
          <div className="absolute top-1 right-1">
            <FavoriteButton
              sellerId={seller.id}
              initialFavorite={true}
              size="sm"
              onToggle={(isFav) => { if (!isFav) onRemoved(); }}
            />
          </div>
        </div>

        {/* Label */}
        <div className="p-1.5">
          <p className="text-xs font-medium text-foreground truncate leading-tight">
            {seller.store_name}
          </p>
          {seller.profile?.name && (
            <p className="text-[10px] text-muted-foreground truncate">
              {seller.profile.name}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
