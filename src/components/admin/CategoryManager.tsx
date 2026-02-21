import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Grid3X3, GripVertical, Edit2, Save, X, Plus, Trash2, Sparkles, ImageIcon } from 'lucide-react';
import { useParentGroups, ParentGroupRow } from '@/hooks/useParentGroups';
import { cn, friendlyError } from '@/lib/utils';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface CategoryConfigRow {
  id: string;
  category: string;
  display_name: string;
  icon: string;
  color: string;
  parent_group: string;
  display_order: number;
  is_active: boolean;
  image_url?: string | null;
  name_placeholder?: string | null;
  description_placeholder?: string | null;
  price_label?: string | null;
  duration_label?: string | null;
  show_veg_toggle?: boolean | null;
  show_duration_field?: boolean | null;
}

const COLOR_PRESETS = [
  { label: 'Orange', value: 'bg-orange-100 text-orange-600' },
  { label: 'Blue', value: 'bg-blue-100 text-blue-600' },
  { label: 'Green', value: 'bg-green-100 text-green-600' },
  { label: 'Purple', value: 'bg-purple-100 text-purple-600' },
  { label: 'Pink', value: 'bg-pink-100 text-pink-600' },
  { label: 'Teal', value: 'bg-teal-100 text-teal-600' },
  { label: 'Amber', value: 'bg-amber-100 text-amber-600' },
  { label: 'Indigo', value: 'bg-indigo-100 text-indigo-600' },
  { label: 'Emerald', value: 'bg-emerald-100 text-emerald-600' },
  { label: 'Violet', value: 'bg-violet-100 text-violet-600' },
  { label: 'Lime', value: 'bg-lime-100 text-lime-600' },
  { label: 'Slate', value: 'bg-slate-100 text-slate-600' },
];

const EMOJI_PRESETS = [
  '🍲', '🍕', '🍰', '🥗', '🧁', '☕', '🥤', '🧃',
  '🎓', '📚', '🧘', '💃', '🎵', '🎨', '🗣️', '💪',
  '🔧', '🔌', '🪠', '🪚', '❄️', '🐛', '🔩', '🧹',
  '👩‍🍳', '🚗', '👶', '✂️', '👗', '💅', '🧕', '💈',
  '📊', '💻', '📝', '📄', '🎯', '💼', '🏠', '🅿️',
  '🚲', '🎉', '🎈', '📸', '🎧', '🐕', '🐾', '🐈',
  '🛋️', '📱', '📖', '🧸', '🍳', '👕', '🎂', '🏡',
  '🛒', '🎟️', '⭐', '🌟', '🔥', '💎', '🏪', '🌿',
];

// === Generate Image Button Component ===
function GenerateImageButton({
  categoryName,
  categoryKey,
  parentGroup,
  imageUrl,
  onImageGenerated,
}: {
  categoryName: string;
  categoryKey: string;
  parentGroup: string;
  imageUrl?: string | null;
  onImageGenerated: (url: string) => void;
}) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!categoryName.trim()) {
      toast.error('Enter a category name first');
      return;
    }
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-category-image', {
        body: { categoryName, categoryKey, parentGroup },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.image_url) {
        onImageGenerated(data.image_url);
        toast.success('Image generated successfully!');
      }
    } catch (err: any) {
      console.error('Image generation error:', err);
      toast.error(friendlyError(err));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <ImageIcon size={14} />
        Category Image
      </Label>
      {imageUrl ? (
        <div className="relative rounded-xl overflow-hidden border border-border aspect-square w-32">
          <img src={imageUrl} alt={categoryName} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? <Loader2 className="animate-spin mr-1" size={14} /> : <Sparkles size={14} className="mr-1" />}
              Regenerate
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={handleGenerate}
          disabled={isGenerating || !categoryName.trim()}
          className="w-full gap-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="animate-spin" size={16} />
              Generating AI Image...
            </>
          ) : (
            <>
              <Sparkles size={16} />
              Generate AI Image
            </>
          )}
        </Button>
      )}
      {isGenerating && (
        <p className="text-xs text-muted-foreground">This may take 10-15 seconds...</p>
      )}
    </div>
  );
}

