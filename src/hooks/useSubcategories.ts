import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { jitteredStaleTime } from '@/lib/query-utils';

export interface Subcategory {
  id: string;
  category_config_id: string;
  slug: string;
  display_name: string;
  display_order: number | null;
  icon: string | null;
  is_active: boolean;
}

export function useSubcategories(categoryConfigId?: string | null) {
  return useQuery({
    queryKey: ['subcategories', categoryConfigId || 'all'],
    queryFn: async () => {
      let q = supabase
        .from('subcategories')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (categoryConfigId) {
        q = q.eq('category_config_id', categoryConfigId);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Subcategory[];
    },
    staleTime: jitteredStaleTime(10 * 60 * 1000),
    enabled: true,
  });
}
