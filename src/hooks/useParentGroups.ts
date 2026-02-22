import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ParentGroupRow {
  id: string;
  slug: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  is_active: boolean;
  sort_order: number;
  layout_type: 'ecommerce' | 'food' | 'service';
  requires_license: boolean;
  license_mandatory: boolean;
  license_type_name: string | null;
  license_description: string | null;
  placeholder_hint: string | null;
  created_at: string;
  updated_at: string;
}

// Convenience type matching the old PARENT_GROUPS constant shape
export interface ParentGroupInfo {
  value: string;
  label: string;
  icon: string;
  color: string;
  description: string;
  layoutType: 'ecommerce' | 'food' | 'service';
}

export function useParentGroups() {
  const { data: groups = [], isLoading, refetch } = useQuery({
    queryKey: ['parent-groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parent_groups')
        .select('*')
        .order('sort_order');

      if (error) throw error;
      return (data as ParentGroupRow[]) || [];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes — this data rarely changes
  });

  // Map to the same shape as the old PARENT_GROUPS constant for easy migration
  const parentGroupInfos: ParentGroupInfo[] = useMemo(() => {
    return groups.map((g) => ({
      value: g.slug,
      label: g.name,
      icon: g.icon,
      color: g.color,
      description: g.description,
      layoutType: (g.layout_type as 'ecommerce' | 'food' | 'service') || 'ecommerce',
    }));
  }, [groups]);

  // Find a single group by slug
  const getGroupBySlug = (slug: string | null): ParentGroupInfo | undefined => {
    if (!slug) return undefined;
    return parentGroupInfos.find((g) => g.value === slug);
  };

  // Get layout type for a parent group slug
  const getLayoutType = (slug: string | null): 'ecommerce' | 'food' | 'service' => {
    if (!slug) return 'ecommerce';
    const group = groups.find((g) => g.slug === slug);
    return (group?.layout_type as 'ecommerce' | 'food' | 'service') || 'ecommerce';
  };

  // Build a slug -> layout_type map for fast lookups
  const layoutMap = useMemo(() => {
    const map: Record<string, 'ecommerce' | 'food' | 'service'> = {};
    for (const g of groups) {
      map[g.slug] = (g.layout_type as 'ecommerce' | 'food' | 'service') || 'ecommerce';
    }
    return map;
  }, [groups]);

  return {
    groups,
    parentGroupInfos,
    isLoading,
    refresh: refetch,
    getGroupBySlug,
    getLayoutType,
    layoutMap,
  };
}
