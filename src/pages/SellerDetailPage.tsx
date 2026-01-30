import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProductCard } from '@/components/product/ProductCard';
import { RatingStars } from '@/components/ui/rating-stars';
import { VegBadge } from '@/components/ui/veg-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCart } from '@/hooks/useCart';
import { SellerProfile, Product, CATEGORIES } from '@/types/database';
import { ArrowLeft, Clock, MapPin, Phone, ShoppingCart } from 'lucide-react';

export default function SellerDetailPage() {
  const { id } = useParams();
  const { items, totalAmount } = useCart();
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  useEffect(() => {
    if (id) {
      fetchSellerDetails();
    }
  }, [id]);

  const fetchSellerDetails = async () => {
    try {
      const [sellerRes, productsRes] = await Promise.all([
        supabase
          .from('seller_profiles')
          .select(`
            *,
            profile:profiles(name, block, flat_number, phone)
          `)
          .eq('id', id)
          .single(),
        supabase
          .from('products')
          .select('*')
          .eq('seller_id', id)
          .eq('is_available', true)
          .order('category'),
      ]);

      if (sellerRes.error) throw sellerRes.error;
      if (productsRes.error) throw productsRes.error;

      setSeller(sellerRes.data as any);
      setProducts(productsRes.data || []);
    } catch (error) {
      console.error('Error fetching seller:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProducts = activeCategory === 'all'
    ? products
    : products.filter((p) => p.category === activeCategory);

  const categories = ['all', ...new Set(products.map((p) => p.category))];

  const cartItemsFromSeller = items.filter(
    (item) => item.product?.seller_id === id
  );
  const cartTotal = cartItemsFromSeller.reduce(
    (sum, item) => sum + (item.product?.price || 0) * item.quantity,
    0
  );
  const cartCount = cartItemsFromSeller.reduce((sum, item) => sum + item.quantity, 0);

  if (isLoading) {
    return (
      <AppLayout showHeader={false}>
        <Skeleton className="h-48 w-full" />
        <div className="p-4 space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-32 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!seller) {
    return (
      <AppLayout showHeader={false}>
        <div className="p-4 text-center">
          <p>Seller not found</p>
          <Link to="/">
            <Button className="mt-4">Go Home</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const profile = (seller as any).profile;

  return (
    <AppLayout showHeader={false} showNav={cartCount === 0}>
      {/* Cover Image */}
      <div className="relative h-48">
        {seller.cover_image_url ? (
          <img
            src={seller.cover_image_url}
            alt={seller.business_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <Link
          to="/"
          className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-md"
        >
          <ArrowLeft size={20} />
        </Link>
      </div>

      {/* Seller Info */}
      <div className="px-4 -mt-12 relative z-10">
        <div className="bg-card rounded-xl shadow-elevated p-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold">{seller.business_name}</h1>
              {seller.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {seller.description}
                </p>
              )}
            </div>
            {seller.rating > 0 && (
              <RatingStars
                rating={seller.rating}
                totalReviews={seller.total_reviews}
                size="md"
              />
            )}
          </div>

          <div className="flex flex-wrap gap-3 mt-3 text-sm text-muted-foreground">
            {profile && (
              <span className="flex items-center gap-1">
                <MapPin size={14} />
                Block {profile.block}, {profile.flat_number}
              </span>
            )}
            {seller.availability_start && seller.availability_end && (
              <span className="flex items-center gap-1">
                <Clock size={14} />
                {seller.availability_start.slice(0, 5)} - {seller.availability_end.slice(0, 5)}
              </span>
            )}
          </div>

          {seller.categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {seller.categories.map((cat) => {
                const categoryInfo = CATEGORIES.find((c) => c.value === cat);
                return (
                  <span
                    key={cat}
                    className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground"
                  >
                    {categoryInfo?.icon} {categoryInfo?.label || cat}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Menu */}
      <div className="px-4 mt-6">
        <h2 className="text-lg font-semibold mb-3">Menu</h2>
        
        {categories.length > 2 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-4 -mx-4 px-4">
            {categories.map((cat) => {
              const categoryInfo = CATEGORIES.find((c) => c.value === cat);
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                    activeCategory === cat
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {cat === 'all' ? 'All' : categoryInfo?.label || cat}
                </button>
              );
            })}
          </div>
        )}

        {filteredProducts.length > 0 ? (
          <div className="space-y-0">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No products available</p>
          </div>
        )}
      </div>

      {/* Cart Footer */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-primary safe-bottom">
          <Link to="/cart">
            <div className="flex items-center justify-between text-primary-foreground">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-foreground/20 flex items-center justify-center">
                  <ShoppingCart size={20} />
                </div>
                <div>
                  <p className="font-semibold">{cartCount} items</p>
                  <p className="text-sm opacity-90">₹{cartTotal.toFixed(0)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">View Cart</span>
                <ArrowLeft size={18} className="rotate-180" />
              </div>
            </div>
          </Link>
        </div>
      )}
    </AppLayout>
  );
}
