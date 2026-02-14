import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { Profile, SellerProfile, VerificationStatus, SocietyAdmin } from '@/types/database';
import { Check, X, Users, Store, Settings, Shield, UserPlus, Trash2, ToggleLeft, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { logAudit } from '@/lib/audit';
import { SocietySwitcher } from '@/components/admin/SocietySwitcher';
import { useEffectiveFeatures } from '@/hooks/useEffectiveFeatures';
import type { FeatureKey } from '@/hooks/useEffectiveFeatures';

const FEATURE_LABELS: Record<FeatureKey, { label: string; description: string }> = {
  marketplace: { label: 'Marketplace', description: 'Buy & sell within the society' },
  bulletin: { label: 'Community Bulletin', description: 'Announcements, polls, events' },
  disputes: { label: 'Dispute System', description: 'Raise and track concerns' },
  finances: { label: 'Society Finances', description: 'Income & expense tracking' },
  construction_progress: { label: 'Construction Progress', description: 'Builder updates & milestones' },
  snag_management: { label: 'Snag Management', description: 'Report construction defects' },
  help_requests: { label: 'Help Requests', description: 'Community help board' },
  visitor_management: { label: 'Visitor Management', description: 'Gate entry with OTP verification' },
  domestic_help: { label: 'Domestic Help', description: 'Maid/cook/driver attendance tracking' },
  parcel_management: { label: 'Parcel Management', description: 'Delivery logging & collection' },
  inspection: { label: 'Pre-Handover Inspection', description: 'Digital inspection checklist' },
  payment_milestones: { label: 'Payment Milestones', description: 'Construction-linked payment tracker' },
  maintenance: { label: 'Maintenance Dues', description: 'Monthly maintenance payment tracking' },
  guard_kiosk: { label: 'Guard Kiosk', description: 'Gate security OTP verification panel' },
  vehicle_parking: { label: 'Vehicle Parking', description: 'Slot allocation & violation tracking' },
};

export default function SocietyAdminPage() {
  const { profile, effectiveSociety, effectiveSocietyId, isSocietyAdmin, isAdmin } = useAuth();
  const [pendingUsers, setPendingUsers] = useState<Profile[]>([]);
  const [pendingSellers, setPendingSellers] = useState<SellerProfile[]>([]);
  const [societyAdmins, setSocietyAdmins] = useState<(SocietyAdmin & { user?: { name: string } })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [autoApprove, setAutoApprove] = useState(false);
  const [approvalMethod, setApprovalMethod] = useState('manual');
  const [appointOpen, setAppointOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const { features, isFeatureEnabled, getFeatureState, isConfigurable, toggleFeature } = useEffectiveFeatures();

  const societyId = effectiveSocietyId;

  useEffect(() => {
    if (!societyId || (!isSocietyAdmin && !isAdmin)) return;
    fetchData();
  }, [societyId, isSocietyAdmin, isAdmin]);

  useEffect(() => {
    if (effectiveSociety) {
      setAutoApprove(effectiveSociety.auto_approve_residents || false);
      setApprovalMethod(effectiveSociety.approval_method || 'manual');
    }
  }, [effectiveSociety]);

  const fetchData = async () => {
    if (!societyId) return;
    try {
      const [usersRes, sellersRes, adminsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('society_id', societyId).eq('verification_status', 'pending'),
        supabase.from('seller_profiles').select('*, profile:profiles!seller_profiles_user_id_fkey(name, block, flat_number)').eq('society_id', societyId).eq('verification_status', 'pending'),
        supabase.from('society_admins').select('*, user:profiles!society_admins_user_id_fkey(name)').eq('society_id', societyId).is('deactivated_at', null),
      ]);
      setPendingUsers((usersRes.data as Profile[]) || []);
      setPendingSellers((sellersRes.data as any) || []);
      setSocietyAdmins((adminsRes.data as any) || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserStatus = async (id: string, status: VerificationStatus) => {
    if (!societyId) return;
    try {
      await supabase.from('profiles').update({ verification_status: status }).eq('id', id);
      await logAudit(`user_${status}`, 'profile', id, societyId, { status });
      toast.success(`User ${status}`);
      fetchData();
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  const updateSellerStatus = async (id: string, status: VerificationStatus) => {
    if (!societyId) return;
    try {
      const { data: seller } = await supabase.from('seller_profiles').select('user_id').eq('id', id).single();
      if (!seller) throw new Error('Seller not found');
      await supabase.from('seller_profiles').update({ verification_status: status }).eq('id', id);
      if (status === 'approved') {
        await supabase.from('user_roles').insert({ user_id: seller.user_id, role: 'seller' });
      } else if (status === 'rejected' || status === 'suspended') {
        await supabase.from('user_roles').delete().eq('user_id', seller.user_id).eq('role', 'seller');
      }
      await logAudit(`seller_${status}`, 'seller_profile', id, societyId, { status });
      toast.success(`Seller ${status}`);
      fetchData();
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  const updateSocietySettings = async (field: string, value: any) => {
    if (!societyId) return;
    try {
      await supabase.from('societies').update({ [field]: value }).eq('id', societyId);
      await logAudit('settings_changed', 'society', societyId, societyId, { field, value });
      toast.success('Settings updated');
    } catch (error) {
      toast.error('Failed to update settings');
    }
  };

  const searchResidents = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2 || !societyId) { setSearchResults([]); return; }
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('society_id', societyId)
      .eq('verification_status', 'approved')
      .ilike('name', `%${query}%`)
      .limit(10);
    setSearchResults((data as Profile[]) || []);
  };

  const appointAdmin = async (userId: string, role: 'admin' | 'moderator') => {
    if (!societyId || !profile) return;
    try {
      await supabase.from('society_admins').insert({
        society_id: societyId,
        user_id: userId,
        role,
        appointed_by: profile.id,
      });
      await logAudit('admin_appointed', 'society_admin', userId, societyId, { role });
      toast.success('Admin appointed');
      setAppointOpen(false);
      setSearchQuery('');
      setSearchResults([]);
      fetchData();
    } catch (error: any) {
      if (error?.code === '23505') {
        toast.error('This user is already an admin');
      } else if (error?.message?.includes('Maximum number')) {
        toast.error('Maximum admin limit reached for this society');
      } else {
        toast.error('Failed to appoint admin');
      }
    }
  };

  const removeAdmin = async (adminId: string) => {
    if (!societyId) return;
    try {
      await supabase.from('society_admins').update({ deactivated_at: new Date().toISOString() }).eq('id', adminId);
      await logAudit('admin_removed', 'society_admin', adminId, societyId);
      toast.success('Admin removed');
      fetchData();
    } catch (error) {
      toast.error('Failed to remove admin');
    }
  };

  if (!isSocietyAdmin && !isAdmin) {
    return (
      <AppLayout headerTitle="Society Admin" showLocation={false}>
        <div className="p-4 text-center text-muted-foreground py-20">
          <Shield size={48} className="mx-auto mb-4 text-muted-foreground/50" />
          <p className="font-medium">Access Denied</p>
          <p className="text-sm">You need society admin privileges to access this page.</p>
        </div>
      </AppLayout>
    );
  }

  if (isLoading) {
    return (
      <AppLayout headerTitle="Society Admin" showLocation={false}>
        <div className="p-4 space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout headerTitle={`${effectiveSociety?.name || 'Society'} Admin`} showLocation={false}>
      <div className="p-4 space-y-4">
        {/* Society Switcher for admins */}
        {(isAdmin) && <SocietySwitcher />}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="p-3 text-center">
            <Users className="mx-auto text-primary mb-1" size={18} />
            <p className="text-lg font-bold">{pendingUsers.length}</p>
            <p className="text-[10px] text-muted-foreground">Pending Users</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <Store className="mx-auto text-warning mb-1" size={18} />
            <p className="text-lg font-bold">{pendingSellers.length}</p>
            <p className="text-[10px] text-muted-foreground">Pending Sellers</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <Shield className="mx-auto text-info mb-1" size={18} />
            <p className="text-lg font-bold">{societyAdmins.length}</p>
            <p className="text-[10px] text-muted-foreground">Admins</p>
          </CardContent></Card>
        </div>

        <Tabs defaultValue="users">
          <TabsList className="w-full grid grid-cols-5">
            <TabsTrigger value="users" className="text-xs">Users</TabsTrigger>
            <TabsTrigger value="sellers" className="text-xs">Sellers</TabsTrigger>
            <TabsTrigger value="admins" className="text-xs">Admins</TabsTrigger>
            <TabsTrigger value="features" className="text-xs">Features</TabsTrigger>
            <TabsTrigger value="settings" className="text-xs">Settings</TabsTrigger>
          </TabsList>

          {/* Pending Users */}
          <TabsContent value="users" className="space-y-2 mt-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Pending Users ({pendingUsers.length})</h3>
            {pendingUsers.length > 0 ? pendingUsers.map((user) => (
              <Card key={user.id}><CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.phone}</p>
                  <p className="text-xs text-muted-foreground">{user.phase && `${user.phase}, `}Block {user.block}, Flat {user.flat_number}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="text-destructive h-8 w-8 p-0" onClick={() => updateUserStatus(user.id, 'rejected')}><X size={14} /></Button>
                  <Button size="sm" className="h-8 w-8 p-0" onClick={() => updateUserStatus(user.id, 'approved')}><Check size={14} /></Button>
                </div>
              </CardContent></Card>
            )) : <p className="text-center text-muted-foreground py-8 text-sm">No pending users</p>}
          </TabsContent>

          {/* Pending Sellers */}
          <TabsContent value="sellers" className="space-y-2 mt-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Pending Sellers ({pendingSellers.length})</h3>
            {pendingSellers.length > 0 ? pendingSellers.map((seller) => (
              <Card key={seller.id}><CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm">{seller.business_name}</p>
                    <p className="text-xs text-muted-foreground">{(seller as any).profile?.name} • Block {(seller as any).profile?.block}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="text-destructive h-8 w-8 p-0" onClick={() => updateSellerStatus(seller.id, 'rejected')}><X size={14} /></Button>
                    <Button size="sm" className="h-8 w-8 p-0" onClick={() => updateSellerStatus(seller.id, 'approved')}><Check size={14} /></Button>
                  </div>
                </div>
                {seller.description && <p className="text-xs text-muted-foreground">{seller.description}</p>}
                {seller.primary_group && <p className="text-xs"><span className="text-muted-foreground">Category:</span> <span className="font-medium capitalize">{seller.primary_group.replace(/_/g, ' ')}</span></p>}
              </CardContent></Card>
            )) : <p className="text-center text-muted-foreground py-8 text-sm">No pending sellers</p>}
          </TabsContent>

          {/* Society Admins */}
          <TabsContent value="admins" className="space-y-2 mt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-muted-foreground">Society Admins</h3>
              <Sheet open={appointOpen} onOpenChange={setAppointOpen}>
                <SheetTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1">
                    <UserPlus size={14} /> Appoint
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader><SheetTitle>Appoint Society Admin</SheetTitle></SheetHeader>
                  <div className="mt-4 space-y-4">
                    <Input
                      placeholder="Search residents by name..."
                      value={searchQuery}
                      onChange={(e) => searchResidents(e.target.value)}
                    />
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {searchResults.map((resident) => (
                        <Card key={resident.id}>
                          <CardContent className="p-3 flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">{resident.name}</p>
                              <p className="text-xs text-muted-foreground">Block {resident.block}, Flat {resident.flat_number}</p>
                            </div>
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" className="text-xs" onClick={() => appointAdmin(resident.id, 'moderator')}>Moderator</Button>
                              <Button size="sm" className="text-xs" onClick={() => appointAdmin(resident.id, 'admin')}>Admin</Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {searchQuery.length >= 2 && searchResults.length === 0 && (
                        <p className="text-sm text-center text-muted-foreground py-4">No residents found</p>
                      )}
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {societyAdmins.map((admin) => (
              <Card key={admin.id}><CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{(admin as any).user?.name || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground capitalize">{admin.role}</p>
                </div>
                {admin.user_id !== profile?.id && (
                  <Button size="sm" variant="ghost" className="text-destructive h-8 w-8 p-0" onClick={() => removeAdmin(admin.id)}>
                    <Trash2 size={14} />
                  </Button>
                )}
              </CardContent></Card>
            ))}
            {societyAdmins.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No admins appointed yet</p>}
          </TabsContent>

          <TabsContent value="features" className="space-y-2 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <ToggleLeft size={16} className="text-primary" />
              <h3 className="text-sm font-semibold text-muted-foreground">Society Features</h3>
            </div>
            <Card><CardContent className="p-4 space-y-4">
              {(Object.keys(FEATURE_LABELS) as FeatureKey[]).map((key) => {
                const state = getFeatureState(key);
                const configurable = isConfigurable(key);
                const enabled = isFeatureEnabled(key);

                return (
                  <div key={key} className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-sm font-medium">{FEATURE_LABELS[key].label}</Label>
                        {state === 'locked' && (
                          <Badge variant="secondary" className="text-[8px] h-4 gap-0.5">
                            <Lock size={8} /> Locked
                          </Badge>
                        )}
                        {state === 'unavailable' && (
                          <Badge variant="outline" className="text-[8px] h-4 text-muted-foreground">
                            Not in plan
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{FEATURE_LABELS[key].description}</p>
                    </div>
                    <Switch
                      checked={enabled}
                      disabled={!configurable}
                      onCheckedChange={(checked) => toggleFeature.mutate({ key, enabled: checked })}
                    />
                  </div>
                );
              })}
            </CardContent></Card>
          </TabsContent>

          {/* Settings */}
          <TabsContent value="settings" className="space-y-4 mt-4">
            <Card><CardContent className="p-4 space-y-4">
              <h3 className="font-semibold text-sm flex items-center gap-2"><Settings size={16} /> Society Settings</h3>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Auto-approve residents</Label>
                  <p className="text-xs text-muted-foreground">Skip manual approval for new signups</p>
                </div>
                <Switch
                  checked={autoApprove}
                  onCheckedChange={(checked) => {
                    setAutoApprove(checked);
                    updateSocietySettings('auto_approve_residents', checked);
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Approval Method</Label>
                <Select value={approvalMethod} onValueChange={(value) => {
                  setApprovalMethod(value);
                  updateSocietySettings('approval_method', value);
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual (Admin approves each user)</SelectItem>
                    <SelectItem value="invite_code">Invite Code (Users need code to join)</SelectItem>
                    <SelectItem value="auto">Auto (Anyone with GPS match joins)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {effectiveSociety?.invite_code && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">Society Invite Code</p>
                  <p className="font-mono font-bold text-lg">{effectiveSociety.invite_code}</p>
                </div>
              )}
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
