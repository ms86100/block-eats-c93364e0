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
  | 'vehicle_parking'
  | 'resident_identity_verification';

export type FeatureState = 'enabled' | 'disabled' | 'locked' | 'unavailable';

interface EffectiveFeature {
  feature_key: string;
  is_enabled: boolean;
  source: string; // 'core' | 'package' | 'override' | 'default'
  society_configurable: boolean;
}

export function useEffectiveFeatures() {
  const { effectiveSocietyId } = useAuth();
  const queryClient = useQueryClient();

  const { data: features = [], isLoading } = useQuery({
    queryKey: ['effective-features', effectiveSocietyId],
    queryFn: async () => {
      if (!effectiveSocietyId) return [];
      const { data, error } = await supabase.rpc('get_effective_society_features', {
        _society_id: effectiveSocietyId,
      });
      if (error) {
        console.error('Error fetching effective features:', error);
        return [];
      }
      return (data || []) as EffectiveFeature[];
    },
    enabled: !!effectiveSocietyId,
    staleTime: 5 * 60 * 1000,
  });

  const featureMap = new Map(features.map(f => [f.feature_key, f]));

  const isFeatureEnabled = (key: FeatureKey): boolean => {
    const feature = featureMap.get(key);
    // Backward compat: if no data returned (no builder, no features seeded), default enabled
    if (!feature) return features.length === 0 ? true : false;
    return feature.is_enabled;
  };

  const getFeatureState = (key: FeatureKey): FeatureState => {
    const feature = featureMap.get(key);
    if (!feature) return features.length === 0 ? 'enabled' : 'unavailable';
    if (feature.source === 'core') return 'locked';
    if (!feature.society_configurable) return feature.is_enabled ? 'locked' : 'disabled';
    return feature.is_enabled ? 'enabled' : 'disabled';
  };

  const getFeatureSource = (key: FeatureKey): string => {
    return featureMap.get(key)?.source || 'default';
  };

  const isConfigurable = (key: FeatureKey): boolean => {
    const feature = featureMap.get(key);
    if (!feature) return false;
    if (feature.source === 'core') return false;
    return feature.society_configurable;
  };

  const toggleFeature = useMutation({
    mutationFn: async ({ key, enabled }: { key: FeatureKey; enabled: boolean }) => {
      if (!effectiveSocietyId) throw new Error('No society');
      
      // Get feature_id from platform_features
      const { data: pf } = await supabase
        .from('platform_features')
        .select('id')
        .eq('feature_key', key)
        .single();
      
      if (!pf) throw new Error('Feature not found');

      const { data: { user } } = await supabase.auth.getUser();
      
      // Upsert into society_feature_overrides
      const { error } = await supabase
        .from('society_feature_overrides')
        .upsert({
          society_id: effectiveSocietyId,
          feature_id: pf.id,
          is_enabled: enabled,
          overridden_by: user?.id,
          overridden_at: new Date().toISOString(),
        }, { onConflict: 'society_id,feature_id' });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['effective-features', effectiveSocietyId] });
    },
  });

  return {
    features,
    isLoading,
    isFeatureEnabled,
    getFeatureState,
    getFeatureSource,
    isConfigurable,
    toggleFeature,
  };
}
