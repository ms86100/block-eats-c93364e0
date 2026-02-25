import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Plus, Edit2, Trash2, Tag, RefreshCw } from 'lucide-react';
import { friendlyError } from '@/lib/utils';
import { motion } from 'framer-motion';

interface Subcategory {
  id: string;
  category_config_id: string;
  slug: string;
  display_name: string;
  display_order: number | null;
  icon: string | null;
  is_active: boolean;
  created_at: string;
}

interface OpenSubcategoryCreateEventDetail {
  categoryConfigId?: string;
}

export function SubcategoryManager() {
  const [allConfigs, setAllConfigs] = useState<Array<{ id: string; display_name: string; icon: string }>>([]);
  const [configsLoading, setConfigsLoading] = useState(true);
  
  const fetchConfigs = useCallback(async () => {
    setConfigsLoading(true);
    const { data } = await supabase
      .from('category_config')
      .select('id, display_name, icon')
      .order('display_order', { ascending: true });
    setAllConfigs(data || []);
    setConfigsLoading(false);
  }, []);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Empty string means "all categories" — never sent as a DB filter
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subcategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Subcategory | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    display_name: '',
    slug: '',
    icon: '',
    display_order: '0',
    is_active: true,
  });
  // Separate state for the parent category in the create dialog
  const [createConfigId, setCreateConfigId] = useState<string>('');

  const fetchSubcategories = useCallback(async () => {
    setIsLoading(true);
    let q = supabase.from('subcategories').select('*').order('display_order', { ascending: true });
    // Only apply filter when a real config id is selected (not empty = all)
    if (selectedConfigId) {
      q = q.eq('category_config_id', selectedConfigId);
    }
    const { data } = await q;
    setSubcategories((data || []) as Subcategory[]);
    setIsLoading(false);
  }, [selectedConfigId]);

  useEffect(() => { fetchSubcategories(); }, [fetchSubcategories]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOpenCreate = (event: Event) => {
      const detail = (event as CustomEvent<OpenSubcategoryCreateEventDetail>).detail;
      const preferredConfigId = detail?.categoryConfigId || selectedConfigId || '';

      setFormData({ display_name: '', slug: '', icon: '', display_order: '0', is_active: true });
      setEditingSub(null);
      setCreateConfigId(preferredConfigId);
      if (preferredConfigId) {
        setSelectedConfigId(preferredConfigId);
      }
      fetchConfigs(); // Refresh categories to pick up any newly created ones
      setIsDialogOpen(true);
    };

    window.addEventListener('admin:open-subcategory-create', handleOpenCreate);
    return () => window.removeEventListener('admin:open-subcategory-create', handleOpenCreate);
  }, [selectedConfigId]);

  const getCategoryName = (configId: string) => {
    const c = allConfigs.find(cfg => cfg.id === configId);
    return c ? `${c.icon} ${c.display_name}` : configId;
  };

  const resetForm = () => {
    setFormData({ display_name: '', slug: '', icon: '', display_order: '0', is_active: true });
    setEditingSub(null);
    setCreateConfigId('');
  };

  const openCreate = (preferredConfigId?: string) => {
    resetForm();
    const nextConfigId = preferredConfigId ?? selectedConfigId ?? '';
    setCreateConfigId(nextConfigId);
    if (nextConfigId) {
      setSelectedConfigId(nextConfigId);
    }
    fetchConfigs(); // Always refresh to pick up newly created categories
    setIsDialogOpen(true);
  };

  const openEdit = (sub: Subcategory) => {
    setEditingSub(sub);
    setFormData({
      display_name: sub.display_name,
      slug: sub.slug,
      icon: sub.icon || '',
      display_order: (sub.display_order ?? 0).toString(),
      is_active: sub.is_active,
    });
    setCreateConfigId(sub.category_config_id);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.display_name.trim() || !formData.slug.trim()) {
      toast.error('Name and slug are required');
      return;
    }
    const configId = editingSub ? editingSub.category_config_id : createConfigId;
    if (!configId) {
      toast.error('Please select a parent category');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        category_config_id: configId,
        display_name: formData.display_name.trim(),
        slug: formData.slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_'),
        icon: formData.icon.trim() || null,
        display_order: parseInt(formData.display_order) || 0,
        is_active: formData.is_active,
      };
      if (editingSub) {
        const { error } = await supabase.from('subcategories').update(payload).eq('id', editingSub.id);
        if (error) throw error;
        toast.success('Subcategory updated');
      } else {
        const { error } = await supabase.from('subcategories').insert(payload);
        if (error) throw error;
        toast.success('Subcategory created');
      }
      setIsDialogOpen(false);
      resetForm();
      fetchSubcategories();
    } catch (err: any) {
      toast.error(friendlyError(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from('subcategories').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success('Subcategory deleted');
      fetchSubcategories();
    } catch (err: any) {
      toast.error(friendlyError(err));
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleFilterChange = (value: string) => {
    // "all" maps to empty string internally
    setSelectedConfigId(value === 'all' ? '' : value);
  };

  return (
    <Card className="border-0 shadow-[var(--shadow-card)] rounded-2xl">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center">
            <Tag size={16} className="text-violet-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Subcategory Management</h3>
            <p className="text-[10px] text-muted-foreground">Manage subcategories within each category</p>
          </div>
        </div>

        {/* Filter by category */}
        <div className="flex items-center gap-2">
          <Select value={selectedConfigId || 'all'} onValueChange={handleFilterChange}>
            <SelectTrigger className="flex-1 rounded-xl">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {allConfigs.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.icon} {c.display_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-xl" onClick={() => fetchConfigs()} disabled={configsLoading} title="Refresh categories">
            <RefreshCw size={14} className={configsLoading ? 'animate-spin' : ''} />
          </Button>
          <Button size="sm" onClick={() => openCreate()} className="rounded-xl font-semibold gap-1.5">
            <Plus size={13} /> Add Subcategory
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-muted-foreground" /></div>
        ) : subcategories.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-12 h-12 rounded-2xl bg-muted mx-auto mb-3 flex items-center justify-center">
              <Tag size={20} className="text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">No subcategories yet</p>
            <p className="text-xs text-muted-foreground mt-0.5">Add one to help buyers filter within categories.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {subcategories.map((sub, idx) => (
              <motion.div key={sub.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }}>
                <div className="flex items-center gap-3 p-3 bg-card border border-border/30 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 group">
                  <span className="text-lg">{sub.icon || '📂'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{sub.display_name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {getCategoryName(sub.category_config_id)} · <span className="font-mono">{sub.slug}</span>
                    </p>
                  </div>
                  {!sub.is_active && (
                    <Badge variant="secondary" className="text-[10px] rounded-md">Inactive</Badge>
                  )}
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-xl" onClick={() => openEdit(sub)}>
                    <Edit2 size={13} />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-xl text-destructive" onClick={() => setDeleteTarget(sub)}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={(o) => { if (!o) resetForm(); setIsDialogOpen(o); }}>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle className="font-bold">{editingSub ? 'Edit Subcategory' : 'Add Subcategory'}</DialogTitle>
              <DialogDescription className="text-xs">
                {editingSub ? 'Update this subcategory.' : 'Create a new subcategory under a parent category.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {!editingSub && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Parent Category *</Label>
                  <Select value={createConfigId} onValueChange={setCreateConfigId}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {allConfigs.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.icon} {c.display_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Display Name *</Label>
                <Input
                  placeholder="e.g. Dairy Products"
                  value={formData.display_name}
                  onChange={e => {
                    const name = e.target.value;
                    setFormData({
                      ...formData,
                      display_name: name,
                      slug: editingSub ? formData.slug : name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
                    });
                  }}
                  className="rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Slug</Label>
                  <Input value={formData.slug} onChange={e => setFormData({ ...formData, slug: e.target.value })} className="rounded-xl font-mono text-xs" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Icon (emoji)</Label>
                  <Input placeholder="🥛" value={formData.icon} onChange={e => setFormData({ ...formData, icon: e.target.value })} className="rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Display Order</Label>
                  <Input type="number" value={formData.display_order} onChange={e => setFormData({ ...formData, display_order: e.target.value })} className="rounded-xl" />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch checked={formData.is_active} onCheckedChange={c => setFormData({ ...formData, is_active: c })} />
                  <Label className="text-xs font-medium">Active</Label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl">Cancel</Button>
              <Button onClick={handleSave} disabled={isSaving} className="rounded-xl font-semibold">
                {isSaving && <Loader2 className="animate-spin mr-1" size={14} />}
                {editingSub ? 'Save' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-bold">Delete "{deleteTarget?.display_name}"?</AlertDialogTitle>
              <AlertDialogDescription>Products using this subcategory will lose their subcategory assignment.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground rounded-xl">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
