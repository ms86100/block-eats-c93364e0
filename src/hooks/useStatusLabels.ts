import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { jitteredStaleTime } from '@/lib/query-utils';
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  ITEM_STATUS_LABELS,
} from '@/types/database';

interface StatusLabel {
  label: string;
  color: string;
}

type StatusDomain = 'order_status' | 'payment_status' | 'item_status';

type StatusDisplayConfig = Record<StatusDomain, Record<string, StatusLabel>>;

const UNKNOWN_STATUS: StatusLabel = { label: 'Unknown', color: 'bg-gray-100 text-gray-600' };

/**
 * Hook that provides status display labels from the DB (system_settings)
 * with hardcoded fallbacks from types/database.ts.
 *
 * Usage:
 *   const { getOrderStatus, getPaymentStatus, getItemStatus } = useStatusLabels();
 *   const { label, color } = getOrderStatus('placed');
 */
export function useStatusLabels() {
  const { data: dbConfig } = useQuery({
    queryKey: ['status-display-config'],
    queryFn: async (): Promise<StatusDisplayConfig | null> => {
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'status_display_config')
        .maybeSingle();
      if (!data?.value) return null;
      try {
        return JSON.parse(data.value) as StatusDisplayConfig;
      } catch {
        return null;
      }
    },
    staleTime: jitteredStaleTime(30 * 60 * 1000),
  });

  const getOrderStatus = (status: string): StatusLabel => {
    return dbConfig?.order_status?.[status] ?? ORDER_STATUS_LABELS[status as keyof typeof ORDER_STATUS_LABELS] ?? UNKNOWN_STATUS;
  };

  const getPaymentStatus = (status: string): StatusLabel => {
    return dbConfig?.payment_status?.[status] ?? PAYMENT_STATUS_LABELS[status as keyof typeof PAYMENT_STATUS_LABELS] ?? UNKNOWN_STATUS;
  };

  const getItemStatus = (status: string): StatusLabel => {
    return dbConfig?.item_status?.[status] ?? ITEM_STATUS_LABELS[status as keyof typeof ITEM_STATUS_LABELS] ?? UNKNOWN_STATUS;
  };

  return { getOrderStatus, getPaymentStatus, getItemStatus };
}
