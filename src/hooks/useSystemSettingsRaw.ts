import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { jitteredStaleTime } from '@/lib/query-utils';

/**
 * Fetch arbitrary system_settings keys by their raw key name.
 * Returns a getter function for flexible, dynamic key lookup.
 */
export function useSystemSettingsRaw(keys: string[]) {
  const { data: settingsMap = {} } = useQuery({
    queryKey: ['system-settings-raw', ...keys],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', keys);
      if (error) {
        console.error('Error fetching system settings:', error);
        return {};
      }
      const map: Record<string, string> = {};
      for (const row of data || []) {
        if (row.key && row.value) map[row.key] = row.value;
      }
      return map;
    },
    staleTime: jitteredStaleTime(15 * 60 * 1000),
    enabled: keys.length > 0,
  });

  return {
    getSetting: (key: string) => settingsMap[key] || '',
    settingsMap,
  };
}
