import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Profile, SellerProfile, Review, VerificationStatus } from '@/types/database';
import { Check, X, Users, Store, Package, Star, MessageSquare, Award, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function AdminPage() {
  const [pendingUsers, setPendingUsers] = useState<Profile[]>([]);
  const [pendingSellers, setPendingSellers] = useState<SellerProfile[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [allSellers, setAllSellers] = useState<SellerProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ users: 0, sellers: 0, orders: 0, reviews: 0 });
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [hideReason, setHideReason] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, sellersRes, reviewsRes, allSellersRes, statsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('verification_status', 'pending'),
        supabase.from('seller_profiles').select('*, profile:profiles(name, block, flat_number)').eq('verification_status', 'pending'),
        supabase.from('reviews').select('*, buyer:profiles!reviews_buyer_id_fkey(name), seller:seller_profiles(business_name)').order('created_at', { ascending: false }).limit(50),
        supabase.from('seller_profiles').select('*, profile:profiles(name, block)').eq('verification_status', 'approved'),
        Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('seller_profiles').select('id', { count: 'exact', head: true }).eq('verification_status', 'approved'),
          supabase.from('orders').select('id', { count: 'exact', head: true }),
          supabase.from('reviews').select('id', { count: 'exact', head: true }),
        ]),
      ]);

      setPendingUsers((usersRes.data as Profile[]) || []);
      setPendingSellers((sellersRes.data as any) || []);
      setReviews((reviewsRes.data as any) || []);
      setAllSellers((allSellersRes.data as any) || []);
      setStats({
        users: statsRes[0].count || 0,
        sellers: statsRes[1].count || 0,
        orders: statsRes[2].count || 0,
        reviews: statsRes[3].count || 0,
      });
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserStatus = async (id: string, status: VerificationStatus) => {
    try {
      await supabase.from('profiles').update({ verification_status: status }).eq('id', id);
      toast.success(`User ${status}`);
      fetchData();
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  const updateSellerStatus = async (id: string, status: VerificationStatus) => {
    try {
      await supabase.from('seller_profiles').update({ verification_status: status }).eq('id', id);
      toast.success(`Seller ${status}`);
      fetchData();
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  const toggleSellerFeatured = async (seller: SellerProfile) => {
    try {
      await supabase.from('seller_profiles').update({ is_featured: !seller.is_featured }).eq('id', seller.id);
      toast.success(seller.is_featured ? 'Removed from featured' : 'Added to featured');
      fetchData();
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  const toggleReviewHidden = async (review: Review, hide: boolean) => {
    try {
      await supabase.from('reviews').update({ 
        is_hidden: hide, 
        hidden_reason: hide ? hideReason : null 
      }).eq('id', review.id);
      toast.success(hide ? 'Review hidden' : 'Review restored');
      setSelectedReview(null);
      setHideReason('');
      fetchData();
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  if (isLoading) {
    return (
      <AppLayout headerTitle="Admin Panel" showLocation={false}>
        <div className="p-4 space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout headerTitle="Admin Panel" showLocation={false}>
      <div className="p-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          <Card><CardContent className="p-2 text-center"><Users className="mx-auto text-primary" size={16} /><p className="text-lg font-bold">{stats.users}</p><p className="text-[9px] text-muted-foreground">Users</p></CardContent></Card>
          <Card><CardContent className="p-2 text-center"><Store className="mx-auto text-success" size={16} /><p className="text-lg font-bold">{stats.sellers}</p><p className="text-[9px] text-muted-foreground">Sellers</p></CardContent></Card>
          <Card><CardContent className="p-2 text-center"><Package className="mx-auto text-warning" size={16} /><p className="text-lg font-bold">{stats.orders}</p><p className="text-[9px] text-muted-foreground">Orders</p></CardContent></Card>
          <Card><CardContent className="p-2 text-center"><Star className="mx-auto text-info" size={16} /><p className="text-lg font-bold">{stats.reviews}</p><p className="text-[9px] text-muted-foreground">Reviews</p></CardContent></Card>
        </div>

        <Tabs defaultValue="users">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="users" className="text-xs">Users</TabsTrigger>
            <TabsTrigger value="sellers" className="text-xs">Sellers</TabsTrigger>
            <TabsTrigger value="featured" className="text-xs">Featured</TabsTrigger>
            <TabsTrigger value="reviews" className="text-xs">Reviews</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-2 mt-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Pending Users ({pendingUsers.length})</h3>
            {pendingUsers.length > 0 ? pendingUsers.map((user) => (
              <Card key={user.id}><CardContent className="p-3 flex items-center justify-between">
                <div><p className="font-medium text-sm">{user.name}</p><p className="text-xs text-muted-foreground">Block {user.block}, {user.flat_number}</p></div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="text-destructive h-8 w-8 p-0" onClick={() => updateUserStatus(user.id, 'rejected')}><X size={14} /></Button>
                  <Button size="sm" className="h-8 w-8 p-0" onClick={() => updateUserStatus(user.id, 'approved')}><Check size={14} /></Button>
                </div>
              </CardContent></Card>
            )) : <p className="text-center text-muted-foreground py-8 text-sm">No pending users</p>}
          </TabsContent>

          <TabsContent value="sellers" className="space-y-2 mt-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Pending Sellers ({pendingSellers.length})</h3>
            {pendingSellers.length > 0 ? pendingSellers.map((seller) => (
              <Card key={seller.id}><CardContent className="p-3 flex items-center justify-between">
                <div><p className="font-medium text-sm">{seller.business_name}</p><p className="text-xs text-muted-foreground">{(seller as any).profile?.name} • Block {(seller as any).profile?.block}</p></div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="text-destructive h-8 w-8 p-0" onClick={() => updateSellerStatus(seller.id, 'rejected')}><X size={14} /></Button>
                  <Button size="sm" className="h-8 w-8 p-0" onClick={() => updateSellerStatus(seller.id, 'approved')}><Check size={14} /></Button>
                </div>
              </CardContent></Card>
            )) : <p className="text-center text-muted-foreground py-8 text-sm">No pending sellers</p>}
          </TabsContent>

          <TabsContent value="featured" className="space-y-2 mt-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Manage Featured Sellers</h3>
            {allSellers.map((seller) => (
              <Card key={seller.id}><CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {seller.is_featured && <Award size={14} className="text-warning" />}
                  <div>
                    <p className="font-medium text-sm">{seller.business_name}</p>
                    <p className="text-xs text-muted-foreground">⭐ {seller.rating.toFixed(1)} • {seller.total_reviews} reviews</p>
                  </div>
                </div>
                <Switch checked={seller.is_featured} onCheckedChange={() => toggleSellerFeatured(seller)} />
              </CardContent></Card>
            ))}
          </TabsContent>

          <TabsContent value="reviews" className="space-y-2 mt-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Review Moderation</h3>
            {reviews.map((review) => (
              <Card key={review.id} className={review.is_hidden ? 'opacity-50' : ''}><CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{(review as any).buyer?.name}</p>
                      <div className="flex">
                        {[1,2,3,4,5].map((s) => (
                          <Star key={s} size={10} className={s <= review.rating ? 'fill-warning text-warning' : 'text-muted-foreground'} />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">for {(review as any).seller?.business_name}</p>
                    {review.comment && <p className="text-sm mt-1 line-clamp-2">{review.comment}</p>}
                    {review.is_hidden && <p className="text-xs text-destructive mt-1">Hidden: {review.hidden_reason}</p>}
                  </div>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-8 w-8 p-0"
                    onClick={() => {
                      if (review.is_hidden) {
                        toggleReviewHidden(review, false);
                      } else {
                        setSelectedReview(review);
                      }
                    }}
                  >
                    {review.is_hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                  </Button>
                </div>
              </CardContent></Card>
            ))}
          </TabsContent>
        </Tabs>

        {/* Hide Review Dialog */}
        <Dialog open={!!selectedReview} onOpenChange={() => setSelectedReview(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Hide Review</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Reason for hiding:</p>
                <Input
                  placeholder="e.g., Inappropriate content"
                  value={hideReason}
                  onChange={(e) => setHideReason(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setSelectedReview(null)}>Cancel</Button>
                <Button className="flex-1" onClick={() => selectedReview && toggleReviewHidden(selectedReview, true)}>Hide Review</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
