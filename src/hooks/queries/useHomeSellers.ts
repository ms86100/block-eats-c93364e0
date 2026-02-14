import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SellerProfile } from '@/types/database';

const SELLER_SELECT = `*, profile:profiles!seller_profiles_user_id_fkey(name, block)`;

export function useOpenNowSellers() {
  const { profile, isApproved } = useAuth();
  return useQuery({
    queryKey: ['sellers', 'open-now', profile?.society_id],
    queryFn: async () => {
      const query = supabase
        .from('seller_profiles')
        .select(SELLER_SELECT)
        .eq('verification_status', 'approved')
        .eq('is_available', true)
        .order('rating', { ascending: false })
        .limit(6);

      const { data } = profile?.society_id
        ? await query.eq('society_id', profile.society_id)
        : await query;

      return (data as any[]) || [];
    },
    enabled: !!isApproved && !!profile?.society_id,
    staleTime: 30_000,
  });
}

export function useNearbyBlockSellers() {
  const { profile, isApproved } = useAuth();
  return useQuery({
    queryKey: ['sellers', 'nearby', profile?.society_id, profile?.block],
    queryFn: async () => {
      if (!profile?.block || !profile?.society_id) return [];
      const { data } = await supabase
        .from('seller_profiles')
        .select(SELLER_SELECT)
        .eq('verification_status', 'approved')
        .eq('society_id', profile.society_id)
        .order('rating', { ascending: false })
        .limit(5);

      // Filter by block via the joined profile
      return ((data as any[]) || []).filter(
        (s: any) => s.profile?.block === profile.block
      ) as SellerProfile[];
    },
    enabled: !!isApproved && !!profile?.society_id && !!profile?.block,
    staleTime: 30_000,
  });
}

export function useTopRatedSellers() {
  const { profile, isApproved } = useAuth();
  return useQuery({
    queryKey: ['sellers', 'top-rated', profile?.society_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('seller_profiles')
        .select(SELLER_SELECT)
        .eq('verification_status', 'approved')
        .eq('society_id', profile!.society_id!)
        .gte('rating', 4)
        .order('rating', { ascending: false })
        .limit(5);

      return (data as any[]) || [];
    },
    enabled: !!isApproved && !!profile?.society_id,
    staleTime: 30_000,
  });
}

export function useFeaturedSellers() {
  const { profile, isApproved } = useAuth();
  return useQuery({
    queryKey: ['sellers', 'featured', profile?.society_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('seller_profiles')
        .select(SELLER_SELECT)
        .eq('verification_status', 'approved')
        .eq('society_id', profile!.society_id!)
        .eq('is_featured', true)
        .limit(5);

      return (data as any[]) || [];
    },
    enabled: !!isApproved && !!profile?.society_id,
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
