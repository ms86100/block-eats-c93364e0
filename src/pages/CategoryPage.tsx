import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { SellerCard } from '@/components/seller/SellerCard';
import { Skeleton } from '@/components/ui/skeleton';
import { SellerProfile, ProductCategory, CATEGORIES } from '@/types/database';
import { ArrowLeft } from 'lucide-react';

export default function CategoryPage() {
  const { category } = useParams<{ category: ProductCategory }>();
  const [sellers, setSellers] = useState<SellerProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const categoryInfo = CATEGORIES.find((c) => c.value === category);

  useEffect(() => {
    if (category) {
      fetchSellers();
    }
  }, [category]);

  const fetchSellers = async () => {
    try {
      const { data, error } = await supabase
        .from('seller_profiles')
        .select(`
          *,
          profile:profiles(name, block)
        `)
        .eq('verification_status', 'approved')
        .contains('categories', [category])
        .order('rating', { ascending: false });

      if (error) throw error;
      setSellers((data as any) || []);
    } catch (error) {
      console.error('Error fetching sellers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppLayout showHeader={false}>
      <div className="p-4">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/">
            <ArrowLeft size={24} />
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{categoryInfo?.icon}</span>
            <h1 className="text-xl font-bold">{categoryInfo?.label}</h1>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-full rounded-xl" />
            ))}
          </div>
        ) : sellers.length > 0 ? (
          <div className="space-y-3">
            {sellers.map((seller) => (
              <SellerCard key={seller.id} seller={seller as any} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <span className="text-5xl mb-4 block">{categoryInfo?.icon}</span>
            <p className="text-muted-foreground">
              No sellers in this category yet
            </p>
            <Link to="/become-seller" className="text-primary text-sm mt-2 block">
              Be the first to sell here!
            </Link>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
