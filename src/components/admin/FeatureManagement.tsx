import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Package, Layers, Building2, Trash2, Check, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { logAudit } from '@/lib/audit';
import { friendlyError } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { CreateBuilderSheet } from './CreateBuilderSheet';
import { PackageComparisonMatrix } from './PackageComparisonMatrix';
import { SocietyFeatureAudit } from './SocietyFeatureAudit';

interface PlatformFeature {
  id: string;
  feature_key: string;
  feature_name: string;
  description: string | null;
  category: string;
  is_core: boolean;
  is_experimental: boolean;
  society_configurable: boolean;
}

interface FeaturePackage {
  id: string;
  package_name: string;
  description: string | null;
  price_tier: string;
  items?: { feature_id: string; enabled: boolean }[];
}

interface BuilderAssignment {
  id: string;
  builder_id: string;
  package_id: string;
  assigned_at: string;
  expires_at: string | null;
  builder?: { name: string };
  package?: { package_name: string };
}

const CATEGORIES = ['governance', 'marketplace', 'finance', 'operations', 'construction'];
const TIERS = ['free', 'basic', 'pro', 'enterprise'];

export function FeatureManagement() {
  const { user } = useAuth();
  const [features, setFeatures] = useState<PlatformFeature[]>([]);
  const [packages, setPackages] = useState<FeaturePackage[]>([]);
  const [assignments, setAssignments] = useState<BuilderAssignment[]>([]);
  const [builders, setBuilders] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New feature form
  const [newFeatureOpen, setNewFeatureOpen] = useState(false);
  const [newFeature, setNewFeature] = useState({ feature_key: '', feature_name: '', description: '', category: 'operations', is_core: false, society_configurable: true });

  // New package form
  const [newPkgOpen, setNewPkgOpen] = useState(false);
  const [newPkg, setNewPkg] = useState({ package_name: '', description: '', price_tier: 'free' });

  // Package editor
  const [editingPkg, setEditingPkg] = useState<string | null>(null);
  const [pkgItems, setPkgItems] = useState<Record<string, boolean>>({});

  // Comparison matrix
  const [showComparison, setShowComparison] = useState(false);
  const [allPkgItems, setAllPkgItems] = useState<Record<string, Record<string, boolean>>>({});

  // Assignment form
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignBuilder, setAssignBuilder] = useState('');
  const [assignPackage, setAssignPackage] = useState('');

  useEffect(() => { fetchAll(); }, [user?.id]);

  const fetchAll = async () => {
    const [featRes, pkgRes, assignRes, builderRes] = await Promise.all([
      supabase.from('platform_features').select('*').order('category').order('feature_name'),
      supabase.from('feature_packages').select('*').order('price_tier'),
      supabase.from('builder_feature_packages').select('*, builder:builders(name), package:feature_packages(package_name)').order('assigned_at', { ascending: false }),
      supabase.from('builders').select('id, name').eq('is_active', true),
    ]);
    setFeatures((featRes.data as PlatformFeature[]) || []);
    setPackages((pkgRes.data as FeaturePackage[]) || []);
    setAssignments((assignRes.data as any) || []);
    setBuilders((builderRes.data as any) || []);

    // Load all package items for comparison matrix
    const pkgIds = (pkgRes.data || []).map((p: any) => p.id);
    if (pkgIds.length > 0) {
      const { data: allItems } = await supabase
        .from('feature_package_items')
        .select('package_id, feature_id, enabled')
        .in('package_id', pkgIds);
      const grouped: Record<string, Record<string, boolean>> = {};
      (allItems || []).forEach((item: any) => {
        if (!grouped[item.package_id]) grouped[item.package_id] = {};
        grouped[item.package_id][item.feature_id] = item.enabled;
      });
      setAllPkgItems(grouped);
    }

    setIsLoading(false);
  };

  const createFeature = async () => {
    if (!newFeature.feature_key || !newFeature.feature_name) return;
    const { error } = await supabase.from('platform_features').insert(newFeature);
    if (error) { toast.error(friendlyError(error)); return; }
    await logAudit('feature_created', 'platform_feature', '', null, { feature_key: newFeature.feature_key });
    toast.success('Feature created');
    setNewFeatureOpen(false);
    setNewFeature({ feature_key: '', feature_name: '', description: '', category: 'operations', is_core: false, society_configurable: true });
    fetchAll();
  };

  const toggleFeatureField = async (id: string, field: string, value: boolean) => {
    await supabase.from('platform_features').update({ [field]: value }).eq('id', id);
    await logAudit('feature_updated', 'platform_feature', id, null, { field, value });
    fetchAll();
  };

  const createPackage = async () => {
    if (!newPkg.package_name) return;
    const { error } = await supabase.from('feature_packages').insert(newPkg);
    if (error) { toast.error(friendlyError(error)); return; }
    await logAudit('package_created', 'feature_package', '', null, { name: newPkg.package_name });
    toast.success('Package created');
    setNewPkgOpen(false);
    setNewPkg({ package_name: '', description: '', price_tier: 'free' });
    fetchAll();
  };

  const openPackageEditor = async (pkgId: string) => {
    setEditingPkg(pkgId);
    const { data } = await supabase.from('feature_package_items').select('feature_id, enabled').eq('package_id', pkgId);
    const items: Record<string, boolean> = {};
    (data || []).forEach(d => { items[d.feature_id] = d.enabled; });
    setPkgItems(items);
  };

  const togglePkgItem = async (featureId: string, enabled: boolean) => {
    if (!editingPkg) return;
    setPkgItems(prev => ({ ...prev, [featureId]: enabled }));

    if (enabled) {
      await supabase.from('feature_package_items').upsert({
        package_id: editingPkg,
        feature_id: featureId,
        enabled: true,
      }, { onConflict: 'package_id,feature_id' });
    } else {
      // If unchecking, remove from package
      await supabase.from('feature_package_items').delete().eq('package_id', editingPkg).eq('feature_id', featureId);
      setPkgItems(prev => { const n = { ...prev }; delete n[featureId]; return n; });
    }
    await logAudit('package_modified', 'feature_package', editingPkg, null, { feature_id: featureId, enabled });
  };

  const assignPackageToBuilder = async () => {
    if (!assignBuilder || !assignPackage) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('builder_feature_packages').insert({
      builder_id: assignBuilder,
      package_id: assignPackage,
      assigned_by: user?.id,
    });
    if (error) {
      if (error.code === '23505') toast.error('Already assigned');
      else toast.error(friendlyError(error));
      return;
    }
    await logAudit('package_assigned_to_builder', 'builder_feature_package', assignBuilder, null, { package_id: assignPackage });
    toast.success('Package assigned');
    setAssignOpen(false);
    setAssignBuilder('');
    setAssignPackage('');
    fetchAll();
  };

  const removeAssignment = async (id: string, builderId: string, packageId: string) => {
    await supabase.from('builder_feature_packages').delete().eq('id', id);
    await logAudit('package_removed_from_builder', 'builder_feature_package', builderId, null, { package_id: packageId });
    toast.success('Assignment removed');
    fetchAll();
  };

  if (isLoading) {
    return <div className="space-y-3 p-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  const groupedFeatures = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = features.filter(f => f.category === cat);
    return acc;
  }, {} as Record<string, PlatformFeature[]>);

  return (
    <div className="space-y-4">
      <Tabs defaultValue="features">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="features" className="text-xs gap-1"><Layers size={12} /> Features</TabsTrigger>
          <TabsTrigger value="packages" className="text-xs gap-1"><Package size={12} /> Packages</TabsTrigger>
          <TabsTrigger value="assignments" className="text-xs gap-1"><Building2 size={12} /> Assignments</TabsTrigger>
        </TabsList>

        {/* FEATURES TAB */}
        <TabsContent value="features" className="space-y-3 mt-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-muted-foreground">Platform Features ({features.length})</h3>
            <Sheet open={newFeatureOpen} onOpenChange={setNewFeatureOpen}>
              <SheetTrigger asChild><Button size="sm" variant="outline" className="gap-1"><Plus size={14} /> Add</Button></SheetTrigger>
              <SheetContent>
                <SheetHeader><SheetTitle>New Feature</SheetTitle></SheetHeader>
                <div className="mt-4 space-y-3">
                  <div><Label className="text-xs">Key (snake_case)</Label><Input value={newFeature.feature_key} onChange={e => setNewFeature(p => ({ ...p, feature_key: e.target.value }))} placeholder="my_feature" /></div>
                  <div><Label className="text-xs">Name</Label><Input value={newFeature.feature_name} onChange={e => setNewFeature(p => ({ ...p, feature_name: e.target.value }))} placeholder="My Feature" /></div>
                  <div><Label className="text-xs">Description</Label><Input value={newFeature.description} onChange={e => setNewFeature(p => ({ ...p, description: e.target.value }))} /></div>
                  <div>
                    <Label className="text-xs">Category</Label>
                    <Select value={newFeature.category} onValueChange={v => setNewFeature(p => ({ ...p, category: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between"><Label className="text-xs">Core (can't be disabled)</Label><Switch checked={newFeature.is_core} onCheckedChange={v => setNewFeature(p => ({ ...p, is_core: v }))} /></div>
                  <div className="flex items-center justify-between"><Label className="text-xs">Society Configurable</Label><Switch checked={newFeature.society_configurable} onCheckedChange={v => setNewFeature(p => ({ ...p, society_configurable: v }))} /></div>
                  <Button className="w-full" onClick={createFeature}>Create Feature</Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {CATEGORIES.map(cat => groupedFeatures[cat]?.length > 0 && (
            <div key={cat}>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">{cat}</p>
              <Card><CardContent className="p-3 space-y-3">
                {groupedFeatures[cat].map(f => (
                  <div key={f.id} className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate">{f.feature_name}</p>
                        {f.is_core && <Badge variant="secondary" className="text-[9px] h-4">Core</Badge>}
                        {f.is_experimental && <Badge variant="outline" className="text-[9px] h-4">Beta</Badge>}
                      </div>
                      <p className="text-[10px] text-muted-foreground">{f.feature_key}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={f.society_configurable}
                        onCheckedChange={v => toggleFeatureField(f.id, 'society_configurable', v)}
                        className="scale-75"
                      />
                      <span className="text-[9px] text-muted-foreground w-10">Config</span>
                    </div>
                  </div>
                ))}
              </CardContent></Card>
            </div>
          ))}
        </TabsContent>

        {/* PACKAGES TAB */}
        <TabsContent value="packages" className="space-y-3 mt-3">
           <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-muted-foreground">Feature Packages ({packages.length})</h3>
            <div className="flex gap-2">
              <Button size="sm" variant={showComparison ? 'default' : 'outline'} className="gap-1 text-xs" onClick={() => setShowComparison(v => !v)}>
                <BarChart3 size={12} /> Compare
              </Button>
              <Sheet open={newPkgOpen} onOpenChange={setNewPkgOpen}>
              <SheetTrigger asChild><Button size="sm" variant="outline" className="gap-1"><Plus size={14} /> Create</Button></SheetTrigger>
              <SheetContent>
                <SheetHeader><SheetTitle>New Package</SheetTitle></SheetHeader>
                <div className="mt-4 space-y-3">
                  <div><Label className="text-xs">Name</Label><Input value={newPkg.package_name} onChange={e => setNewPkg(p => ({ ...p, package_name: e.target.value }))} placeholder="Pro Plan" /></div>
                  <div><Label className="text-xs">Description</Label><Input value={newPkg.description} onChange={e => setNewPkg(p => ({ ...p, description: e.target.value }))} /></div>
                  <div>
                    <Label className="text-xs">Price Tier</Label>
                    <Select value={newPkg.price_tier} onValueChange={v => setNewPkg(p => ({ ...p, price_tier: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TIERS.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full" onClick={createPackage}>Create Package</Button>
                </div>
              </SheetContent>
             </Sheet>
            </div>
           </div>

          {showComparison && (
            <PackageComparisonMatrix features={features} packages={packages} packageItems={allPkgItems} />
          )}
          {packages.map(pkg => (
            <Card key={pkg.id}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold">{pkg.package_name}</p>
                    <Badge variant="outline" className="text-[9px] capitalize">{pkg.price_tier}</Badge>
                  </div>
                  <Button size="sm" variant={editingPkg === pkg.id ? 'default' : 'outline'} className="text-xs" onClick={() => editingPkg === pkg.id ? setEditingPkg(null) : openPackageEditor(pkg.id)}>
                    {editingPkg === pkg.id ? 'Done' : 'Edit Features'}
                  </Button>
                </div>
                {pkg.description && <p className="text-xs text-muted-foreground mb-2">{pkg.description}</p>}
                
                {editingPkg === pkg.id && (
                  <div className="border-t pt-2 mt-2 space-y-2 max-h-64 overflow-y-auto">
                    {features.map(f => (
                      <div key={f.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs">{f.feature_name}</span>
                          {f.is_core && <Badge variant="secondary" className="text-[8px] h-3">Core</Badge>}
                        </div>
                        <Switch
                          checked={!!pkgItems[f.id]}
                          onCheckedChange={v => togglePkgItem(f.id, v)}
                          className="scale-75"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {packages.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No packages yet</p>}
        </TabsContent>

        {/* ASSIGNMENTS TAB */}
        <TabsContent value="assignments" className="space-y-3 mt-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-muted-foreground">Builder Assignments ({assignments.length})</h3>
            <div className="flex gap-2">
              <CreateBuilderSheet onCreated={fetchAll} />
              <Sheet open={assignOpen} onOpenChange={setAssignOpen}>
                <SheetTrigger asChild><Button size="sm" variant="outline" className="gap-1"><Plus size={14} /> Assign</Button></SheetTrigger>
                <SheetContent>
                  <SheetHeader><SheetTitle>Assign Package to Builder</SheetTitle></SheetHeader>
                  <div className="mt-4 space-y-3">
                    <div>
                      <Label className="text-xs">Builder</Label>
                      <Select value={assignBuilder} onValueChange={setAssignBuilder}>
                        <SelectTrigger><SelectValue placeholder="Select builder" /></SelectTrigger>
                        <SelectContent>{builders.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Package</Label>
                      <Select value={assignPackage} onValueChange={setAssignPackage}>
                        <SelectTrigger><SelectValue placeholder="Select package" /></SelectTrigger>
                        <SelectContent>{packages.map(p => <SelectItem key={p.id} value={p.id}>{p.package_name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <Button className="w-full" onClick={assignPackageToBuilder} disabled={!assignBuilder || !assignPackage}>
                      <Check size={14} className="mr-1" /> Assign Package
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
          {assignments.map(a => (
            <Card key={a.id}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{(a as any).builder?.name || 'Unknown Builder'}</p>
                    <p className="text-xs text-muted-foreground">{(a as any).package?.package_name || 'Unknown Package'}</p>
                    {a.expires_at && <p className="text-[10px] text-warning">Expires: {new Date(a.expires_at).toLocaleDateString()}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <SocietyFeatureAudit builderId={a.builder_id} builderName={(a as any).builder?.name || 'Builder'} />
                    <Button size="sm" variant="ghost" className="text-destructive h-8 w-8 p-0" onClick={() => removeAssignment(a.id, a.builder_id, a.package_id)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {assignments.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No assignments yet</p>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
