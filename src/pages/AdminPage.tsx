import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Profile, SellerProfile, VerificationStatus } from '@/types/database';
import { Check, X, Users, Store, Package } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminPage() {
  const [pendingUsers, setPendingUsers] = useState<Profile[]>([]);
  const [pendingSellers, setPendingSellers] = useState<SellerProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ users: 0, sellers: 0, orders: 0 });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, sellersRes, statsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('verification_status', 'pending'),
        supabase.from('seller_profiles').select('*, profile:profiles(name, block, flat_number)').eq('verification_status', 'pending'),
        Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('seller_profiles').select('id', { count: 'exact', head: true }).eq('verification_status', 'approved'),
          supabase.from('orders').select('id', { count: 'exact', head: true }),
        ]),
      ]);

      setPendingUsers((usersRes.data as Profile[]) || []);
      setPendingSellers((sellersRes.data as any) || []);
      setStats({
        users: statsRes[0].count || 0,
        sellers: statsRes[1].count || 0,
        orders: statsRes[2].count || 0,
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
        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="p-3 text-center"><Users className="mx-auto text-primary" size={20} /><p className="text-xl font-bold">{stats.users}</p><p className="text-[10px] text-muted-foreground">Users</p></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><Store className="mx-auto text-success" size={20} /><p className="text-xl font-bold">{stats.sellers}</p><p className="text-[10px] text-muted-foreground">Sellers</p></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><Package className="mx-auto text-warning" size={20} /><p className="text-xl font-bold">{stats.orders}</p><p className="text-[10px] text-muted-foreground">Orders</p></CardContent></Card>
        </div>

        <Tabs defaultValue="users">
          <TabsList className="w-full"><TabsTrigger value="users" className="flex-1">Pending Users ({pendingUsers.length})</TabsTrigger><TabsTrigger value="sellers" className="flex-1">Pending Sellers ({pendingSellers.length})</TabsTrigger></TabsList>
          <TabsContent value="users" className="space-y-2 mt-4">
            {pendingUsers.length > 0 ? pendingUsers.map((user) => (
              <Card key={user.id}><CardContent className="p-3 flex items-center justify-between">
                <div><p className="font-medium">{user.name}</p><p className="text-xs text-muted-foreground">Block {user.block}, {user.flat_number}</p></div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => updateUserStatus(user.id, 'rejected')}><X size={16} /></Button>
                  <Button size="sm" onClick={() => updateUserStatus(user.id, 'approved')}><Check size={16} /></Button>
                </div>
              </CardContent></Card>
            )) : <p className="text-center text-muted-foreground py-8">No pending users</p>}
          </TabsContent>
          <TabsContent value="sellers" className="space-y-2 mt-4">
            {pendingSellers.length > 0 ? pendingSellers.map((seller) => (
              <Card key={seller.id}><CardContent className="p-3 flex items-center justify-between">
                <div><p className="font-medium">{seller.business_name}</p><p className="text-xs text-muted-foreground">{(seller as any).profile?.name} • Block {(seller as any).profile?.block}</p></div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => updateSellerStatus(seller.id, 'rejected')}><X size={16} /></Button>
                  <Button size="sm" onClick={() => updateSellerStatus(seller.id, 'approved')}><Check size={16} /></Button>
                </div>
              </CardContent></Card>
            )) : <p className="text-center text-muted-foreground py-8">No pending sellers</p>}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
