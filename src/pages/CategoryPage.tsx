import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { SellerCard } from '@/components/seller/SellerCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { VegBadge } from '@/components/ui/veg-badge';
import { Button } from '@/components/ui/button';
import { useCategoryConfigs } from '@/hooks/useCategoryBehavior';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/hooks/useCart';
import { SellerProfile, ProductCategory, Product } from '@/types/database';
import { ArrowLeft, Search, Clock, MapPin, Truck, ShoppingCart, Plus, Minus, X, MessageCircle, Calendar } from 'lucide-react';

type ProductWithSeller = Product & {
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
  const { items, addItem, updateQuantity } = useCart();
  const [sellers, setSellers] = useState<SellerProfile[]>([]);
  const [products, setProducts] = useState<ProductWithSeller[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

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
      const res = await supabase
        .from('products')
        .select('*')
        .eq('category', category as string)
        .eq('is_available', true);
      
      let prodResults = (res.data || []) as any[];
      if (effectiveSocietyId) {
        prodResults = prodResults.filter((p: any) => p.society_id === effectiveSocietyId);
      }

      if (prodResults.length === 0) {
        setProducts([]);
        return;
      }

      const sellerIds = [...new Set(prodResults.map((p: any) => p.seller_id as string))];
      const { data: sellerData } = await supabase
        .from('seller_profiles')
        .select('id, business_name, delivery_radius, availability_start, availability_end, is_available, profile:profiles!seller_profiles_user_id_fkey(block, flat_number)')
        .in('id', sellerIds);

      const sellerMap = new Map((sellerData || []).map((s: any) => [s.id, s]));
      
      const enriched = prodResults.map((p: any) => ({
        ...p,
        seller: sellerMap.get(p.seller_id) || null,
      }));

      setProducts(enriched);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
    );
  }, [searchQuery, products]);

  const showSearchResults = searchQuery.trim().length > 0;

  const getCartQuantity = (productId: string) => {
    return items.find((item) => item.product_id === productId)?.quantity || 0;
  };

  return (
    <AppLayout showHeader={false}>
      <div className="p-4 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Link to="/">
            <ArrowLeft size={24} />
          </Link>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-2xl">{categoryInfo?.icon}</span>
            <h1 className="text-xl font-bold">{categoryInfo?.displayName || category}</h1>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-5">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={`Search in ${categoryInfo?.displayName || category}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Search Results */}
        {showSearchResults ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {filteredProducts.length} result{filteredProducts.length !== 1 ? 's' : ''} for "{searchQuery}"
            </p>
            {filteredProducts.length > 0 ? (
              filteredProducts.map((product) => {
                const qty = getCartQuantity(product.id);
                const seller = product.seller;
                return (
                  <Card key={product.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex gap-3 p-3">
                        {/* Product Image */}
                        <div className="relative w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-muted flex items-center justify-center">
                              <span className="text-2xl">🍽️</span>
                            </div>
                          )}
                          {product.is_bestseller && (
                            <Badge className="absolute top-1 left-1 bg-warning text-warning-foreground text-[9px] px-1 py-0">
                              Bestseller
                            </Badge>
                          )}
                        </div>

                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-1.5">
                            <VegBadge isVeg={product.is_veg} size="sm" className="mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-sm line-clamp-1">{product.name}</h3>
                              {product.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                  {product.description}
                                </p>
                              )}
                            </div>
                          </div>

                          <p className="font-bold text-primary mt-1.5">₹{product.price}</p>

                          {/* Seller & Delivery Info */}
                          {seller && (
                            <div className="mt-2 space-y-1">
                              <Link
                                to={`/seller/${seller.id}`}
                                className="text-xs font-medium text-primary hover:underline"
                              >
                                {seller.business_name}
                              </Link>
                              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                                {seller.profile?.block && (
                                  <span className="flex items-center gap-0.5">
                                    <MapPin size={10} />
                                    Block {seller.profile.block}
                                    {seller.profile.flat_number && `, ${seller.profile.flat_number}`}
                                  </span>
                                )}
                                {seller.availability_start && seller.availability_end && (
                                  <span className="flex items-center gap-0.5">
                                    <Clock size={10} />
                                    {seller.availability_start.slice(0, 5)} – {seller.availability_end.slice(0, 5)}
                                  </span>
                                )}
                                <span className="flex items-center gap-0.5">
                                  <Truck size={10} />
                                  {seller.delivery_radius
                                    ? `Within ${seller.delivery_radius}`
                                    : 'Society delivery'}
                                </span>
                              </div>
                              {!seller.is_available && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-destructive/10 text-destructive">
                                  Currently unavailable
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action button - category-aware */}
                      <div className="px-3 pb-3 flex justify-end">
                        {categoryInfo?.behavior?.supportsCart && !categoryInfo?.behavior?.enquiryOnly && !categoryInfo?.behavior?.requiresTimeSlot ? (
                          qty === 0 ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                              onClick={() => addItem(product)}
                              disabled={!product.is_available || !seller?.is_available}
                            >
                              <Plus size={14} className="mr-1" /> Add
                            </Button>
                          ) : (
                            <div className="flex items-center gap-2 bg-primary rounded-md px-2 shadow-sm">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-primary-foreground hover:bg-primary-foreground/20"
                                onClick={() => updateQuantity(product.id, qty - 1)}
                              >
                                <Minus size={14} />
                              </Button>
                              <span className="font-semibold text-primary-foreground w-4 text-center text-sm">
                                {qty}
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-primary-foreground hover:bg-primary-foreground/20"
                                onClick={() => updateQuantity(product.id, qty + 1)}
                              >
                                <Plus size={14} />
                              </Button>
                            </div>
                          )
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                            disabled={!product.is_available || !seller?.is_available}
                          >
                            {categoryInfo?.behavior?.enquiryOnly ? (
                              <><MessageCircle size={14} className="mr-1" /> Contact</>
                            ) : categoryInfo?.behavior?.requiresTimeSlot ? (
                              <><Calendar size={14} className="mr-1" /> Book</>
                            ) : (
                              <><Plus size={14} className="mr-1" /> View</>
                            )}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="text-center py-12">
                <Search size={32} className="mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-sm">No items found for "{searchQuery}"</p>
                <p className="text-xs text-muted-foreground mt-1">Try a different search term</p>
              </div>
            )}
          </div>
        ) : (
          /* Default: Seller List */
          <>
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
                <p className="text-muted-foreground">No sellers in this category yet</p>
                <Link to="/become-seller" className="text-primary text-sm mt-2 block">
                  Be the first to sell here!
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
