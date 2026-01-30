import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Grid3X3, GripVertical, Edit2, Save, X } from 'lucide-react';
import { PARENT_GROUPS, ParentGroup } from '@/types/categories';
import { cn } from '@/lib/utils';

interface CategoryConfigRow {
  id: string;
  category: string;
  display_name: string;
  icon: string;
  color: string;
  parent_group: string;
  display_order: number;
  is_active: boolean;
}

export function CategoryManager() {
  const [categories, setCategories] = useState<CategoryConfigRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<ParentGroup | null>(null);
  const [editingCategory, setEditingCategory] = useState<CategoryConfigRow | null>(null);
  const [editForm, setEditForm] = useState({ display_name: '', icon: '', color: '' });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('category_config')
        .select('*')
        .order('display_order');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast.error('Failed to load categories');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCategory = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('category_config')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;

      setCategories(
        categories.map((c) => (c.id === id ? { ...c, is_active: isActive } : c))
      );
      toast.success(isActive ? 'Category enabled' : 'Category disabled');
    } catch (error) {
      console.error('Error updating category:', error);
      toast.error('Failed to update category');
    }
  };

  const toggleGroupCategories = async (groupValue: string, enable: boolean) => {
    const groupCats = categories.filter((c) => c.parent_group === groupValue);
    if (groupCats.length === 0) return;

    try {
      const ids = groupCats.map((c) => c.id);
      const { error } = await supabase
        .from('category_config')
        .update({ is_active: enable })
        .in('id', ids);

      if (error) throw error;

      setCategories(
        categories.map((c) =>
          c.parent_group === groupValue ? { ...c, is_active: enable } : c
        )
      );
      toast.success(enable ? `${groupValue} group enabled` : `${groupValue} group disabled`);
    } catch (error) {
      console.error('Error toggling group:', error);
      toast.error('Failed to update group');
    }
  };

  const openEditDialog = (category: CategoryConfigRow) => {
    setEditingCategory(category);
    setEditForm({
      display_name: category.display_name,
      icon: category.icon,
      color: category.color,
    });
  };

  const saveEditedCategory = async () => {
    if (!editingCategory) return;

    if (!editForm.display_name.trim()) {
      toast.error('Display name is required');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('category_config')
        .update({
          display_name: editForm.display_name.trim(),
          icon: editForm.icon.trim(),
          color: editForm.color.trim(),
        })
        .eq('id', editingCategory.id);

      if (error) throw error;

      setCategories(
        categories.map((c) =>
          c.id === editingCategory.id
            ? { ...c, display_name: editForm.display_name.trim(), icon: editForm.icon.trim(), color: editForm.color.trim() }
            : c
        )
      );
      toast.success('Category updated');
      setEditingCategory(null);
    } catch (error) {
      console.error('Error updating category:', error);
      toast.error('Failed to update category');
    } finally {
      setIsSaving(false);
    }
  };

  const groupedCategories = categories.reduce((acc, cat) => {
    if (!acc[cat.parent_group]) {
      acc[cat.parent_group] = [];
    }
    acc[cat.parent_group].push(cat);
    return acc;
  }, {} as Record<string, CategoryConfigRow[]>);

  const isGroupFullyActive = (groupValue: string) => {
    const groupCats = groupedCategories[groupValue] || [];
    return groupCats.length > 0 && groupCats.every((c) => c.is_active);
  };

  const isGroupPartiallyActive = (groupValue: string) => {
    const groupCats = groupedCategories[groupValue] || [];
    const activeCount = groupCats.filter((c) => c.is_active).length;
    return activeCount > 0 && activeCount < groupCats.length;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="animate-spin" size={24} />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Grid3X3 size={20} />
            Category Management
          </CardTitle>
          <CardDescription>
            Enable or disable categories and parent groups. Disabled categories won't appear to users.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Group filters */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
            <Button
              variant={selectedGroup === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedGroup(null)}
            >
              All
            </Button>
            {PARENT_GROUPS.map((group) => (
              <Button
                key={group.value}
                variant={selectedGroup === group.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedGroup(group.value)}
              >
                <span className="mr-1">{group.icon}</span>
                {group.label.split(' ')[0]}
              </Button>
            ))}
          </div>

          <ScrollArea className="h-[500px]">
            <div className="space-y-6 pr-4">
              {PARENT_GROUPS.filter(
                (g) => !selectedGroup || g.value === selectedGroup
              ).map((group) => {
                const groupCats = groupedCategories[group.value] || [];
                if (groupCats.length === 0) return null;

                const activeCount = groupCats.filter((c) => c.is_active).length;
                const isFullyActive = isGroupFullyActive(group.value);
                const isPartiallyActive = isGroupPartiallyActive(group.value);

                return (
                  <div key={group.value} className="space-y-3">
                    {/* Group Header with Toggle */}
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center text-xl', group.color)}>
                          {group.icon}
                        </div>
                        <div>
                          <h4 className="font-semibold">{group.label}</h4>
                          <p className="text-xs text-muted-foreground">
                            {activeCount}/{groupCats.length} categories active
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded-full',
                          isFullyActive ? 'bg-success/20 text-success' :
                          isPartiallyActive ? 'bg-warning/20 text-warning' :
                          'bg-muted text-muted-foreground'
                        )}>
                          {isFullyActive ? 'All On' : isPartiallyActive ? 'Partial' : 'All Off'}
                        </span>
                        <Switch
                          checked={isFullyActive}
                          onCheckedChange={(checked) => toggleGroupCategories(group.value, checked)}
                        />
                      </div>
                    </div>

                    {/* Subcategories */}
                    <div className="space-y-1 ml-2">
                      {groupCats.map((cat) => (
                        <div
                          key={cat.id}
                          className={cn(
                            'flex items-center justify-between p-2.5 rounded-lg transition-colors group',
                            cat.is_active ? 'bg-card border' : 'bg-muted/30 opacity-60'
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <GripVertical size={14} className="text-muted-foreground cursor-move opacity-0 group-hover:opacity-100 transition-opacity" />
                            <span className="text-lg">{cat.icon}</span>
                            <span className={cn('text-sm', !cat.is_active && 'text-muted-foreground')}>
                              {cat.display_name}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              ({cat.category})
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => openEditDialog(cat)}
                            >
                              <Edit2 size={14} />
                            </Button>
                            <Switch
                              checked={cat.is_active}
                              onCheckedChange={(checked) => toggleCategory(cat.id, checked)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          <div className="pt-4 border-t space-y-2">
            <p className="text-xs text-muted-foreground">
              💡 <strong>Tip:</strong> Use the group toggle to enable/disable all categories in a group at once.
            </p>
            <p className="text-xs text-muted-foreground">
              ⚠️ Disabled categories won't be visible to users, but existing sellers can still operate.
            </p>
            <p className="text-xs text-muted-foreground">
              ℹ️ To add new categories, please contact support (requires database enum update).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Edit Category Dialog */}
      <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="display_name">Display Name</Label>
              <Input
                id="display_name"
                value={editForm.display_name}
                onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })}
                placeholder="e.g., Home Food"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="icon">Icon (Emoji)</Label>
              <Input
                id="icon"
                value={editForm.icon}
                onChange={(e) => setEditForm({ ...editForm, icon: e.target.value })}
                placeholder="e.g., 🍲"
                className="text-2xl"
              />
              <p className="text-xs text-muted-foreground">
                Paste an emoji to use as the category icon
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Color Class</Label>
              <Input
                id="color"
                value={editForm.color}
                onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                placeholder="e.g., bg-orange-100 text-orange-600"
              />
              <p className="text-xs text-muted-foreground">
                Tailwind CSS classes for background and text color
              </p>
            </div>

            {/* Preview */}
            <div className="p-4 bg-muted rounded-lg">
              <Label className="text-xs text-muted-foreground mb-2 block">Preview</Label>
              <div className="flex items-center gap-3">
                <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center text-2xl', editForm.color)}>
                  {editForm.icon || '❓'}
                </div>
                <span className="font-medium">{editForm.display_name || 'Category Name'}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCategory(null)}>
              <X size={16} className="mr-1" />
              Cancel
            </Button>
            <Button onClick={saveEditedCategory} disabled={isSaving}>
              {isSaving ? <Loader2 className="animate-spin mr-1" size={16} /> : <Save size={16} className="mr-1" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