// === Sortable Group Item ===
function SortableGroupItem({
  group,
  groupCats,
  onToggle,
  onEdit,
  onDelete,
  onAddSubcategory,
  children,
}: {
  group: ParentGroupRow;
  groupCats: CategoryConfigRow[];
  onToggle: (group: ParentGroupRow, enabled: boolean) => void;
  onEdit: (group: ParentGroupRow) => void;
  onDelete: (group: ParentGroupRow) => void;
  onAddSubcategory: (slug: string) => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: group.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto' as any,
  };

  const activeCount = groupCats.filter((c) => c.is_active).length;

  return (
    <div ref={setNodeRef} style={style} className="space-y-3">
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
        <div className="flex items-center gap-3">
          <button
            className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={18} />
          </button>
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center text-xl', group.color)}>
            {group.icon}
          </div>
          <div>
            <h4 className="font-semibold">{group.name}</h4>
            <p className="text-xs text-muted-foreground">
              {activeCount}/{groupCats.length} categories active
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(group)}>
            <Edit2 size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(group)}
          >
            <Trash2 size={14} />
          </Button>
          <Button variant="outline" size="sm" onClick={() => onAddSubcategory(group.slug)}>
            <Plus size={14} className="mr-1" />
            Add
          </Button>
          <Switch checked={group.is_active} onCheckedChange={(checked) => onToggle(group, checked)} />
        </div>
      </div>
      {children}
    </div>
  );
}

// === Sortable Subcategory Item ===
function SortableCategoryItem({
  cat,
  groupIsActive,
  onToggle,
  onEdit,
  onDelete,
}: {
  cat: CategoryConfigRow;
  groupIsActive: boolean;
  onToggle: (id: string, isActive: boolean) => void;
  onEdit: (cat: CategoryConfigRow) => void;
  onDelete: (cat: CategoryConfigRow) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cat.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto' as any,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center justify-between p-2.5 rounded-lg transition-colors group',
        cat.is_active ? 'bg-card border' : 'bg-muted/30 opacity-60'
      )}
    >
      <div className="flex items-center gap-2">
        <button
          className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} />
        </button>
        {cat.image_url ? (
          <img src={cat.image_url} alt={cat.display_name} className="w-7 h-7 rounded-md object-cover" />
        ) : (
          <span className="text-lg">{cat.icon}</span>
        )}
        <span className={cn('text-sm', !cat.is_active && 'text-muted-foreground')}>
          {cat.display_name}
        </span>
        <span className="text-[10px] text-muted-foreground font-mono">({cat.category})</span>
        {!cat.image_url && (
          <span className="text-[10px] text-amber-500 font-medium">No image</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onEdit(cat)}
        >
          <Edit2 size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
          onClick={() => onDelete(cat)}
        >
          <Trash2 size={14} />
        </Button>
        <Switch
          checked={cat.is_active}
          onCheckedChange={(checked) => onToggle(cat.id, checked)}
          disabled={!groupIsActive}
        />
      </div>
    </div>
  );
}

