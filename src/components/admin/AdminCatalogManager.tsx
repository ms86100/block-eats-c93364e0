import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useCategoryConfig } from '@/hooks/queries/useCategoryConfig';
import { CategoryManager } from '@/components/admin/CategoryManager';
import { SubcategoryManager } from '@/components/admin/SubcategoryManager';
import { AdminAttributeBlockManager } from '@/components/admin/AdminAttributeBlockManager';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Layers3, Grid3X3, Blocks } from 'lucide-react';

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

  useEffect(() => {
    fetchBlocks();
  }, []);

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

  const isLoading = categoriesLoading || blocksLoading;

  return (
    <div className="space-y-3">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="overview" className="text-xs gap-1">
            <Layers3 size={12} /> Overview
          </TabsTrigger>
          <TabsTrigger value="categories" className="text-xs gap-1">
            <Grid3X3 size={12} /> Categories
          </TabsTrigger>
          <TabsTrigger value="attributes" className="text-xs gap-1">
            <Blocks size={12} /> Attributes
          </TabsTrigger>
        </TabsList>

        {/* Overview — category cards with linked attribute badges */}
        <TabsContent value="overview" className="mt-3">
          <p className="text-xs text-muted-foreground mb-3">
            Categories and their linked attribute blocks. Tap a category to expand.
          </p>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {(categories as any[]).map((cat: any) => {
                  const linkedBlocks = getBlocksForCategory(cat.category);
                  const isExpanded = expandedCategory === cat.category;

                  return (
                    <motion.div
                      key={cat.category}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Card
                        className="cursor-pointer transition-shadow hover:shadow-md border-border/60"
                        onClick={() => toggleExpand(cat.category)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-lg shrink-0">{cat.icon}</span>
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">
                                  {cat.display_name}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {linkedBlocks.length} attribute block{linkedBlocks.length !== 1 ? 's' : ''}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {linkedBlocks.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {linkedBlocks.slice(0, 3).map(b => (
                                    <Badge
                                      key={b.id}
                                      variant="secondary"
                                      className="text-[9px] px-1.5 py-0.5 h-auto"
                                    >
                                      {b.icon} {b.display_name}
                                    </Badge>
                                  ))}
                                  {linkedBlocks.length > 3 && (
                                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0.5 h-auto">
                                      +{linkedBlocks.length - 3} more
                                    </Badge>
                                  )}
                                </div>
                              )}
                              <motion.div
                                animate={{ rotate: isExpanded ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <ChevronDown size={14} className="text-muted-foreground" />
                              </motion.div>
                            </div>
                          </div>

                          {/* Expanded: show block details */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-3 pt-3 border-t border-border/40 space-y-1.5">
                                  {linkedBlocks.length === 0 ? (
                                    <p className="text-xs text-muted-foreground italic">
                                      No attribute blocks linked to this category yet.
                                    </p>
                                  ) : (
                                    linkedBlocks.map((block, idx) => (
                                      <motion.div
                                        key={block.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.05, duration: 0.15 }}
                                        className="flex items-center gap-2 p-1.5 rounded-md bg-muted/30"
                                      >
                                        <span className="text-sm shrink-0">{block.icon || '📦'}</span>
                                        <div className="min-w-0 flex-1">
                                          <p className="text-xs font-medium truncate">{block.display_name}</p>
                                          {block.description && (
                                            <p className="text-[10px] text-muted-foreground line-clamp-1">{block.description}</p>
                                          )}
                                        </div>
                                        <Badge variant="outline" className="text-[8px] shrink-0">
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
        <TabsContent value="categories" className="mt-3 space-y-4">
          <CategoryManager />
          <SubcategoryManager />
        </TabsContent>

        {/* Attributes sub-tab */}
        <TabsContent value="attributes" className="mt-3">
          <AdminAttributeBlockManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
