import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type FeatureKey =
  | 'marketplace'
  | 'bulletin'
  | 'disputes'
  | 'finances'
  | 'construction_progress'
  | 'snag_management'
  | 'help_requests'
  | 'visitor_management'
  | 'domestic_help'
  | 'parcel_management'
  | 'inspection'
  | 'payment_milestones'
  | 'maintenance'
  | 'guard_kiosk'
  | 'vehicle_parking';

interface SocietyFeature {
  id: string;
  society_id: string;
  feature_key: string;
  is_enabled: boolean;
  config: Record<string, any>;
}

export function useSocietyFeatures() {
  const { effectiveSocietyId } = useAuth();
  const queryClient = useQueryClient();

  const { data: features = [], isLoading } = useQuery({
    queryKey: ['society-features', effectiveSocietyId],
    queryFn: async () => {
      if (!effectiveSocietyId) return [];
      const { data } = await supabase
        .from('society_features')
        .select('*')
        .eq('society_id', effectiveSocietyId);
      return (data || []) as SocietyFeature[];
    },
    enabled: !!effectiveSocietyId,
    staleTime: 5 * 60 * 1000,
  });

  const isFeatureEnabled = (key: FeatureKey): boolean => {
    const feature = features.find(f => f.feature_key === key);
    // Default to enabled if no record exists
    return feature ? feature.is_enabled : true;
  };

  const toggleFeature = useMutation({
    mutationFn: async ({ key, enabled }: { key: FeatureKey; enabled: boolean }) => {
      if (!effectiveSocietyId) throw new Error('No society');
      const existing = features.find(f => f.feature_key === key);
      if (existing) {
        await supabase
          .from('society_features')
          .update({ is_enabled: enabled })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('society_features')
          .insert({
            society_id: effectiveSocietyId,
            feature_key: key,
            is_enabled: enabled,
          });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['society-features', effectiveSocietyId] });
    },
  });

  return { features, isLoading, isFeatureEnabled, toggleFeature };
}
