import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProductCard } from '@/components/product/ProductCard';

import { RatingStars } from '@/components/ui/rating-stars';
import { ReviewList } from '@/components/review/ReviewList';
import { FavoriteButton } from '@/components/favorite/FavoriteButton';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/contexts/AuthContext';
import { SellerProfile, Product, DAYS_OF_WEEK } from '@/types/database';
import { useCategoryConfigs } from '@/hooks/useCategoryBehavior';
import { ArrowLeft, Clock, MapPin, Phone, Search, ShoppingCart, Star, Calendar, Flag, X, Zap, Users, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function SellerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, effectiveSocietyId } = useAuth();
  const { configs: allCategoryConfigs } = useCategoryConfigs();
  const { items, totalAmount } = useCart();
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('menu');
  const [menuSearch, setMenuSearch] = useState('');
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportType, setReportType] = useState<string>('');
  const [reportDescription, setReportDescription] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

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
            profile:profiles!seller_profiles_user_id_fkey(name, block, flat_number, phone),
            society:societies!seller_profiles_society_id_fkey(name, address, city, state, pincode, latitude, longitude)
          `)
          .eq('id', id)
          .single(),
        supabase
          .from('products')
          .select('*')
          .eq('seller_id', id)
          .eq('is_available', true)
          .eq('approval_status', 'approved')
          .order('is_bestseller', { ascending: false })
          .order('is_recommended', { ascending: false })
          .order('category'),
      ]);

      if (sellerRes.error) throw sellerRes.error;
      if (productsRes.error) throw productsRes.error;

      const sellerData = sellerRes.data as any;

      // Don't show non-approved sellers
      if (sellerData.verification_status !== 'approved') {
        setSeller(null);
        return;
      }

      // Society scoping: allow same-society or cross-society based on seller's sell_beyond flag
      if (effectiveSocietyId && sellerData.society_id && sellerData.society_id !== effectiveSocietyId && !sellerData.sell_beyond_community) {
        setSeller(null);
        return;
      }

      setSeller(sellerData);
      setProducts((productsRes.data || []) as Product[]);

      // Calculate distance from buyer's society to seller's society
      if (effectiveSocietyId && sellerData.society?.latitude && sellerData.society?.longitude) {
        try {
          const { data: buyerSociety } = await supabase
            .from('societies')
            .select('latitude, longitude')
            .eq('id', effectiveSocietyId)
            .single();

          if (buyerSociety?.latitude && buyerSociety?.longitude) {
            const toRad = (deg: number) => (deg * Math.PI) / 180;
            const R = 6371;
            const dLat = toRad(sellerData.society.latitude - buyerSociety.latitude);
            const dLon = toRad(sellerData.society.longitude - buyerSociety.longitude);
            const a =
              Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(buyerSociety.latitude)) *
                Math.cos(toRad(sellerData.society.latitude)) *
                Math.sin(dLon / 2) ** 2;
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            setDistanceKm(Math.round(R * c * 10) / 10);
          }
        } catch (e) {
          console.error('Distance calc error:', e);
        }
      }
    } catch (error) {
      console.error('Error fetching seller:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProducts = (() => {
    let result = activeCategory === 'all' ? products : products.filter((p) => p.category === activeCategory);
    if (menuSearch.trim()) {
      const q = menuSearch.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
    }
    return result;
  })();

  const categories = ['all', ...new Set(products.map((p) => p.category))];

  const cartItemsFromSeller = items.filter(
    (item) => item.product?.seller_id === id
  );
  const cartTotal = cartItemsFromSeller.reduce(
    (sum, item) => sum + (item.product?.price || 0) * item.quantity,
    0
  );
  const cartCount = cartItemsFromSeller.reduce((sum, item) => sum + item.quantity, 0);

  const handleSubmitReport = async () => {
    if (!user || !reportType) {
      toast.error('Please select a report type');
      return;
    }

    setIsSubmittingReport(true);
    try {
      const { error } = await supabase.from('reports').insert({
        reporter_id: user.id,
        reported_seller_id: id,
        report_type: reportType,
        description: reportDescription || null,
      });

      if (error) throw error;

      toast.success('Report submitted. Our team will review it shortly.');
      setIsReportOpen(false);
      setReportType('');
      setReportDescription('');
    } catch (error) {
      console.error('Error submitting report:', error);
      toast.error('Failed to submit report');
    } finally {
      setIsSubmittingReport(false);
    }
  };

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
  const operatingDays = seller.operating_days || DAYS_OF_WEEK;

  return (
    <AppLayout showHeader={false} showNav={cartCount === 0}>
      {/* Cover Image */}
      <div className="relative h-56">
        {seller.cover_image_url ? (
          <img
            src={seller.cover_image_url}
            alt={seller.business_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        
        <div className="absolute top-4 left-4 right-4 flex justify-between safe-top">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center shadow-md border border-white/20"
          >
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div className="flex gap-2">
            {user && (
              <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
                <DialogTrigger asChild>
                   <button className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center shadow-md border border-white/20">
                     <Flag size={18} className="text-white" />
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Report Seller</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">What's the issue?</p>
                      <Select value={reportType} onValueChange={setReportType}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a reason" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="spam">Spam or misleading</SelectItem>
                          <SelectItem value="fraud">Suspected fraud</SelectItem>
                          <SelectItem value="harassment">Harassment</SelectItem>
                          <SelectItem value="inappropriate">Inappropriate content</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Additional details (optional)</p>
                      <Textarea
                        placeholder="Describe the issue..."
                        value={reportDescription}
                        onChange={(e) => setReportDescription(e.target.value)}
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => setIsReportOpen(false)}>
                        Cancel
                      </Button>
                      <Button 
                        className="flex-1" 
                        disabled={!reportType || isSubmittingReport}
                        onClick={handleSubmitReport}
                      >
                        {isSubmittingReport ? 'Submitting...' : 'Submit Report'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            <FavoriteButton sellerId={seller.id} size="md" />
          </div>
        </div>

      </div>

      {/* Seller Info */}
      <div className="px-4 -mt-8 relative z-10">
        <div className="bg-card rounded-xl shadow-elevated p-4 space-y-3">
          {/* Row 1: Avatar + Name + Rating */}
          <div className="flex items-start gap-3">
            {seller.profile_image_url && (
              <div className="w-14 h-14 rounded-full border-2 border-primary/30 overflow-hidden shadow-md shrink-0">
                <img
                  src={seller.profile_image_url}
                  alt={seller.business_name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h1 className="text-xl font-bold">{seller.business_name}</h1>
                  {seller.description && (
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                      {seller.description}
                    </p>
                  )}
                </div>
                <RatingStars
                  rating={seller.rating}
                  totalReviews={seller.total_reviews}
                  size="md"
                />
              </div>
            </div>
          </div>

          {/* Row 2: Location · Distance · Hours — compact info line */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            {(seller as any).society && (
              <span className="flex items-center gap-1">
                <MapPin size={13} className="text-primary shrink-0" />
                {(seller as any).society.name}
              </span>
            )}
            {distanceKm !== null && distanceKm > 0 && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-xs font-medium text-primary">📍 {distanceKm} km</span>
              </>
            )}
            {seller.availability_start && seller.availability_end && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="flex items-center gap-1">
                  <Clock size={13} className="shrink-0" />
                  {seller.availability_start.slice(0, 5)} – {seller.availability_end.slice(0, 5)}
                </span>
              </>
            )}
          </div>

          {/* Row 3: Status badges — Active + Fulfillment + Min order */}
          <div className="flex items-center gap-2 flex-wrap">
            {(seller as any).last_active_at && (Date.now() - new Date((seller as any).last_active_at).getTime()) < 24 * 60 * 60 * 1000 && (
              <Badge variant="secondary" className="text-[10px] bg-success/15 text-success border-0 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse mr-1" />
                Active today
              </Badge>
            )}
            {(seller as any).fulfillment_mode && (
              <Badge variant="outline" className="text-[10px] font-medium">
                {(seller as any).fulfillment_mode === 'self_pickup' && '🏪 Self Pickup'}
                {(seller as any).fulfillment_mode === 'delivery' && '🚚 Delivery'}
                {(seller as any).fulfillment_mode === 'both' && '🏪🚚 Pickup & Delivery'}
              </Badge>
            )}
            {(seller as any).minimum_order_amount != null && (seller as any).minimum_order_amount > 0 && (
              <Badge variant="outline" className="text-[10px] font-medium">
                Min ₹{(seller as any).minimum_order_amount}
              </Badge>
            )}
            {(seller as any).delivery_note && (
              <span className="text-[11px] text-muted-foreground italic">{(seller as any).delivery_note}</span>
            )}
          </div>

          {/* Row 4: Trust signals */}
          {((seller as any).completed_order_count > 0 || ((seller as any).avg_response_minutes != null && (seller as any).avg_response_minutes > 0)) && (
            <div className="flex items-center gap-2 flex-wrap">
              {(seller as any).completed_order_count > 0 && (
                <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-0">
                  <Users size={10} className="mr-1" />
                  {(seller as any).completed_order_count} orders
                </Badge>
              )}
              {(seller as any).avg_response_minutes != null && (seller as any).avg_response_minutes > 0 && (
                <Badge variant="secondary" className="text-[10px] bg-success/10 text-success border-0">
                  <Zap size={10} className="mr-1" />
                  ~{(seller as any).avg_response_minutes} min response
                </Badge>
              )}
              {(seller as any).cancellation_rate !== undefined && (seller as any).cancellation_rate === 0 && (seller as any).completed_order_count > 2 && (
                <Badge variant="secondary" className="text-[10px] bg-success/10 text-success border-0">
                  <ShieldCheck size={10} className="mr-1" />
                  0% cancellation
                </Badge>
              )}
            </div>
          )}

          {/* Row 5: Operating days */}
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-muted-foreground shrink-0" />
            <div className="flex gap-1">
              {DAYS_OF_WEEK.map((day) => (
                <span
                  key={day}
                  className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    operatingDays.includes(day)
                      ? 'bg-success/20 text-success'
                      : 'bg-muted text-muted-foreground/50'
                  }`}
                >
                  {day}
                </span>
              ))}
            </div>
          </div>

          {/* Row 6: Category tags */}
          {seller.categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {seller.categories.map((cat) => {
                const categoryInfo = allCategoryConfigs.find((c) => c.category === cat);
                return (
                  <span
                    key={cat}
                    className="text-xs px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground font-medium"
                  >
                    {categoryInfo?.icon} {categoryInfo?.displayName || cat}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 mt-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="menu" className="flex-1">Menu</TabsTrigger>
            <TabsTrigger value="reviews" className="flex-1">
              Reviews ({seller.total_reviews})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="menu" className="mt-4">
            {/* Search within menu */}
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={`Search in ${seller.business_name}…`}
                value={menuSearch}
                onChange={(e) => setMenuSearch(e.target.value)}
                className="pl-8 pr-8 h-9 bg-muted border-0 rounded-lg text-sm"
              />
              {menuSearch && (
                <button onClick={() => setMenuSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <X size={14} />
                </button>
              )}
            </div>
            {categories.length > 2 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-4 -mx-4 px-4">
                {categories.map((cat) => {
                  const categoryInfo = allCategoryConfigs.find((c) => c.category === cat);
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
                      {cat === 'all' ? 'All' : categoryInfo?.displayName || cat}
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
          </TabsContent>

          <TabsContent value="reviews" className="mt-4">
            <ReviewList sellerId={seller.id} />
          </TabsContent>
        </Tabs>
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
