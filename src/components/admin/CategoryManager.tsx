import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Grid3X3, GripVertical, Edit2, Plus, Trash2, Sparkles, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCategoryManagerData, CategoryConfigRow } from '@/hooks/useCategoryManagerData';
import { ParentGroupRow } from '@/hooks/useParentGroups';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const COLOR_PRESETS = [
  { label: 'Orange', value: 'bg-orange-100 text-orange-600' }, { label: 'Blue', value: 'bg-blue-100 text-blue-600' },
  { label: 'Green', value: 'bg-green-100 text-green-600' }, { label: 'Purple', value: 'bg-purple-100 text-purple-600' },
  { label: 'Pink', value: 'bg-pink-100 text-pink-600' }, { label: 'Teal', value: 'bg-teal-100 text-teal-600' },
  { label: 'Amber', value: 'bg-amber-100 text-amber-600' }, { label: 'Indigo', value: 'bg-indigo-100 text-indigo-600' },
  { label: 'Emerald', value: 'bg-emerald-100 text-emerald-600' }, { label: 'Violet', value: 'bg-violet-100 text-violet-600' },
  { label: 'Lime', value: 'bg-lime-100 text-lime-600' }, { label: 'Slate', value: 'bg-slate-100 text-slate-600' },
];

const EMOJI_PRESETS = ['🍲', '🍕', '🍰', '🥗', '🧁', '☕', '🥤', '🧃', '🎓', '📚', '🧘', '💃', '🎵', '🎨', '🗣️', '💪', '🔧', '🔌', '🪠', '🪚', '❄️', '🐛', '🔩', '🧹', '👩‍🍳', '🚗', '👶', '✂️', '👗', '💅', '🧕', '💈', '📊', '💻', '📝', '📄', '🎯', '💼', '🏠', '🅿️', '🚲', '🎉', '🎈', '📸', '🎧', '🐕', '🐾', '🐈', '🛋️', '📱', '📖', '🧸', '🍳', '👕', '🎂', '🏡', '🛒', '🎟️', '⭐', '🌟', '🔥', '💎', '🏪', '🌿'];

function GenerateImageButton({ categoryName, categoryKey, parentGroup, imageUrl, onImageGenerated }: { categoryName: string; categoryKey: string; parentGroup: string; imageUrl?: string | null; onImageGenerated: (url: string) => void; }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const handleGenerate = async () => {
    if (!categoryName.trim()) { toast.error('Enter a category name first'); return; }
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-category-image', { body: { categoryName, categoryKey, parentGroup } });
      if (!error && data?.image_url) { onImageGenerated(data.image_url); toast.success('Image generated successfully!'); }
    } catch { toast.error('Generation failed'); } finally { setIsGenerating(false); }
  };
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5 text-xs font-semibold"><ImageIcon size={14} />Category Image</Label>
      {imageUrl ? (
        <div className="relative rounded-xl overflow-hidden border border-border aspect-square w-32">
          <img src={imageUrl} alt={categoryName} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
            <Button type="button" size="sm" variant="secondary" onClick={handleGenerate} disabled={isGenerating} className="rounded-xl">
              {isGenerating ? <Loader2 className="animate-spin mr-1" size={14} /> : <Sparkles size={14} className="mr-1" />}Regenerate
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" onClick={handleGenerate} disabled={isGenerating || !categoryName.trim()} className="w-full gap-2 rounded-xl h-10">
          {isGenerating ? <><Loader2 className="animate-spin" size={16} />Generating AI Image...</> : <><Sparkles size={16} />Generate AI Image</>}
        </Button>
      )}
      {isGenerating && <p className="text-xs text-muted-foreground">This may take 10-15 seconds...</p>}
    </div>
  );
}

function SortableGroupItem({ group, groupCats, onToggle, onEdit, onDelete, onAddSubcategory, children }: { group: ParentGroupRow; groupCats: CategoryConfigRow[]; onToggle: (group: ParentGroupRow, enabled: boolean) => void; onEdit: (group: ParentGroupRow) => void; onDelete: (group: ParentGroupRow) => void; onAddSubcategory: (slug: string) => void; children: React.ReactNode; }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: group.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 50 : 'auto' as any };
  const activeCount = groupCats.filter((c) => c.is_active).length;
  return (
    <div ref={setNodeRef} style={style} className="space-y-2">
      <div className="flex items-center justify-between p-3.5 bg-card border-0 shadow-[var(--shadow-card)] rounded-2xl hover:shadow-[var(--shadow-md)] transition-all duration-300">
        <div className="flex items-center gap-3">
          <button className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground transition-colors" {...attributes} {...listeners}>
            <GripVertical size={16} />
          </button>
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0', group.color)}>
            {group.icon}
          </div>
          <div>
            <h4 className="font-bold text-sm">{group.name}</h4>
            <p className="text-[10px] text-muted-foreground font-medium">
              {activeCount}/{groupCats.length} categories active
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-muted" onClick={() => onEdit(group)}>
            <Edit2 size={13} />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => onDelete(group)}>
            <Trash2 size={13} />
          </Button>
          <Button variant="outline" size="sm" onClick={() => onAddSubcategory(group.slug)} className="rounded-xl text-xs h-8 font-semibold">
            <Plus size={12} className="mr-1" />Add
          </Button>
          <Switch checked={group.is_active} onCheckedChange={(checked) => onToggle(group, checked)} />
        </div>
      </div>
      {children}
    </div>
  );
}

