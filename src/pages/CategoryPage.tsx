import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProductGridCard } from '@/components/product/ProductGridCard';
import { SellerCard } from '@/components/seller/SellerCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useCategoryConfigs } from '@/hooks/useCategoryBehavior';
import { useAuth } from '@/contexts/AuthContext';
import { SellerProfile, ProductCategory, Product } from '@/types/database';
import { ArrowLeft, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ProductWithSeller = Product & {
  seller_id: string;
  seller?: {
    id: string;
    business_name: string;
    delivery_radius?: string;
    availability_start?: string;
    availability_end?: string;
    is_available: boolean;
    profile?: { block?: string; flat_number?: string };
  } | null;
};

export default function CategoryPage() {
  const { category } = useParams<{ category: ProductCategory }>();
  const { configs } = useCategoryConfigs();
  const { effectiveSocietyId } = useAuth();
  const [sellers, setSellers] = useState<SellerProfile[]>([]);
  const [products, setProducts] = useState<ProductWithSeller[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'relevance' | 'price_low' | 'price_high' | 'popular'>('relevance');

  const categoryInfo = configs.find((c) => c.category === category);

  useEffect(() => {
    if (category) {
      fetchSellers();
      fetchProducts();
    }
  }, [category, effectiveSocietyId]);

  const fetchSellers = async () => {
    try {
      let query = supabase
        .from('seller_profiles')
        .select(`*, profile:profiles!seller_profiles_user_id_fkey(name, block)`)
        .eq('verification_status', 'approved')
        .contains('categories', [category])
        .order('rating', { ascending: false });

      if (effectiveSocietyId) {
        query = query.eq('society_id', effectiveSocietyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setSellers((data as any) || []);
    } catch (error) {
      console.error('Error fetching sellers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      let q = supabase
        .from('products')
        .select('*, seller:seller_profiles!products_seller_id_fkey(id, business_name, rating, society_id, verification_status, fulfillment_mode, delivery_note)')
        .eq('category', category as string)
        .eq('is_available', true)
        .eq('approval_status', 'approved')
        .eq('seller.verification_status', 'approved');

      if (effectiveSocietyId) {
        q = q.eq('seller.society_id', effectiveSocietyId);
      }

      const res = await q;
      
      const prodResults = (res.data || []).filter((p: any) => p.seller != null) as any[];

      const enriched = prodResults.map((p: any) => ({
        ...p,
        seller: p.seller,
      }));

      setProducts(enriched);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const displayProducts = useMemo(() => {
    let filtered = products;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
      );
    }

    const sorted = [...filtered];
    switch (sortBy) {
      case 'price_low':
        sorted.sort((a, b) => a.price - b.price);
        break;
      case 'price_high':
        sorted.sort((a, b) => b.price - a.price);
        break;
      case 'popular':
        sorted.sort((a, b) => (b.is_bestseller ? 1 : 0) - (a.is_bestseller ? 1 : 0));
        break;
    }
    return sorted;
  }, [products, searchQuery, sortBy]);

  return (
    <AppLayout showHeader={false}>
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-background border-b border-border/40">
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center gap-3 mb-3">
            <Link to="/" className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-bold flex items-center gap-2 flex-1">
              <span>{categoryInfo?.icon}</span>
              {categoryInfo?.displayName || category}
            </h1>
          </div>

          {/* Search */}
          <div className="relative mb-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={`Search in ${categoryInfo?.displayName || category}…`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 h-9 bg-muted border-0 rounded-lg text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Sort bar */}
        <div className="flex gap-2 px-4 pb-2 overflow-x-auto scrollbar-hide">
          {[
            { key: 'relevance' as const, label: 'Relevance' },
            { key: 'price_low' as const, label: 'Price: Low' },
            { key: 'price_high' as const, label: 'Price: High' },
            { key: 'popular' as const, label: 'Popular' },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key)}
              className={cn(
                'px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors',
                sortBy === opt.key
                  ? 'bg-foreground text-background'
                  : 'bg-muted/60 text-muted-foreground'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 pb-6">
        {isLoading ? (
          <div className="grid grid-cols-3 gap-2.5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-44 w-full rounded-xl" />
            ))}
          </div>
        ) : displayProducts.length > 0 ? (
          <>
            <p className="text-xs text-muted-foreground mb-3">
              {displayProducts.length} item{displayProducts.length !== 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              {displayProducts.map((product) => (
                <ProductGridCard
                  key={product.id}
                  product={product as any}
                  behavior={categoryInfo?.behavior}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-16">
            <span className="text-4xl mb-4 block">{categoryInfo?.icon}</span>
            <h3 className="font-semibold mb-2">No items found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery ? 'Try a different search' : 'No products in this category yet'}
            </p>
            {!searchQuery && (
              <Link to="/become-seller">
                <Button variant="outline" size="sm">Be the first to sell here!</Button>
              </Link>
            )}
          </div>
        )}

        {/* Top Sellers */}
        {sellers.length > 0 && !searchQuery && (
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">⭐</span>
              <h3 className="font-semibold text-sm">
                Top Sellers in {categoryInfo?.displayName || category}
              </h3>
            </div>
            <div className="space-y-3">
              {sellers.slice(0, 5).map((seller) => (
                <SellerCard key={seller.id} seller={seller as any} />
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
