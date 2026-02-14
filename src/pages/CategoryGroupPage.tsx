import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { SellerCard } from '@/components/seller/SellerCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useCategoryConfigs } from '@/hooks/useCategoryBehavior';
import { useParentGroups } from '@/hooks/useParentGroups';
import { ServiceCategory } from '@/types/categories';
import { SellerProfile } from '@/types/database';
import { ArrowLeft, Search, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

export default function CategoryGroupPage() {
  const { category } = useParams<{ category: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const subCategory = searchParams.get('sub') as ServiceCategory | null;
  
  const { effectiveSocietyId } = useAuth();
  const { groupedConfigs, isLoading: configsLoading } = useCategoryConfigs();
  const { getGroupBySlug, isLoading: groupsLoading } = useParentGroups();
  const [sellers, setSellers] = useState<SellerProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSubCategory, setActiveSubCategory] = useState<ServiceCategory | null>(subCategory);

  const parentGroup = category ? getGroupBySlug(category) : undefined;
  const subCategories = category ? groupedConfigs[category] || [] : [];

  useEffect(() => {
    if (category) {
      fetchSellers();
    }
  }, [category, activeSubCategory]);

  const fetchSellers = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('seller_profiles')
        .select(`*, profile:profiles!seller_profiles_user_id_fkey(name, block)`)
        .eq('verification_status', 'approved')
        .order('rating', { ascending: false });

      if (category) {
        query = query.eq('primary_group', category);
      }

      // Society isolation: only show sellers from user's society
      if (effectiveSocietyId) {
        query = query.eq('society_id', effectiveSocietyId);
      }

      if (activeSubCategory) {
        query = query.contains('categories', [activeSubCategory]);
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

  const handleSubCategorySelect = (cat: ServiceCategory | null) => {
    setActiveSubCategory(cat);
    if (cat) {
      setSearchParams({ sub: cat });
    } else {
      setSearchParams({});
    }
  };

  if (groupsLoading || configsLoading) {
    return (
      <AppLayout showHeader={false}>
        <div className="p-4">
          <Skeleton className="h-20 w-full rounded-xl mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!parentGroup) {
    return (
      <AppLayout showHeader={false}>
        <div className="p-4 text-center">
          <p>Category not found</p>
          <Link to="/">
            <Button className="mt-4">Go Home</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout showHeader={false}>
      <div className={cn('p-4 pb-2', parentGroup.color.split(' ')[0])}>
        <div className="flex items-center gap-3 mb-4">
          <Link to="/" className="w-10 h-10 rounded-full bg-background/90 flex items-center justify-center shadow-sm">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <span className="text-2xl">{parentGroup.icon}</span>
              {parentGroup.label}
            </h1>
            <p className="text-sm text-muted-foreground">{parentGroup.description}</p>
          </div>
        </div>

        {subCategories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4">
            <button
              onClick={() => handleSubCategorySelect(null)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
                !activeSubCategory ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground'
              )}
            >
              All
            </button>
            {subCategories.map((config) => (
              <button
                key={config.category}
                onClick={() => handleSubCategorySelect(config.category)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1',
                  activeSubCategory === config.category ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground'
                )}
              >
                <span>{config.icon}</span>
                {config.displayName}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">
            {isLoading ? 'Loading...' : `${sellers.length} seller${sellers.length !== 1 ? 's' : ''} found`}
          </p>
          <Button variant="outline" size="sm">
            <Filter size={14} className="mr-1" />
            Filter
          </Button>
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
            <div className="text-4xl mb-4">{parentGroup.icon}</div>
            <h3 className="font-semibold mb-2">No sellers yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Be the first to offer {parentGroup.label.toLowerCase()} in your community!
            </p>
            <Link to="/become-seller">
              <Button>Become a Seller</Button>
            </Link>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
