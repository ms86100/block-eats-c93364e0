import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { SellerCard } from '@/components/seller/SellerCard';
import { SearchFilters, FilterState, defaultFilters } from '@/components/search/SearchFilters';
import { Skeleton } from '@/components/ui/skeleton';
import { SellerProfile, CATEGORIES } from '@/types/database';
import { ArrowLeft, Search as SearchIcon, X } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [sellers, setSellers] = useState<SellerProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (query.length >= 2 || hasActiveFilters()) {
      searchSellers();
    } else if (query.length === 0 && !hasActiveFilters()) {
      setSellers([]);
      setHasSearched(false);
    }
  }, [query, filters]);

  const hasActiveFilters = () => {
    return (
      filters.minRating > 0 ||
      filters.isVeg !== null ||
      filters.categories.length > 0 ||
      filters.block !== null ||
      filters.sortBy !== null
    );
  };

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

      // Text search
      if (query.length >= 2) {
        queryBuilder = queryBuilder.ilike('business_name', `%${query}%`);
      }

      // Category filter
      if (filters.categories.length > 0) {
        queryBuilder = queryBuilder.overlaps('categories', filters.categories);
      }

      // Rating filter
      if (filters.minRating > 0) {
        queryBuilder = queryBuilder.gte('rating', filters.minRating);
      }

      // Sorting
      switch (filters.sortBy) {
        case 'rating':
          queryBuilder = queryBuilder.order('rating', { ascending: false });
          break;
        case 'newest':
          queryBuilder = queryBuilder.order('created_at', { ascending: false });
          break;
        default:
          queryBuilder = queryBuilder.order('rating', { ascending: false });
      }

      const { data, error } = await queryBuilder.limit(30);

      if (error) throw error;

      let results = (data as any) || [];

      // Client-side filtering for block (join table)
      if (filters.block) {
        results = results.filter(
          (s: any) => s.profile?.block === filters.block
        );
      }

      setSellers(results);
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearFilters = () => {
    setQuery('');
    setFilters(defaultFilters);
    setSellers([]);
    setHasSearched(false);
  };

  const activeFilterLabels = [];
  if (query) activeFilterLabels.push(`"${query}"`);
  if (filters.minRating > 0) activeFilterLabels.push(`${filters.minRating}+ rating`);
  if (filters.isVeg === true) activeFilterLabels.push('Veg only');
  if (filters.isVeg === false) activeFilterLabels.push('Non-veg');
  if (filters.categories.length > 0) {
    activeFilterLabels.push(
      ...filters.categories.map((c) => CATEGORIES.find((cat) => cat.value === c)?.label || c)
    );
  }
  if (filters.block) activeFilterLabels.push(`Block ${filters.block}`);
  if (filters.sortBy) {
    const sortLabels: Record<string, string> = {
      rating: 'Top Rated',
      newest: 'Newest',
      price_low: 'Price: Low to High',
      price_high: 'Price: High to Low',
    };
    activeFilterLabels.push(sortLabels[filters.sortBy]);
  }

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
          <SearchFilters
            filters={filters}
            onFiltersChange={setFilters}
            showPriceFilter={false}
          />
        </div>

        {/* Active Filters */}
        {activeFilterLabels.length > 0 && (
          <div className="flex items-center gap-2 mb-4 overflow-x-auto scrollbar-hide">
            {activeFilterLabels.map((label, i) => (
              <span
                key={i}
                className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary whitespace-nowrap"
              >
                {label}
              </span>
            ))}
            <button
              onClick={clearFilters}
              className="text-xs text-muted-foreground underline whitespace-nowrap"
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
              <p className="text-sm text-muted-foreground mb-2">
                {sellers.length} seller{sellers.length !== 1 ? 's' : ''} found
              </p>
              {sellers.map((seller) => (
                <SellerCard key={seller.id} seller={seller as any} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No sellers found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Try a different search term or adjust filters
              </p>
            </div>
          )
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              Search for sellers or use filters to discover
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
