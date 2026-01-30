import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SellerCard } from '@/components/seller/SellerCard';
import { CategoryGrid } from '@/components/category/CategoryGrid';
import { Skeleton } from '@/components/ui/skeleton';
import { SellerProfile, ProductCategory, CATEGORIES } from '@/types/database';
import { ArrowLeft, Search as SearchIcon, X } from 'lucide-react';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | undefined>();
  const [sellers, setSellers] = useState<SellerProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (query.length >= 2 || selectedCategory) {
      searchSellers();
    } else if (query.length === 0 && !selectedCategory) {
      setSellers([]);
      setHasSearched(false);
    }
  }, [query, selectedCategory]);

  const searchSellers = async () => {
    setIsLoading(true);
    setHasSearched(true);

    try {
      let queryBuilder = supabase
        .from('seller_profiles')
        .select(`
          *,
          profile:profiles(name, block)
        `)
        .eq('verification_status', 'approved');

      if (query.length >= 2) {
        queryBuilder = queryBuilder.ilike('business_name', `%${query}%`);
      }

      if (selectedCategory) {
        queryBuilder = queryBuilder.contains('categories', [selectedCategory]);
      }

      const { data, error } = await queryBuilder
        .order('rating', { ascending: false })
        .limit(20);

      if (error) throw error;
      setSellers((data as any) || []);
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearFilters = () => {
    setQuery('');
    setSelectedCategory(undefined);
    setSellers([]);
    setHasSearched(false);
  };

  return (
    <AppLayout showHeader={false}>
      <div className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <Link to="/">
            <ArrowLeft size={24} />
          </Link>
          <div className="flex-1 relative">
            <SearchIcon
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={18}
            />
            <Input
              placeholder="Search sellers or products..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 pr-10"
              autoFocus
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Category Filter */}
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-3 text-muted-foreground">
            Filter by category
          </h3>
          <CategoryGrid
            selectedCategory={selectedCategory}
            onSelect={setSelectedCategory}
            variant="grid"
          />
        </div>

        {/* Active Filters */}
        {(query || selectedCategory) && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-muted-foreground">Filters:</span>
            {query && (
              <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                "{query}"
              </span>
            )}
            {selectedCategory && (
              <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                {CATEGORIES.find((c) => c.value === selectedCategory)?.label}
              </span>
            )}
            <button
              onClick={clearFilters}
              className="text-xs text-muted-foreground underline"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Results */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-full rounded-xl" />
            ))}
          </div>
        ) : hasSearched ? (
          sellers.length > 0 ? (
            <div className="space-y-3">
              {sellers.map((seller) => (
                <SellerCard key={seller.id} seller={seller as any} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No sellers found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Try a different search term or category
              </p>
            </div>
          )
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              Search for sellers or select a category
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
