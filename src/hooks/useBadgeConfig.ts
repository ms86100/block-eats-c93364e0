import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BadgeConfigRow {
  id: string;
  tag_key: string;
  badge_label: string;
  color: string;
  priority: number;
  layout_visibility: string[];
  is_active: boolean;
}

/**
 * Fetches badge_config from DB — sorted by priority.
 * Used by ProductListingCard to render badges purely from DB config.
 */
export function useBadgeConfig() {
  const { data: badges = [], isLoading } = useQuery({
    queryKey: ['badge-config'],
    queryFn: async (): Promise<BadgeConfigRow[]> => {
      const { data, error } = await supabase
        .from('badge_config')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: true });

      if (error) {
        console.error('Failed to fetch badge config:', error);
        return [];
      }
      return (data as BadgeConfigRow[]) || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  return { badges, isLoading };
}
