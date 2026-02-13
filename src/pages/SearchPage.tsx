import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { SellerCard } from '@/components/seller/SellerCard';
import { ProductCard } from '@/components/product/ProductCard';
import { SearchFilters, FilterState, defaultFilters } from '@/components/search/SearchFilters';
import { FilterPresets } from '@/components/search/FilterPresets';
import { Skeleton } from '@/components/ui/skeleton';
import { SellerProfile, CATEGORIES, Product } from '@/types/database';
import { ArrowLeft, Search as SearchIcon, X } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';

// Persist last filters in localStorage
const FILTER_STORAGE_KEY = 'greenfield_search_filters';

interface SearchResult {
  seller_id: string;
  business_name: string;
  description: string | null;
  cover_image_url: string | null;
  profile_image_url: string | null;
  rating: number;
  total_reviews: number;
  categories: string[];
  primary_group: string | null;
  is_available: boolean;
  is_featured: boolean;
  availability_start: string | null;
  availability_end: string | null;
  user_id: string;
  matching_products: Product[] | null;
}

const loadSavedFilters = (): FilterState => {
  try {
    const saved = localStorage.getItem(FILTER_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...defaultFilters, ...parsed };
    }
  } catch (error) {
    // Clear corrupted data and return defaults
    console.warn('[Search] Failed to parse saved filters, clearing cache:', error);
    localStorage.removeItem(FILTER_STORAGE_KEY);
  }
  return defaultFilters;
};

const saveFilters = (filters: FilterState) => {
  localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
};

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function SearchPage() {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [filters, setFilters] = useState<FilterState>(loadSavedFilters);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Apply URL params on mount
  useEffect(() => {
    const sort = searchParams.get('sort');
    const filter = searchParams.get('filter');
    
    if (sort === 'rating') {
      handlePresetSelect('top_rated', { minRating: 4, sortBy: 'rating' });
    } else if (filter === 'open') {
      // For "open now", we'll just search all and show available ones first
      searchMarketplace('');
    }
  }, []);

  useEffect(() => {
    if (debouncedQuery.length >= 1 || hasActiveFilters()) {
      searchMarketplace(debouncedQuery);
      saveFilters(filters);
    } else if (debouncedQuery.length === 0 && !hasActiveFilters()) {
      setSearchResults([]);
      setHasSearched(false);
    }
  }, [debouncedQuery, filters]);

  const hasActiveFilters = () => {
    return (
      filters.minRating > 0 ||
      filters.isVeg !== null ||
      filters.categories.length > 0 ||
      filters.block !== null ||
      filters.sortBy !== null ||
      filters.priceRange[0] > 0 ||
      filters.priceRange[1] < 1000
    );
  };

  const searchMarketplace = async (searchTerm: string) => {
    setIsLoading(true);
    setHasSearched(true);

    try {
      // Use the new search_marketplace function for keyword search
      if (searchTerm.length >= 1) {
        const { data, error } = await supabase.rpc('search_marketplace', {
          search_term: searchTerm
        });

        if (error) throw error;

        let results = ((data as any[]) || []).map(item => ({
          ...item,
          matching_products: item.matching_products as any[] | null
        })) as SearchResult[];

        // Apply additional filters
        if (filters.minRating > 0) {
          results = results.filter(s => s.rating >= filters.minRating);
        }

        if (filters.categories.length > 0) {
          results = results.filter(s => 
            s.categories.some(c => filters.categories.includes(c))
          );
        }

        // Sort results
        if (filters.sortBy === 'rating') {
          results.sort((a, b) => b.rating - a.rating);
        } else if (filters.sortBy === 'newest') {
          // Already sorted by created_at in function, skip
        }

        setSearchResults(results);
      } else {
        // Fallback to regular query without search term
        let queryBuilder = supabase
          .from('seller_profiles')
          .select('*')
          .eq('verification_status', 'approved');

        // Scope to user's society
        if (profile?.society_id) {
          queryBuilder = queryBuilder.eq('society_id', profile.society_id);
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

        // Transform to SearchResult format
        const results: SearchResult[] = ((data as any[]) || []).map(seller => ({
          seller_id: seller.id,
          business_name: seller.business_name,
          description: seller.description,
          cover_image_url: seller.cover_image_url,
          profile_image_url: seller.profile_image_url,
          rating: seller.rating,
          total_reviews: seller.total_reviews,
          categories: seller.categories,
          primary_group: seller.primary_group,
          is_available: seller.is_available,
          is_featured: seller.is_featured,
          availability_start: seller.availability_start,
          availability_end: seller.availability_end,
          user_id: seller.user_id,
          matching_products: null
        }));

        setSearchResults(results);
      }
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearFilters = () => {
    setQuery('');
    setFilters(defaultFilters);
    setActivePreset(null);
    setSearchResults([]);
    setHasSearched(false);
    localStorage.removeItem(FILTER_STORAGE_KEY);
  };

  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setActivePreset(null);
  };

  const handlePresetSelect = (presetId: string | null, presetFilters: Partial<FilterState>) => {
    setActivePreset(presetId);
    if (presetId) {
      setFilters({ ...defaultFilters, ...presetFilters });
    } else {
      setFilters(defaultFilters);
    }
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
            onFiltersChange={handleFiltersChange}
            showPriceFilter={false}
          />
        </div>

        {/* Filter Presets */}
        <div className="mb-4">
          <FilterPresets
            activePreset={activePreset}
            onPresetSelect={handlePresetSelect}
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
          searchResults.length > 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground mb-2">
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
              </p>
              {searchResults.map((result) => (
                <div key={result.seller_id} className="space-y-2">
                  <SellerCard 
                    seller={{
                      id: result.seller_id,
                      business_name: result.business_name,
                      description: result.description,
                      cover_image_url: result.cover_image_url,
                      profile_image_url: result.profile_image_url,
                      rating: result.rating,
                      total_reviews: result.total_reviews,
                      categories: result.categories,
                      primary_group: result.primary_group,
                      is_available: result.is_available,
                      is_featured: result.is_featured,
                      availability_start: result.availability_start,
                      availability_end: result.availability_end,
                      user_id: result.user_id,
                    } as any} 
                  />
                  {/* Show matching products if any */}
                  {result.matching_products && result.matching_products.length > 0 && (
                    <div className="pl-4 border-l-2 border-primary/20 ml-2">
                      <p className="text-xs text-muted-foreground mb-2">
                        Matching products:
                      </p>
                      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                        {result.matching_products.slice(0, 3).map((product: any) => (
                          <Link 
                            key={product.id} 
                            to={`/seller/${result.seller_id}`}
                            className="flex-shrink-0 w-32"
                          >
                            <div className="bg-muted rounded-lg p-2">
                              {product.image_url && (
                                <img 
                                  src={product.image_url} 
                                  alt={product.name}
                                  className="w-full h-20 object-cover rounded mb-1"
                                />
                              )}
                              <p className="text-xs font-medium truncate">{product.name}</p>
                              <p className="text-xs text-primary">₹{product.price}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
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
