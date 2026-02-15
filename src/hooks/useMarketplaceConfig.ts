import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * System-wide marketplace config from system_settings + admin_settings.
 * Single source of truth — no frontend defaults for business logic.
 */
export interface MarketplaceConfig {
  lowStockThreshold: number;
  currencySymbol: string;
  defaultCurrency: string;
  maxBadgesPerCard: number;
  enableScarcity: boolean;
  enablePulseAnimation: boolean;
  fulfillmentLabels: Record<string, string>;
}

const FALLBACKS: MarketplaceConfig = {
  lowStockThreshold: 5,
  currencySymbol: '₹',
  defaultCurrency: 'INR',
  maxBadgesPerCard: 2,
  enableScarcity: true,
  enablePulseAnimation: true,
  fulfillmentLabels: {
    delivery: '🚚 Delivery',
    self_pickup: '📍 Pickup',
    both: '🚚 Delivery & Pickup',
  },
};

export function useMarketplaceConfig(): MarketplaceConfig {
  const { data: config = FALLBACKS } = useQuery({
    queryKey: ['marketplace-config-v2'],
    queryFn: async (): Promise<MarketplaceConfig> => {
      // Fetch from both tables in parallel
      const [sysResult, adminResult] = await Promise.all([
        supabase.from('system_settings').select('key, value'),
        supabase
          .from('admin_settings')
          .select('key, value')
          .in('key', ['fulfillment_labels'])
          .eq('is_active', true),
      ]);

      const sysMap: Record<string, string> = {};
      for (const row of sysResult.data || []) {
        if (row.key && row.value) sysMap[row.key] = row.value;
      }

      const adminMap: Record<string, string> = {};
      for (const row of adminResult.data || []) {
        if (row.key && row.value) adminMap[row.key] = row.value;
      }

      let fulfillmentLabels = FALLBACKS.fulfillmentLabels;
      try {
        if (adminMap.fulfillment_labels) {
          fulfillmentLabels = JSON.parse(adminMap.fulfillment_labels);
        }
      } catch { /* use fallbacks */ }

      return {
        lowStockThreshold: parseInt(sysMap.low_stock_threshold || '5', 10) || 5,
        currencySymbol: sysMap.currency_symbol || '₹',
        defaultCurrency: sysMap.default_currency || 'INR',
        maxBadgesPerCard: parseInt(sysMap.max_badges_per_card || '2', 10) || 2,
        enableScarcity: sysMap.enable_scarcity !== 'false',
        enablePulseAnimation: sysMap.enable_pulse_animation !== 'false',
        fulfillmentLabels,
      };
    },
    staleTime: 15 * 60 * 1000,
  });

  return config;
}