export function CategoryManager() {
  const { groups, parentGroupInfos, isLoading: groupsLoading, refresh: refreshGroups } = useParentGroups();
  const [categories, setCategories] = useState<CategoryConfigRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedGroupSlug, setSelectedGroupSlug] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<CategoryConfigRow | null>(null);
  const [editForm, setEditForm] = useState({ display_name: '', icon: '', color: '', image_url: '' as string | null, name_placeholder: '', description_placeholder: '', price_label: '', duration_label: '', show_veg_toggle: false, show_duration_field: false });
  const [isSaving, setIsSaving] = useState(false);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addingToGroup, setAddingToGroup] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({
    display_name: '',
    icon: '',
    color: 'bg-blue-100 text-blue-600',
    parent_group: '',
    image_url: null as string | null,
  });

  const [deleteCategory, setDeleteCategory] = useState<CategoryConfigRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ParentGroupRow | null>(null);
  const [groupForm, setGroupForm] = useState({ name: '', icon: '', color: 'bg-blue-100 text-blue-600', description: '' });
  const [deleteGroup, setDeleteGroup] = useState<ParentGroupRow | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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

  // === Subcategory CRUD ===
  const toggleCategory = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase.from('category_config').update({ is_active: isActive }).eq('id', id);
      if (error) throw error;
      setCategories(categories.map((c) => (c.id === id ? { ...c, is_active: isActive } : c)));
      toast.success(isActive ? 'Category enabled' : 'Category disabled');
    } catch (error) {
      console.error('Error updating category:', error);
      toast.error('Failed to update category');
    }
  };

  const openEditDialog = (category: CategoryConfigRow) => {
    setEditingCategory(category);
    setEditForm({
      display_name: category.display_name,
      icon: category.icon,
      color: category.color,
      image_url: category.image_url || null,
      name_placeholder: category.name_placeholder || '',
      description_placeholder: category.description_placeholder || '',
      price_label: category.price_label || 'Price',
      duration_label: category.duration_label || '',
      show_veg_toggle: category.show_veg_toggle ?? false,
      show_duration_field: category.show_duration_field ?? false,
    });
  };

  const saveEditedCategory = async () => {
    if (!editingCategory) return;
    if (!editForm.display_name.trim()) { toast.error('Display name is required'); return; }
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('category_config')
        .update({
          display_name: editForm.display_name.trim(),
          icon: editForm.icon.trim(),
          color: editForm.color.trim(),
          image_url: editForm.image_url || null,
          name_placeholder: editForm.name_placeholder.trim() || null,
          description_placeholder: editForm.description_placeholder.trim() || null,
          price_label: editForm.price_label.trim() || 'Price',
          duration_label: editForm.duration_label.trim() || null,
          show_veg_toggle: editForm.show_veg_toggle,
          show_duration_field: editForm.show_duration_field,
        })
        .eq('id', editingCategory.id);
      if (error) throw error;
      setCategories(categories.map((c) => c.id === editingCategory.id ? { ...c, ...editForm } : c));
      toast.success('Category updated');
      setEditingCategory(null);
    } catch (error) {
      toast.error('Failed to update category');
    } finally {
      setIsSaving(false);
    }
  };

  const generateCategoryKey = (displayName: string): string =>
    displayName.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_');

  const openAddDialog = (groupSlug: string) => {
    setAddingToGroup(groupSlug);
    setAddForm({ display_name: '', icon: '', color: 'bg-blue-100 text-blue-600', parent_group: groupSlug, image_url: null });
    setIsAddDialogOpen(true);
  };

  const saveNewCategory = async () => {
    if (!addForm.display_name.trim()) { toast.error('Display name is required'); return; }
    if (!addForm.icon.trim()) { toast.error('Icon is required'); return; }
    const categoryKey = generateCategoryKey(addForm.display_name);
    if (categories.some(c => c.category === categoryKey)) { toast.error('A category with this key already exists'); return; }
    setIsSaving(true);
    try {
      const groupCats = categories.filter(c => c.parent_group === addForm.parent_group);
      const maxOrder = groupCats.length > 0 ? Math.max(...groupCats.map(c => c.display_order)) : 0;
      const { data, error } = await supabase
        .from('category_config')
        .insert({
          category: categoryKey,
          display_name: addForm.display_name.trim(),
          icon: addForm.icon.trim(),
          color: addForm.color,
          parent_group: addForm.parent_group,
          display_order: maxOrder + 1,
          is_active: true,
          image_url: addForm.image_url || null,
        })
        .select()
        .single();
      if (error) throw error;
      setCategories([...categories, data]);
      toast.success('Category added successfully');
      setIsAddDialogOpen(false);

      // Auto-generate image if none was set
      if (!addForm.image_url) {
        toast.info('Generating AI image for the new category...');
        try {
          const { data: imgData, error: imgError } = await supabase.functions.invoke('generate-category-image', {
            body: { categoryName: addForm.display_name, categoryKey, parentGroup: addForm.parent_group },
          });
          if (!imgError && imgData?.image_url) {
            setCategories(prev => prev.map(c => c.category === categoryKey ? { ...c, image_url: imgData.image_url } : c));
            toast.success('AI image generated for ' + addForm.display_name);
          }
        } catch {
          // Non-blocking - image generation failure shouldn't prevent category creation
          console.log('Auto image generation failed, can be retried from edit');
        }
      }
    } catch (error: any) {
      toast.error(friendlyError(error));
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDeleteCategory = async () => {
    if (!deleteCategory) return;
    setIsDeleting(true);
    try {
      const { data: sellers } = await supabase.from('seller_profiles').select('id').contains('categories', [deleteCategory.category]).limit(1);
      if (sellers && sellers.length > 0) {
        await supabase.from('category_config').update({ is_active: false }).eq('id', deleteCategory.id);
        setCategories(categories.map((c) => c.id === deleteCategory.id ? { ...c, is_active: false } : c));
        toast.info('Category disabled (sellers are using it)');
      } else {
        await supabase.from('category_config').delete().eq('id', deleteCategory.id);
        setCategories(categories.filter((c) => c.id !== deleteCategory.id));
        toast.success('Category deleted');
      }
      setDeleteCategory(null);
    } catch (error) {
      toast.error('Failed to delete category');
    } finally {
      setIsDeleting(false);
    }
  };

  // === Parent Group CRUD ===
  const toggleGroup = async (group: ParentGroupRow, enable: boolean) => {
    try {
      await supabase.from('parent_groups').update({ is_active: enable }).eq('id', group.id);
      if (!enable) {
        const groupCats = categories.filter((c) => c.parent_group === group.slug);
        if (groupCats.length > 0) {
          await supabase.from('category_config').update({ is_active: false }).in('id', groupCats.map(c => c.id));
          setCategories(categories.map((c) => c.parent_group === group.slug ? { ...c, is_active: false } : c));
        }
      }
      await refreshGroups();
      toast.success(enable ? `${group.name} enabled` : `${group.name} disabled (subcategories also disabled)`);
    } catch (error) {
      toast.error('Failed to update group');
    }
  };

  const openGroupDialog = (group?: ParentGroupRow) => {
    if (group) {
      setEditingGroup(group);
      setGroupForm({ name: group.name, icon: group.icon, color: group.color, description: group.description });
    } else {
      setEditingGroup(null);
      setGroupForm({ name: '', icon: '', color: 'bg-blue-100 text-blue-600', description: '' });
    }
    setIsGroupDialogOpen(true);
  };

  const generateSlug = (name: string): string =>
    name.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_');

  const saveGroup = async () => {
    if (!groupForm.name.trim()) { toast.error('Name is required'); return; }
    if (!groupForm.icon.trim()) { toast.error('Icon is required'); return; }
    setIsSaving(true);
    try {
      if (editingGroup) {
        await supabase.from('parent_groups').update({ name: groupForm.name.trim(), icon: groupForm.icon.trim(), color: groupForm.color, description: groupForm.description.trim() }).eq('id', editingGroup.id);
        toast.success('Category group updated');
      } else {
        const slug = generateSlug(groupForm.name);
        const maxOrder = groups.length > 0 ? Math.max(...groups.map(g => g.sort_order)) : 0;
        await supabase.from('parent_groups').insert({ slug, name: groupForm.name.trim(), icon: groupForm.icon.trim(), color: groupForm.color, description: groupForm.description.trim(), sort_order: maxOrder + 1 });
        toast.success('Category group created');
      }
      await refreshGroups();
      setIsGroupDialogOpen(false);
    } catch (error: any) {
      toast.error(friendlyError(error));
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDeleteGroup = async () => {
    if (!deleteGroup) return;
    setIsDeletingGroup(true);
    try {
      const groupCats = categories.filter(c => c.parent_group === deleteGroup.slug);
      if (groupCats.length > 0) {
        const { data: sellers } = await supabase.from('seller_profiles').select('id').eq('primary_group', deleteGroup.slug).limit(1);
        if (sellers && sellers.length > 0) {
          await supabase.from('parent_groups').update({ is_active: false }).eq('id', deleteGroup.id);
          await supabase.from('category_config').update({ is_active: false }).in('id', groupCats.map(c => c.id));
          setCategories(categories.map(c => c.parent_group === deleteGroup.slug ? { ...c, is_active: false } : c));
          toast.info('Group disabled (sellers are using it). Subcategories also disabled.');
        } else {
          await supabase.from('category_config').delete().in('id', groupCats.map(c => c.id));
          await supabase.from('parent_groups').delete().eq('id', deleteGroup.id);
          setCategories(categories.filter(c => c.parent_group !== deleteGroup.slug));
          toast.success('Group and its subcategories deleted');
        }
      } else {
        await supabase.from('parent_groups').delete().eq('id', deleteGroup.id);
        toast.success('Group deleted');
      }
      await refreshGroups();
      setDeleteGroup(null);
    } catch (error) {
      toast.error('Failed to delete group');
    } finally {
      setIsDeletingGroup(false);
    }
  };

  // === Drag & Drop Handlers ===
  const handleGroupDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const filteredGroups = groups.filter(g => !selectedGroupSlug || g.slug === selectedGroupSlug);
    const oldIndex = filteredGroups.findIndex(g => g.id === active.id);
    const newIndex = filteredGroups.findIndex(g => g.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(filteredGroups, oldIndex, newIndex);

    try {
      const updates = reordered.map((g, i) => supabase.from('parent_groups').update({ sort_order: i }).eq('id', g.id));
      await Promise.all(updates);
      await refreshGroups();
      toast.success('Group order updated');
    } catch {
      toast.error('Failed to reorder groups');
      await refreshGroups();
    }
  }, [groups, selectedGroupSlug, refreshGroups]);

  const handleSubcategoryDragEnd = useCallback(async (groupSlug: string, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const groupCats = categories
      .filter(c => c.parent_group === groupSlug)
      .sort((a, b) => a.display_order - b.display_order);

    const oldIndex = groupCats.findIndex(c => c.id === active.id);
    const newIndex = groupCats.findIndex(c => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(groupCats, oldIndex, newIndex);

    const orderMap = new Map(reordered.map((c, i) => [c.id, i]));
    setCategories(prev =>
      prev.map(c => orderMap.has(c.id) ? { ...c, display_order: orderMap.get(c.id)! } : c)
    );

    try {
      const updates = reordered.map((c, i) => supabase.from('category_config').update({ display_order: i }).eq('id', c.id));
      await Promise.all(updates);
      toast.success('Category order updated');
    } catch {
      toast.error('Failed to reorder categories');
      fetchCategories();
    }
  }, [categories]);

  const groupedCategories = categories.reduce((acc, cat) => {
    if (!acc[cat.parent_group]) acc[cat.parent_group] = [];
    acc[cat.parent_group].push(cat);
    return acc;
  }, {} as Record<string, CategoryConfigRow[]>);

  const filteredGroups = groups.filter(g => !selectedGroupSlug || g.slug === selectedGroupSlug);

  if (isLoading || groupsLoading) {
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Grid3X3 size={20} />
                Category Management
              </CardTitle>
              <CardDescription>
                Drag to reorder. Disabled items won't appear to users.
              </CardDescription>
            </div>
            <Button onClick={() => openGroupDialog()} size="sm">
              <Plus size={14} className="mr-1" />
              Add Group
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
            <Button variant={selectedGroupSlug === null ? 'default' : 'outline'} size="sm" onClick={() => setSelectedGroupSlug(null)}>
              All
            </Button>
            {parentGroupInfos.map((group) => (
              <Button key={group.value} variant={selectedGroupSlug === group.value ? 'default' : 'outline'} size="sm" onClick={() => setSelectedGroupSlug(group.value)}>
                <span className="mr-1">{group.icon}</span>
                {group.label.split(' ')[0]}
              </Button>
            ))}
          </div>

          <ScrollArea className="h-[500px]">
            <div className="space-y-6 pr-4">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleGroupDragEnd}>
                <SortableContext items={filteredGroups.map(g => g.id)} strategy={verticalListSortingStrategy}>
                  {filteredGroups.map((group) => {
                    const groupCats = (groupedCategories[group.slug] || []).sort((a, b) => a.display_order - b.display_order);

                    return (
                      <SortableGroupItem
                        key={group.id}
                        group={group}
                        groupCats={groupCats}
                        onToggle={toggleGroup}
                        onEdit={openGroupDialog}
                        onDelete={setDeleteGroup}
                        onAddSubcategory={openAddDialog}
                      >
                        <div className="space-y-1 ml-2">
                          {groupCats.length === 0 && (
                            <p className="text-sm text-muted-foreground py-2 px-3">
                              No categories yet. Click "Add" to create one.
                            </p>
                          )}
                          <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={(e) => handleSubcategoryDragEnd(group.slug, e)}
                          >
                            <SortableContext items={groupCats.map(c => c.id)} strategy={verticalListSortingStrategy}>
                              {groupCats.map((cat) => (
                                <SortableCategoryItem
                                  key={cat.id}
                                  cat={cat}
                                  groupIsActive={group.is_active}
                                  onToggle={toggleCategory}
                                  onEdit={openEditDialog}
                                  onDelete={setDeleteCategory}
                                />
                              ))}
                            </SortableContext>
                          </DndContext>
                        </div>
                      </SortableGroupItem>
                    );
                  })}
                </SortableContext>
              </DndContext>
            </div>
          </ScrollArea>

          <div className="pt-4 border-t space-y-2">
            <p className="text-xs text-muted-foreground">
              💡 <strong>Tip:</strong> Drag the ⠿ handle to reorder groups and subcategories.
            </p>
            <p className="text-xs text-muted-foreground">
              ⚠️ Disabling a parent group will also disable all its subcategories.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Edit Subcategory Dialog */}
      <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="display_name">Display Name</Label>
              <Input id="display_name" value={editForm.display_name} onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })} placeholder="e.g., Home Food" />
            </div>

            {/* AI Image Generation */}
            {editingCategory && (
              <GenerateImageButton
                categoryName={editForm.display_name}
                categoryKey={editingCategory.category}
                parentGroup={editingCategory.parent_group}
                imageUrl={editForm.image_url}
                onImageGenerated={(url) => {
                  setEditForm({ ...editForm, image_url: url });
                  setCategories(prev => prev.map(c => c.id === editingCategory.id ? { ...c, image_url: url } : c));
                }}
              />
            )}

            <div className="space-y-2">
              <Label htmlFor="icon">Icon (Emoji)</Label>
              <Input id="icon" value={editForm.icon} onChange={(e) => setEditForm({ ...editForm, icon: e.target.value })} placeholder="e.g., 🍲" className="text-2xl" />
              <div className="flex flex-wrap gap-1.5 mt-1">
                {EMOJI_PRESETS.map((emoji) => (
                  <button key={emoji} type="button" onClick={() => setEditForm({ ...editForm, icon: emoji })} className={cn('w-8 h-8 rounded-md text-lg flex items-center justify-center hover:bg-muted transition-colors', editForm.icon === emoji && 'bg-primary/15 ring-1 ring-primary')}>
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <Select value={editForm.color} onValueChange={(value) => setEditForm({ ...editForm, color: value })}>
                <SelectTrigger><SelectValue placeholder="Select a color" /></SelectTrigger>
                <SelectContent>
                  {COLOR_PRESETS.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      <div className="flex items-center gap-2">
                        <div className={cn('w-4 h-4 rounded', color.value)} />
                        {color.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Form Hint Settings */}
            <div className="border-t pt-4 mt-2">
              <Label className="text-xs text-muted-foreground mb-3 block font-semibold">Seller Form Hints</Label>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Name Placeholder</Label>
                  <Input value={editForm.name_placeholder} onChange={(e) => setEditForm({ ...editForm, name_placeholder: e.target.value })} placeholder="e.g., Paneer Butter Masala" className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Description Placeholder</Label>
                  <Input value={editForm.description_placeholder} onChange={(e) => setEditForm({ ...editForm, description_placeholder: e.target.value })} placeholder="e.g., Describe the dish..." className="h-8 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Price Label</Label>
                    <Input value={editForm.price_label} onChange={(e) => setEditForm({ ...editForm, price_label: e.target.value })} placeholder="Price" className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Duration Label</Label>
                    <Input value={editForm.duration_label} onChange={(e) => setEditForm({ ...editForm, duration_label: e.target.value })} placeholder="Prep Time (min)" className="h-8 text-sm" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">Show Veg/Non-Veg Toggle</span>
                  <Switch checked={editForm.show_veg_toggle} onCheckedChange={(v) => setEditForm({ ...editForm, show_veg_toggle: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">Show Duration Field</span>
                  <Switch checked={editForm.show_duration_field} onCheckedChange={(v) => setEditForm({ ...editForm, show_duration_field: v })} />
                </div>
              </div>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <Label className="text-xs text-muted-foreground mb-2 block">Preview</Label>
              <div className="flex items-center gap-3">
                {editForm.image_url ? (
                  <img src={editForm.image_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                ) : (
                  <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center text-2xl', editForm.color)}>{editForm.icon || '❓'}</div>
                )}
                <span className="font-medium">{editForm.display_name || 'Category Name'}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCategory(null)}><X size={16} className="mr-1" />Cancel</Button>
            <Button onClick={saveEditedCategory} disabled={isSaving}>
              {isSaving ? <Loader2 className="animate-spin mr-1" size={16} /> : <Save size={16} className="mr-1" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Subcategory Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Subcategory</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="add_display_name">Display Name *</Label>
              <Input id="add_display_name" value={addForm.display_name} onChange={(e) => setAddForm({ ...addForm, display_name: e.target.value })} placeholder="e.g., Home Food" />
              {addForm.display_name && (
                <p className="text-xs text-muted-foreground">
                  Category key: <code className="bg-muted px-1 rounded">{generateCategoryKey(addForm.display_name)}</code>
                </p>
              )}
            </div>

            {/* AI Image Generation for Add */}
            <GenerateImageButton
              categoryName={addForm.display_name}
              categoryKey={generateCategoryKey(addForm.display_name)}
              parentGroup={addForm.parent_group}
              imageUrl={addForm.image_url}
              onImageGenerated={(url) => setAddForm({ ...addForm, image_url: url })}
            />

            <div className="space-y-2">
              <Label htmlFor="add_icon">Icon (Emoji) *</Label>
              <Input id="add_icon" value={addForm.icon} onChange={(e) => setAddForm({ ...addForm, icon: e.target.value })} placeholder="e.g., 🍲" className="text-2xl" />
              <div className="flex flex-wrap gap-1.5 mt-1">
                {EMOJI_PRESETS.map((emoji) => (
                  <button key={emoji} type="button" onClick={() => setAddForm({ ...addForm, icon: emoji })} className={cn('w-8 h-8 rounded-md text-lg flex items-center justify-center hover:bg-muted transition-colors', addForm.icon === emoji && 'bg-primary/15 ring-1 ring-primary')}>
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <Select value={addForm.color} onValueChange={(value) => setAddForm({ ...addForm, color: value })}>
                <SelectTrigger><SelectValue placeholder="Select a color" /></SelectTrigger>
                <SelectContent>
                  {COLOR_PRESETS.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      <div className="flex items-center gap-2">
                        <div className={cn('w-4 h-4 rounded', color.value)} />
                        {color.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Parent Group</Label>
              <Select value={addForm.parent_group} onValueChange={(value) => setAddForm({ ...addForm, parent_group: value })}>
                <SelectTrigger><SelectValue placeholder="Select a group" /></SelectTrigger>
                <SelectContent>
                  {parentGroupInfos.map((group) => (
                    <SelectItem key={group.value} value={group.value}>
                      <div className="flex items-center gap-2">
                        <span>{group.icon}</span>
                        {group.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <Label className="text-xs text-muted-foreground mb-2 block">Preview</Label>
              <div className="flex items-center gap-3">
                {addForm.image_url ? (
                  <img src={addForm.image_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                ) : (
                  <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center text-2xl', addForm.color)}>{addForm.icon || '❓'}</div>
                )}
                <span className="font-medium">{addForm.display_name || 'Category Name'}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Sparkles size={12} />
              AI image will be auto-generated on save if not manually generated.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}><X size={16} className="mr-1" />Cancel</Button>
            <Button onClick={saveNewCategory} disabled={isSaving}>
              {isSaving ? <Loader2 className="animate-spin mr-1" size={16} /> : <Plus size={16} className="mr-1" />}
              Add Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Subcategory Confirmation */}
      <AlertDialog open={!!deleteCategory} onOpenChange={(open) => !open && setDeleteCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteCategory?.display_name}"?
              {deleteCategory && (
                <span className="block mt-2 text-sm">
                  If sellers are using this category, it will be disabled instead of deleted.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteCategory} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? <Loader2 className="animate-spin mr-1" size={16} /> : <Trash2 size={16} className="mr-1" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Parent Group Dialog (Create/Edit) */}
      <Dialog open={isGroupDialogOpen} onOpenChange={setIsGroupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGroup ? 'Edit Category Group' : 'Add New Category Group'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} placeholder="e.g., Food & Groceries" />
              {!editingGroup && groupForm.name && (
                <p className="text-xs text-muted-foreground">
                  Slug: <code className="bg-muted px-1 rounded">{generateSlug(groupForm.name)}</code>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Icon (Emoji) *</Label>
              <Input value={groupForm.icon} onChange={(e) => setGroupForm({ ...groupForm, icon: e.target.value })} placeholder="e.g., 🍲" className="text-2xl" />
              <div className="flex flex-wrap gap-1.5 mt-1">
                {EMOJI_PRESETS.map((emoji) => (
                  <button key={emoji} type="button" onClick={() => setGroupForm({ ...groupForm, icon: emoji })} className={cn('w-8 h-8 rounded-md text-lg flex items-center justify-center hover:bg-muted transition-colors', groupForm.icon === emoji && 'bg-primary/15 ring-1 ring-primary')}>
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <Select value={groupForm.color} onValueChange={(value) => setGroupForm({ ...groupForm, color: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLOR_PRESETS.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      <div className="flex items-center gap-2">
                        <div className={cn('w-4 h-4 rounded', color.value)} />
                        {color.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={groupForm.description} onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })} placeholder="Short description of this category group" rows={2} />
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <Label className="text-xs text-muted-foreground mb-2 block">Preview</Label>
              <div className="flex items-center gap-3">
                <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center text-2xl', groupForm.color)}>{groupForm.icon || '❓'}</div>
                <div>
                  <span className="font-medium block">{groupForm.name || 'Group Name'}</span>
                  <span className="text-xs text-muted-foreground">{groupForm.description || 'Description'}</span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsGroupDialogOpen(false)}><X size={16} className="mr-1" />Cancel</Button>
            <Button onClick={saveGroup} disabled={isSaving}>
              {isSaving ? <Loader2 className="animate-spin mr-1" size={16} /> : <Save size={16} className="mr-1" />}
              {editingGroup ? 'Save Changes' : 'Create Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Group Confirmation */}
      <AlertDialog open={!!deleteGroup} onOpenChange={(open) => !open && setDeleteGroup(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the "{deleteGroup?.name}" group?
              <span className="block mt-2 text-sm">
                If sellers are using categories in this group, the group will be disabled instead. Otherwise, all subcategories will also be deleted.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteGroup} disabled={isDeletingGroup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeletingGroup ? <Loader2 className="animate-spin mr-1" size={16} /> : <Trash2 size={16} className="mr-1" />}
              Delete Group
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