function SortableCategoryItem({ cat, groupIsActive, onToggle, onEdit, onDelete }: { cat: CategoryConfigRow; groupIsActive: boolean; onToggle: (id: string, isActive: boolean) => void; onEdit: (cat: CategoryConfigRow) => void; onDelete: (cat: CategoryConfigRow) => void; }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 50 : 'auto' as any };
  return (
    <div ref={setNodeRef} style={style} className={cn(
      'flex items-center justify-between p-2.5 rounded-xl transition-all duration-200 group',
      cat.is_active ? 'bg-card border border-border/40 shadow-sm hover:shadow-md' : 'bg-muted/30 opacity-60'
    )}>
      <div className="flex items-center gap-2">
        <button className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground transition-colors" {...attributes} {...listeners}>
          <GripVertical size={14} />
        </button>
        {cat.image_url ? (
          <img src={cat.image_url} alt={cat.display_name} className="w-7 h-7 rounded-lg object-cover" />
        ) : (
          <span className="text-lg">{cat.icon}</span>
        )}
        <span className={cn('text-sm font-medium', !cat.is_active && 'text-muted-foreground')}>{cat.display_name}</span>
        <span className="text-[10px] text-muted-foreground font-mono">({cat.category})</span>
        {!cat.image_url && <span className="text-[10px] text-amber-500 font-semibold">No image</span>}
      </div>
      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => onEdit(cat)}>
          <Edit2 size={13} />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive rounded-lg" onClick={() => onDelete(cat)}>
          <Trash2 size={13} />
        </Button>
        <Switch checked={cat.is_active} onCheckedChange={(checked) => onToggle(cat.id, checked)} disabled={!groupIsActive} />
      </div>
    </div>
  );
}

