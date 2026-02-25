import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useCategoryConfig } from '@/hooks/queries/useCategoryConfig';
import { useParentGroups } from '@/hooks/useParentGroups';
import { useSubcategories } from '@/hooks/useSubcategories';
import { CategoryManager } from '@/components/admin/CategoryManager';
import { SubcategoryManager } from '@/components/admin/SubcategoryManager';
import { AdminAttributeBlockManager } from '@/components/admin/AdminAttributeBlockManager';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Layers3, Grid3X3, Blocks, TreePine } from 'lucide-react';

interface AttributeBlock {
  id: string;
  block_type: string;
  display_name: string;
  description: string | null;
  icon: string | null;
  category_hints: string[] | null;
  renderer_type: string;
  is_active: boolean;
}

export function AdminCatalogManager() {
  const [subTab, setSubTab] = useState('overview');
  const [blocks, setBlocks] = useState<AttributeBlock[]>([]);
  const [blocksLoading, setBlocksLoading] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const { data: categories = [], isLoading: categoriesLoading } = useCategoryConfig();
  const { groups: parentGroups, isLoading: groupsLoading } = useParentGroups();
  const { data: subcategories = [], isLoading: subcatsLoading } = useSubcategories();
  const [taxonomyOpen, setTaxonomyOpen] = useState(false);
  useEffect(() => { fetchBlocks(); }, []);

  const fetchBlocks = async () => {
    setBlocksLoading(true);
    const { data } = await supabase
      .from('attribute_block_library')
      .select('id, block_type, display_name, description, icon, category_hints, renderer_type, is_active')
      .eq('is_active', true)
      .order('display_order');
    setBlocks((data || []) as unknown as AttributeBlock[]);
    setBlocksLoading(false);
  };

  const getBlocksForCategory = (categorySlug: string) =>
    blocks.filter(b => (b.category_hints || []).includes(categorySlug));

  const toggleExpand = (slug: string) =>
    setExpandedCategory(prev => prev === slug ? null : slug);

  const isLoading = categoriesLoading || blocksLoading || groupsLoading || subcatsLoading;

  // Build taxonomy tree data
  const taxonomyTree = parentGroups.map(group => {
    const groupCats = (categories as any[]).filter((c: any) => c.parentGroup === group.slug || c.parent_group === group.slug);
    return {
      ...group,
      categories: groupCats.map((cat: any) => ({
        ...cat,
        subcategories: subcategories.filter(sub => sub.category_config_id === cat.id),
      })),
    };
  });
  const TAB_ITEMS = [
    { value: 'overview', label: 'Overview', icon: Layers3 },
    { value: 'categories', label: 'Categories (under Groups)', icon: Grid3X3 },
    { value: 'attributes', label: 'Attributes', icon: Blocks },
  ];

  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="w-full grid grid-cols-3 bg-muted/60 p-1 rounded-2xl">
          {TAB_ITEMS.map(tab => {
            const TabIcon = tab.icon;
            return (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs gap-1.5 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:font-semibold transition-all duration-200">
                <TabIcon size={12} /> {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Taxonomy Overview Tree */}
        <Collapsible open={taxonomyOpen} onOpenChange={setTaxonomyOpen} className="mt-3">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 w-full p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors text-left">
              <TreePine size={14} className="text-primary shrink-0" />
              <span className="text-xs font-bold flex-1">Taxonomy Overview</span>
              <Badge variant="secondary" className="text-[9px] rounded-md">
                {parentGroups.length}G · {(categories as any[]).length}C · {subcategories.length}S
              </Badge>
              <motion.div animate={{ rotate: taxonomyOpen ? 90 : 0 }} transition={{ duration: 0.15 }}>
                <ChevronRight size={14} className="text-muted-foreground" />
              </motion.div>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 p-3 rounded-xl bg-muted/20 border border-border/30 text-xs font-mono space-y-0.5 max-h-[300px] overflow-y-auto">
              {taxonomyTree.map((group, gi) => (
                <div key={group.id}>
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    <span>{group.icon}</span>
                    <span>{group.name}</span>
                    <span className="text-muted-foreground font-normal">(Group)</span>
                  </div>
                  {group.categories.length === 0 && (
                    <div className="ml-5 text-muted-foreground italic">No categories</div>
                  )}
                  {group.categories.map((cat: any, ci: number) => (
                    <div key={cat.id} className="ml-5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">{ci === group.categories.length - 1 ? '└──' : '├──'}</span>
                        <span>{cat.icon}</span>
                        <span className="font-medium">{cat.displayName || cat.display_name}</span>
                        <span className="text-muted-foreground font-normal">(Category)</span>
                      </div>
                      {cat.subcategories.map((sub: any, si: number) => (
                        <div key={sub.id} className="ml-8 flex items-center gap-1.5">
                          <span className="text-muted-foreground">{si === cat.subcategories.length - 1 ? '└──' : '├──'}</span>
                          <span>{sub.icon || '📂'}</span>
                          <span>{sub.display_name}</span>
                          <span className="text-muted-foreground font-normal">(Sub)</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
              {taxonomyTree.length === 0 && (
                <p className="text-muted-foreground italic">No taxonomy data yet.</p>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Overview — category cards with linked attribute badges */}
        <TabsContent value="overview" className="mt-4">
          <p className="text-xs text-muted-foreground mb-3 font-medium">
            Categories and their linked attribute blocks. Tap a category to expand.
          </p>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {(categories as any[]).map((cat: any, idx: number) => {
                  const linkedBlocks = getBlocksForCategory(cat.category);
                  const isExpanded = expandedCategory === cat.category;

                  return (
                    <motion.div
                      key={cat.category}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2, delay: idx * 0.02 }}
                    >
                      <Card
                        className="cursor-pointer border-0 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-md)] transition-all duration-300 rounded-2xl"
                        onClick={() => toggleExpand(cat.category)}
                      >
                        <CardContent className="p-3.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="text-lg shrink-0">{cat.icon}</span>
                              <div className="min-w-0">
                                <p className="font-semibold text-sm truncate">
                                  {cat.displayName || cat.display_name}
                                </p>
                                <p className="text-[10px] text-muted-foreground font-medium">
                                  {linkedBlocks.length} attribute block{linkedBlocks.length !== 1 ? 's' : ''}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {linkedBlocks.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {linkedBlocks.slice(0, 3).map(b => (
                                    <Badge key={b.id} variant="secondary" className="text-[9px] px-1.5 py-0.5 h-auto rounded-md">
                                      {b.icon} {b.display_name}
                                    </Badge>
                                  ))}
                                  {linkedBlocks.length > 3 && (
                                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0.5 h-auto rounded-md">
                                      +{linkedBlocks.length - 3}
                                    </Badge>
                                  )}
                                </div>
                              )}
                              <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                                <ChevronDown size={14} className="text-muted-foreground" />
                              </motion.div>
                            </div>
                          </div>

                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-3 pt-3 border-t border-border/30 space-y-1.5">
                                  {linkedBlocks.length === 0 ? (
                                    <p className="text-xs text-muted-foreground italic">
                                      No attribute blocks linked to this category yet.
                                    </p>
                                  ) : (
                                    linkedBlocks.map((block, bidx) => (
                                      <motion.div
                                        key={block.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: bidx * 0.05, duration: 0.15 }}
                                        className="flex items-center gap-2 p-2 rounded-xl bg-muted/30"
                                      >
                                        <span className="text-sm shrink-0">{block.icon || '📦'}</span>
                                        <div className="min-w-0 flex-1">
                                          <p className="text-xs font-semibold truncate">{block.display_name}</p>
                                          {block.description && (
                                            <p className="text-[10px] text-muted-foreground line-clamp-1">{block.description}</p>
                                          )}
                                        </div>
                                        <Badge variant="outline" className="text-[8px] shrink-0 rounded-md">
                                          {block.renderer_type}
                                        </Badge>
                                      </motion.div>
                                    ))
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>

        {/* Categories sub-tab */}
        <TabsContent value="categories" className="mt-4 space-y-4">
          <CategoryManager />
          <SubcategoryManager />
        </TabsContent>

        {/* Attributes sub-tab */}
        <TabsContent value="attributes" className="mt-4">
          <AdminAttributeBlockManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
