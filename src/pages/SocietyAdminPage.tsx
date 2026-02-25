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
import { SocietySwitcher } from '@/components/admin/SocietySwitcher';
import { SecurityStaffManager } from '@/components/admin/SecurityStaffManager';
import { SecurityModeSettings } from '@/components/admin/SecurityModeSettings';
import { CommitteeDashboard } from '@/components/admin/CommitteeDashboard';
import { AdminDisputesTab } from '@/components/admin/AdminDisputesTab';
import { AdminPaymentMilestones } from '@/components/admin/AdminPaymentMilestones';
import { useSocietyAdmin } from '@/hooks/useSocietyAdmin';
import { Check, X, Users, Store, Settings, Shield, UserPlus, Trash2, ToggleLeft, Lock, IndianRupee } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { FeatureKey } from '@/hooks/useEffectiveFeatures';

function StatCard({ icon: Icon, value, label, color }: { icon: any; value: string | number; label: string; color: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-3.5 flex items-center gap-3">
          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', color)}>
            <Icon size={16} className="text-white" />
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums leading-tight">{value}</p>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function SocietyAdminPage() {
  const sa = useSocietyAdmin();

  if (!sa.isSocietyAdmin && !sa.isAdmin) {
    return (
      <AppLayout headerTitle="Society Admin" showLocation={false}>
        <div className="p-4 text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-muted mx-auto mb-4 flex items-center justify-center">
            <Shield size={28} className="text-muted-foreground/50" />
          </div>
          <p className="font-semibold text-foreground">Access Denied</p>
          <p className="text-sm text-muted-foreground mt-1">You need society admin privileges.</p>
        </div>
      </AppLayout>
    );
  }

  if (sa.isLoading) return (
    <AppLayout headerTitle="Society Admin" showLocation={false}>
      <div className="p-4 space-y-4">
        <Skeleton className="h-12 w-48" />
        <div className="grid grid-cols-3 gap-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
      </div>
    </AppLayout>
  );

  return (
    <AppLayout headerTitle={`${sa.effectiveSociety?.name || 'Society'} Admin`} showLocation={false}>
      <div className="pb-8">
        <div className="px-4 pt-4 pb-3">
          {sa.isAdmin && <SocietySwitcher />}
        </div>

        {/* Stats */}
        <div className="px-4 mb-5">
          <div className="grid grid-cols-3 gap-2.5">
            <StatCard icon={Users} value={sa.pendingUsers.length} label="Pending Users" color="bg-blue-500" />
            <StatCard icon={Store} value={sa.pendingSellers.length} label="Pending Sellers" color="bg-amber-500" />
            <StatCard icon={Shield} value={sa.societyAdmins.length} label="Admins" color="bg-violet-500" />
          </div>
        </div>

        <div className="px-4">
          <Tabs defaultValue="overview">
            <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
              <TabsList className="inline-flex w-auto gap-1 bg-muted/50 p-1 rounded-xl">
                {['Overview', 'Users', 'Sellers', 'Disputes', 'More'].map(tab => (
                  <TabsTrigger key={tab} value={tab.toLowerCase()} className="text-xs px-3.5 py-1.5 rounded-lg whitespace-nowrap data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
                    {tab}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <TabsContent value="overview" className="mt-4">
              {sa.societyId && <CommitteeDashboard societyId={sa.societyId} />}
            </TabsContent>

            <TabsContent value="users" className="space-y-2.5 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users size={14} className="text-primary" />
                </div>
                <h3 className="text-sm font-semibold">Pending Users <span className="text-muted-foreground font-normal">({sa.pendingUsers.length})</span></h3>
              </div>
              {sa.pendingUsers.length > 0 ? sa.pendingUsers.map(user => (
                <Card key={user.id} className="border-0 shadow-sm">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users size={16} className="text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.phone}</p>
                        <p className="text-[11px] text-muted-foreground">{user.phase && `${user.phase}, `}Block {user.block}, Flat {user.flat_number}</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" className="text-destructive h-9 w-9 p-0 rounded-xl" onClick={() => sa.updateUserStatus(user.id, 'rejected')}><X size={15} /></Button>
                      <Button size="sm" className="h-9 w-9 p-0 rounded-xl" onClick={() => sa.updateUserStatus(user.id, 'approved')}><Check size={15} /></Button>
                    </div>
                  </CardContent>
                </Card>
              )) : (
                <div className="text-center py-12 text-sm text-muted-foreground">No pending users</div>
              )}
            </TabsContent>

            <TabsContent value="sellers" className="space-y-2.5 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Store size={14} className="text-amber-600" />
                </div>
                <h3 className="text-sm font-semibold">Pending Sellers <span className="text-muted-foreground font-normal">({sa.pendingSellers.length})</span></h3>
              </div>
              {sa.pendingSellers.length > 0 ? sa.pendingSellers.map(seller => (
                <Card key={seller.id} className="border-0 shadow-sm">
                  <CardContent className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-sm">{seller.business_name}</p>
                        <p className="text-xs text-muted-foreground">{(seller as any).profile?.name} • Block {(seller as any).profile?.block}</p>
                      </div>
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" className="text-destructive h-9 w-9 p-0 rounded-xl" onClick={() => sa.updateSellerStatus(seller.id, 'rejected')}><X size={15} /></Button>
                        <Button size="sm" className="h-9 w-9 p-0 rounded-xl" onClick={() => sa.updateSellerStatus(seller.id, 'approved')}><Check size={15} /></Button>
                      </div>
                    </div>
                    {seller.description && <p className="text-xs text-muted-foreground">{seller.description}</p>}
                    {seller.primary_group && <Badge variant="secondary" className="text-[10px] capitalize">{seller.primary_group.replace(/_/g, ' ')}</Badge>}
                  </CardContent>
                </Card>
              )) : (
                <div className="text-center py-12 text-sm text-muted-foreground">No pending sellers</div>
              )}
            </TabsContent>

            <TabsContent value="disputes" className="mt-4"><AdminDisputesTab /></TabsContent>

            <TabsContent value="more" className="mt-4 space-y-6">
              {/* Admins */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center">
                    <Shield size={14} className="text-violet-600" />
                  </div>
                  <h3 className="text-sm font-semibold">Admins <span className="text-muted-foreground font-normal">({sa.societyAdmins.length})</span></h3>
                </div>
                <div className="space-y-2">
                  {sa.societyAdmins.map(admin_user => (
                    <Card key={admin_user.id} className="border-0 shadow-sm">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm">{(admin_user as any).user?.name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground capitalize">{admin_user.role}</p>
                        </div>
                        {admin_user.user_id !== sa.profile?.id && (
                          <Button size="sm" variant="ghost" className="text-destructive h-9 w-9 p-0 rounded-xl" onClick={() => sa.removeAdmin(admin_user.id)}>
                            <Trash2 size={15} />
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <Sheet open={sa.appointOpen} onOpenChange={sa.setAppointOpen}>
                  <SheetTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1.5 mt-3 rounded-xl">
                      <UserPlus size={14} /> Appoint Admin
                    </Button>
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader><SheetTitle>Appoint Society Admin</SheetTitle></SheetHeader>
                    <div className="mt-4 space-y-4">
                      <Input placeholder="Search residents by name..." value={sa.searchQuery} onChange={e => sa.searchResidents(e.target.value)} className="rounded-xl" />
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {sa.searchResults.map(resident => (
                          <Card key={resident.id} className="border-0 shadow-sm">
                            <CardContent className="p-3 flex items-center justify-between">
                              <div>
                                <p className="font-semibold text-sm">{resident.name}</p>
                                <p className="text-xs text-muted-foreground">Block {resident.block}, Flat {resident.flat_number}</p>
                              </div>
                              <div className="flex gap-1">
                                <Button size="sm" variant="outline" className="text-xs rounded-lg" onClick={() => sa.appointAdmin(resident.id, 'moderator')}>Mod</Button>
                                <Button size="sm" className="text-xs rounded-lg" onClick={() => sa.appointAdmin(resident.id, 'admin')}>Admin</Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>

              {/* Payment Milestones */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <IndianRupee size={14} className="text-emerald-600" />
                  </div>
                  <h3 className="text-sm font-semibold">Payment Milestones</h3>
                </div>
                <AdminPaymentMilestones />
              </div>

              {/* Security */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-rose-500/10 flex items-center justify-center">
                    <Shield size={14} className="text-rose-600" />
                  </div>
                  <h3 className="text-sm font-semibold">Security</h3>
                </div>
                <SecurityModeSettings />
                <div className="mt-3"><SecurityStaffManager /></div>
              </div>

              {/* Features */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <ToggleLeft size={14} className="text-blue-600" />
                  </div>
                  <h3 className="text-sm font-semibold">Society Features</h3>
                </div>
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4 space-y-4">
                    {sa.features.map(f => {
                      const key = f.feature_key as FeatureKey;
                      const state = sa.getFeatureState(key);
                      const configurable = sa.isConfigurable(key);
                      const enabled = sa.isFeatureEnabled(key);
                      return (
                        <div key={key} className="flex items-center justify-between py-1">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <Label className="text-sm font-medium">{sa.getFeatureDisplayName(key)}</Label>
                              {state === 'locked' && <Badge variant="secondary" className="text-[8px] h-4 gap-0.5"><Lock size={8} /> Locked</Badge>}
                              {state === 'unavailable' && <Badge variant="outline" className="text-[8px] h-4 text-muted-foreground">Not in plan</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground">{sa.getFeatureDescription(key)}</p>
                          </div>
                          <Switch checked={enabled} disabled={!configurable} onCheckedChange={checked => sa.toggleFeature.mutate({ key, enabled: checked })} />
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>

              {/* Settings */}
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Settings size={16} className="text-muted-foreground" />
                    <h3 className="font-semibold text-sm">Society Settings</h3>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <div>
                      <Label className="text-sm font-medium">Auto-approve residents</Label>
                      <p className="text-xs text-muted-foreground">Skip manual approval</p>
                    </div>
                    <Switch checked={sa.autoApprove} onCheckedChange={checked => { sa.setAutoApprove(checked); sa.updateSocietySettings('auto_approve_residents', checked); }} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Approval Method</Label>
                    <Select value={sa.approvalMethod} onValueChange={value => { sa.setApprovalMethod(value); sa.updateSocietySettings('approval_method', value); }}>
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="invite_code">Invite Code</SelectItem>
                        <SelectItem value="auto">Auto (GPS match)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {sa.effectiveSociety?.invite_code && (
                    <div className="p-3.5 bg-muted/50 rounded-xl">
                      <p className="text-xs text-muted-foreground mb-1">Society Invite Code</p>
                      <p className="font-mono font-bold text-lg tracking-widest tabular-nums">{sa.effectiveSociety.invite_code}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}
