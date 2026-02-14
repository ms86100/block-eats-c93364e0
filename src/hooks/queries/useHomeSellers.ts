import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SellerProfile } from '@/types/database';

const SELLER_SELECT = `*, profile:profiles!seller_profiles_user_id_fkey(name, block)`;

export function useOpenNowSellers() {
  const { profile, isApproved, effectiveSocietyId } = useAuth();
  return useQuery({
    queryKey: ['sellers', 'open-now', effectiveSocietyId],
    queryFn: async () => {
      const query = supabase
        .from('seller_profiles')
        .select(SELLER_SELECT)
        .eq('verification_status', 'approved')
        .eq('is_available', true)
        .order('rating', { ascending: false })
        .limit(6);

      const { data } = effectiveSocietyId
        ? await query.eq('society_id', effectiveSocietyId)
        : await query;

      return (data as any[]) || [];
    },
    enabled: !!isApproved && !!effectiveSocietyId,
    staleTime: 30_000,
  });
}

export function useNearbyBlockSellers() {
  const { profile, isApproved, effectiveSocietyId } = useAuth();
  return useQuery({
    queryKey: ['sellers', 'nearby', effectiveSocietyId, profile?.block],
    queryFn: async () => {
      if (!profile?.block || !effectiveSocietyId) return [];
      const { data } = await supabase
        .from('seller_profiles')
        .select(SELLER_SELECT)
        .eq('verification_status', 'approved')
        .eq('society_id', effectiveSocietyId)
        .order('rating', { ascending: false })
        .limit(5);

      // Filter by block via the joined profile
      return ((data as any[]) || []).filter(
        (s: any) => s.profile?.block === profile.block
      ) as SellerProfile[];
    },
    enabled: !!isApproved && !!effectiveSocietyId && !!profile?.block,
    staleTime: 30_000,
  });
}

export function useTopRatedSellers() {
  const { isApproved, effectiveSocietyId } = useAuth();
  return useQuery({
    queryKey: ['sellers', 'top-rated', effectiveSocietyId],
    queryFn: async () => {
      const { data } = await supabase
        .from('seller_profiles')
        .select(SELLER_SELECT)
        .eq('verification_status', 'approved')
        .eq('society_id', effectiveSocietyId!)
        .gte('rating', 4)
        .order('rating', { ascending: false })
        .limit(5);

      return (data as any[]) || [];
    },
    enabled: !!isApproved && !!effectiveSocietyId,
    staleTime: 30_000,
  });
}

export function useFeaturedSellers() {
  const { isApproved, effectiveSocietyId } = useAuth();
  return useQuery({
    queryKey: ['sellers', 'featured', effectiveSocietyId],
    queryFn: async () => {
      const { data } = await supabase
        .from('seller_profiles')
        .select(SELLER_SELECT)
        .eq('verification_status', 'approved')
        .eq('society_id', effectiveSocietyId!)
        .eq('is_featured', true)
        .limit(5);

      return (data as any[]) || [];
    },
    enabled: !!isApproved && !!effectiveSocietyId,
    staleTime: 30_000,
  });
}

export function useFavoriteSellers() {
  const { user, isApproved } = useAuth();
  return useQuery({
    queryKey: ['sellers', 'favorites', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('favorites')
        .select(`seller:seller_profiles(*, profile:profiles!seller_profiles_user_id_fkey(name, block))`)
        .eq('user_id', user!.id)
        .limit(5);

      return (
        (data as any[])
          ?.map((f) => f.seller)
          .filter((s: any) => s && s.verification_status === 'approved') || []
      ) as SellerProfile[];
    },
    enabled: !!isApproved && !!user?.id,
    staleTime: 30_000,
  });
}
