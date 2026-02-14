import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Checks if the current user is a registered worker in the effective society.
 */
export function useWorkerRole() {
  const { profile, effectiveSocietyId } = useAuth();

  const { data: workerProfile = null, isLoading } = useQuery({
    queryKey: ['worker-profile', profile?.id, effectiveSocietyId],
    queryFn: async () => {
      if (!profile?.id || !effectiveSocietyId) return null;
      const { data, error } = await supabase
        .from('society_workers')
        .select('*')
        .eq('user_id', profile.id)
        .eq('society_id', effectiveSocietyId)
        .is('deactivated_at', null)
        .maybeSingle();
      if (error) {
        console.error('Error checking worker status:', error);
        return null;
      }
      return data;
    },
    enabled: !!profile?.id && !!effectiveSocietyId,
    staleTime: 5 * 60 * 1000,
  });

  return {
    isWorker: !!workerProfile,
    workerProfile,
    isLoading,
  };
}
