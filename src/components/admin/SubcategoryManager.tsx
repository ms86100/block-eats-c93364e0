import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Plus, Edit2, Trash2, Tag } from 'lucide-react';
import { useCategoryConfigs } from '@/hooks/useCategoryBehavior';
import { friendlyError } from '@/lib/utils';

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

export function SubcategoryManager() {
  const { configs } = useCategoryConfigs();
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  const fetchSubcategories = useCallback(async () => {
    setIsLoading(true);
    const q = supabase.from('subcategories').select('*').order('display_order', { ascending: true });
    if (selectedConfigId) {
      q.eq('category_config_id', selectedConfigId);
    }
    const { data } = await q;
    setSubcategories((data || []) as Subcategory[]);
    setIsLoading(false);
  }, [selectedConfigId]);

  useEffect(() => { fetchSubcategories(); }, [fetchSubcategories]);

  const getCategoryName = (configId: string) => {
    const c = configs.find(cfg => cfg.id === configId);
    return c ? `${c.icon} ${c.displayName}` : configId;
  };

  const resetForm = () => {
    setFormData({ display_name: '', slug: '', icon: '', display_order: '0', is_active: true });
    setEditingSub(null);
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
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.display_name.trim() || !formData.slug.trim()) {
      toast.error('Name and slug are required');
      return;
    }
    const configId = editingSub ? editingSub.category_config_id : selectedConfigId;
    if (!configId) {
      toast.error('Please select a category first');
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Tag size={18} />
          Subcategory Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filter by category */}
        <div className="flex items-center gap-3">
          <Select value={selectedConfigId} onValueChange={setSelectedConfigId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {configs.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.icon} {c.displayName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => { resetForm(); setIsDialogOpen(true); }}>
            <Plus size={14} className="mr-1" /> Add
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
        ) : subcategories.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No subcategories yet. Add one to help buyers filter within categories.
          </p>
        ) : (
          <div className="space-y-2">
            {subcategories.map(sub => (
              <div key={sub.id} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <span className="text-lg">{sub.icon || '📂'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{sub.display_name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {getCategoryName(sub.category_config_id)} · {sub.slug}
                  </p>
                </div>
                {!sub.is_active && (
                  <span className="text-[10px] text-muted-foreground bg-muted-foreground/10 px-1.5 py-0.5 rounded">Inactive</span>
                )}
                <Button variant="ghost" size="sm" onClick={() => openEdit(sub)}>
                  <Edit2 size={14} />
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteTarget(sub)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={(o) => { if (!o) resetForm(); setIsDialogOpen(o); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingSub ? 'Edit Subcategory' : 'Add Subcategory'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {!editingSub && (
                <div className="space-y-2">
                  <Label>Parent Category *</Label>
                  <Select value={selectedConfigId} onValueChange={setSelectedConfigId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {configs.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.icon} {c.displayName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Display Name *</Label>
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
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input value={formData.slug} onChange={e => setFormData({ ...formData, slug: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Icon (emoji)</Label>
                  <Input placeholder="🥛" value={formData.icon} onChange={e => setFormData({ ...formData, icon: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Display Order</Label>
                  <Input type="number" value={formData.display_order} onChange={e => setFormData({ ...formData, display_order: e.target.value })} />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch checked={formData.is_active} onCheckedChange={c => setFormData({ ...formData, is_active: c })} />
                  <Label>Active</Label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="animate-spin mr-1" size={14} />}
                {editingSub ? 'Save' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{deleteTarget?.display_name}"?</AlertDialogTitle>
              <AlertDialogDescription>Products using this subcategory will lose their subcategory assignment.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