export function CategoryManager() {
  const cm = useCategoryManagerData();

  if (cm.isLoading || cm.groupsLoading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="animate-spin text-muted-foreground" size={24} />
    </div>
  );

  return (
    <>
      <Card className="border-0 shadow-[var(--shadow-card)] rounded-2xl">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Grid3X3 size={16} className="text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold">Category Management</CardTitle>
                <CardDescription className="text-xs">Drag to reorder. Disabled items won't appear to users.</CardDescription>
              </div>
            </div>
            <Button onClick={() => cm.openGroupDialog()} size="sm" className="rounded-xl font-semibold gap-1.5">
              <Plus size={13} />Add Group
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
            <Button variant={cm.selectedGroupSlug === null ? 'default' : 'outline'} size="sm" onClick={() => cm.setSelectedGroupSlug(null)} className="rounded-xl text-xs h-8 font-semibold shrink-0">
              All
            </Button>
            {cm.parentGroupInfos.map((group) => (
              <Button key={group.value} variant={cm.selectedGroupSlug === group.value ? 'default' : 'outline'} size="sm" onClick={() => cm.setSelectedGroupSlug(group.value)} className="rounded-xl text-xs h-8 font-semibold shrink-0">
                <span className="mr-1">{group.icon}</span>{group.label.split(' ')[0]}
              </Button>
            ))}
          </div>
          <ScrollArea className="h-[500px]">
            <div className="space-y-5 pr-4">
              <DndContext sensors={cm.sensors} collisionDetection={closestCenter} onDragEnd={cm.handleGroupDragEnd}>
                <SortableContext items={cm.filteredGroups.map(g => g.id)} strategy={verticalListSortingStrategy}>
                  {cm.filteredGroups.map((group, idx) => {
                    const groupCats = (cm.groupedCategories[group.slug] || []).sort((a, b) => a.display_order - b.display_order);
                    return (
                      <motion.div key={group.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
                        <SortableGroupItem group={group} groupCats={groupCats} onToggle={cm.toggleGroup} onEdit={cm.openGroupDialog} onDelete={cm.setDeleteGroup} onAddSubcategory={cm.openAddDialog}>
                          <div className="space-y-1.5 ml-3">
                            {groupCats.length === 0 && (
                              <p className="text-sm text-muted-foreground py-3 px-3">No categories yet. Click "Add" to create one.</p>
                            )}
                            <DndContext sensors={cm.sensors} collisionDetection={closestCenter} onDragEnd={(e) => cm.handleSubcategoryDragEnd(group.slug, e)}>
                              <SortableContext items={groupCats.map(c => c.id)} strategy={verticalListSortingStrategy}>
                                {groupCats.map((cat) => (
                                  <SortableCategoryItem key={cat.id} cat={cat} groupIsActive={group.is_active} onToggle={cm.toggleCategory} onEdit={cm.openEditDialog} onDelete={cm.setDeleteCategory} />
                                ))}
                              </SortableContext>
                            </DndContext>
                          </div>
                        </SortableGroupItem>
                      </motion.div>
                    );
                  })}
                </SortableContext>
              </DndContext>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* ── Edit Category Dialog ── */}
      <Dialog open={!!cm.editingCategory} onOpenChange={(open) => !open && cm.setEditingCategory(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-bold">Edit Category</DialogTitle>
            <DialogDescription className="text-xs">Update display name, icon, color and seller form hints.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="display_name" className="text-xs font-semibold">Display Name</Label>
              <Input id="display_name" value={cm.editForm.display_name} onChange={(e) => cm.setEditForm({ ...cm.editForm, display_name: e.target.value })} className="rounded-xl" />
            </div>
            {cm.editingCategory && (
              <GenerateImageButton
                categoryName={cm.editForm.display_name}
                categoryKey={cm.editingCategory.category}
                parentGroup={cm.editingCategory.parent_group}
                imageUrl={cm.editForm.image_url}
                onImageGenerated={(url) => {
                  cm.setEditForm({ ...cm.editForm, image_url: url });
                  cm.setCategories(prev => prev.map(c => c.id === cm.editingCategory!.id ? { ...c, image_url: url } : c));
                }}
              />
            )}
            <div className="space-y-2">
              <Label htmlFor="icon" className="text-xs font-semibold">Icon (Emoji)</Label>
              <Input id="icon" value={cm.editForm.icon} onChange={(e) => cm.setEditForm({ ...cm.editForm, icon: e.target.value })} className="text-2xl rounded-xl" />
              <div className="flex flex-wrap gap-1.5 mt-1">
                {EMOJI_PRESETS.map((emoji) => (
                  <button key={emoji} type="button" onClick={() => cm.setEditForm({ ...cm.editForm, icon: emoji })} className={cn('w-8 h-8 rounded-lg text-lg flex items-center justify-center hover:bg-muted transition-colors', cm.editForm.icon === emoji && 'bg-primary/15 ring-1 ring-primary')}>
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Color</Label>
              <Select value={cm.editForm.color} onValueChange={(value) => cm.setEditForm({ ...cm.editForm, color: value })}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLOR_PRESETS.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      <div className="flex items-center gap-2"><div className={cn('w-4 h-4 rounded', color.value)} />{color.label}</div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="border-t pt-4 mt-2">
              <Label className="text-xs text-muted-foreground mb-3 block font-bold uppercase tracking-wider">Seller Form Hints</Label>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Name Placeholder</Label>
                  <Input value={cm.editForm.name_placeholder} onChange={(e) => cm.setEditForm({ ...cm.editForm, name_placeholder: e.target.value })} className="h-9 text-sm rounded-xl" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Description Placeholder</Label>
                  <Input value={cm.editForm.description_placeholder} onChange={(e) => cm.setEditForm({ ...cm.editForm, description_placeholder: e.target.value })} className="h-9 text-sm rounded-xl" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Price Label</Label>
                    <Input value={cm.editForm.price_label} onChange={(e) => cm.setEditForm({ ...cm.editForm, price_label: e.target.value })} className="h-9 text-sm rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Duration Label</Label>
                    <Input value={cm.editForm.duration_label} onChange={(e) => cm.setEditForm({ ...cm.editForm, duration_label: e.target.value })} className="h-9 text-sm rounded-xl" />
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl">
                  <span className="text-xs font-medium">Show Veg/Non-Veg Toggle</span>
                  <Switch checked={cm.editForm.show_veg_toggle} onCheckedChange={(v) => cm.setEditForm({ ...cm.editForm, show_veg_toggle: v })} />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl">
                  <span className="text-xs font-medium">Show Duration Field</span>
                  <Switch checked={cm.editForm.show_duration_field} onCheckedChange={(v) => cm.setEditForm({ ...cm.editForm, show_duration_field: v })} />
                </div>
              </div>
            </div>
            <Button onClick={cm.saveEditedCategory} disabled={cm.isSaving} className="w-full rounded-xl h-11 font-semibold">
              {cm.isSaving && <Loader2 className="animate-spin mr-2" size={16} />}Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add Category Dialog ── */}
      <Dialog open={cm.isAddDialogOpen} onOpenChange={cm.setIsAddDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-bold">Add Category to {cm.addingToGroup}</DialogTitle>
            <DialogDescription className="text-xs">Create a new category under this group.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Display Name</Label>
              <Input value={cm.addForm.display_name} onChange={(e) => cm.setAddForm({ ...cm.addForm, display_name: e.target.value })} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Icon (Emoji)</Label>
              <Input value={cm.addForm.icon} onChange={(e) => cm.setAddForm({ ...cm.addForm, icon: e.target.value })} className="text-2xl rounded-xl" />
              <div className="flex flex-wrap gap-1.5 mt-1">
                {EMOJI_PRESETS.slice(0, 24).map((emoji) => (
                  <button key={emoji} type="button" onClick={() => cm.setAddForm({ ...cm.addForm, icon: emoji })} className={cn('w-8 h-8 rounded-lg text-lg flex items-center justify-center hover:bg-muted transition-colors', cm.addForm.icon === emoji && 'bg-primary/15 ring-1 ring-primary')}>
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Color</Label>
              <Select value={cm.addForm.color} onValueChange={(value) => cm.setAddForm({ ...cm.addForm, color: value })}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLOR_PRESETS.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      <div className="flex items-center gap-2"><div className={cn('w-4 h-4 rounded', color.value)} />{color.label}</div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={cm.saveNewCategory} disabled={cm.isSaving} className="w-full rounded-xl h-11 font-semibold">
              {cm.isSaving ? <><Loader2 className="animate-spin mr-2" size={16} />Saving...</> : 'Add Category'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Category Confirmation ── */}
      <AlertDialog open={!!cm.deleteCategory} onOpenChange={(open) => !open && cm.setDeleteCategory(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold">Delete "{cm.deleteCategory?.display_name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              If sellers are using this category, it will be disabled instead of deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={cm.confirmDeleteCategory} disabled={cm.isDeleting} className="bg-destructive text-destructive-foreground rounded-xl">
              {cm.isDeleting ? <Loader2 className="animate-spin mr-1" size={14} /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Group Add/Edit Dialog ── */}
      <Dialog open={cm.isGroupDialogOpen} onOpenChange={(open) => { if (!open) { cm.setIsGroupDialogOpen(false); cm.setEditingGroup(null); } }}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-bold">{cm.editingGroup ? 'Edit Group' : 'Add Group'}</DialogTitle>
            <DialogDescription className="text-xs">
              {cm.editingGroup ? 'Update this category group.' : 'Create a new top-level category group.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Group Name *</Label>
              <Input value={cm.groupForm.name} onChange={(e) => cm.setGroupForm({ ...cm.groupForm, name: e.target.value })} placeholder="e.g. Pet Services" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Icon (Emoji) *</Label>
              <Input value={cm.groupForm.icon} onChange={(e) => cm.setGroupForm({ ...cm.groupForm, icon: e.target.value })} className="text-2xl rounded-xl" />
              <div className="flex flex-wrap gap-1.5 mt-1">
                {EMOJI_PRESETS.slice(0, 24).map((emoji) => (
                  <button key={emoji} type="button" onClick={() => cm.setGroupForm({ ...cm.groupForm, icon: emoji })} className={cn('w-8 h-8 rounded-lg text-lg flex items-center justify-center hover:bg-muted transition-colors', cm.groupForm.icon === emoji && 'bg-primary/15 ring-1 ring-primary')}>
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Color</Label>
              <Select value={cm.groupForm.color} onValueChange={(value) => cm.setGroupForm({ ...cm.groupForm, color: value })}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLOR_PRESETS.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      <div className="flex items-center gap-2"><div className={cn('w-4 h-4 rounded', color.value)} />{color.label}</div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Description</Label>
              <Input value={cm.groupForm.description} onChange={(e) => cm.setGroupForm({ ...cm.groupForm, description: e.target.value })} placeholder="Short description" className="rounded-xl" />
            </div>
            <Button onClick={cm.saveGroup} disabled={cm.isSaving} className="w-full rounded-xl h-11 font-semibold">
              {cm.isSaving ? <><Loader2 className="animate-spin mr-2" size={16} />Saving...</> : cm.editingGroup ? 'Save Group' : 'Create Group'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Group Confirmation ── */}
      <AlertDialog open={!!cm.deleteGroup} onOpenChange={(open) => !open && cm.setDeleteGroup(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-bold">Delete group "{cm.deleteGroup?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will also remove all categories under this group. If sellers are using it, the group will be disabled instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={cm.confirmDeleteGroup} disabled={cm.isDeletingGroup} className="bg-destructive text-destructive-foreground rounded-xl">
              {cm.isDeletingGroup ? <Loader2 className="animate-spin mr-1" size={14} /> : null}
              Delete Group
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
