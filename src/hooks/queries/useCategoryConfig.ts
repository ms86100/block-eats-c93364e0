import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useCategoryConfig() {
  return useQuery({
    queryKey: ['category-config'],
    queryFn: async () => {
      const { data } = await supabase
        .from('category_config')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
