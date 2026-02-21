import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { jitteredStaleTime } from '@/lib/query-utils';

export interface LocalSeller {
  id: string;
  business_name: string;
  profile_image_url: string | null;
  rating: number;
  total_reviews: number;
  primary_group: string | null;
  categories: string[] | null;
  is_featured: boolean;
}

export interface NearbySeller {
  seller_id: string;
  business_name: string;
  profile_image_url: string | null;
  rating: number;
  total_reviews: number;
  primary_group: string | null;
  categories: string[] | null;
  society_name: string;
  distance_km: number;
  is_featured: boolean;
}

export interface DistanceBand {
  label: string;
  minKm: number;
  maxKm: number;
  societies: SocietyGroup[];
}

export interface SocietyGroup {
  societyName: string;
  distanceKm: number;
  sellersByGroup: Record<string, NearbySeller[]>;
}

export function useLocalSellers() {
  const { effectiveSocietyId, isApproved } = useAuth();

  return useQuery({
    queryKey: ['store-discovery', 'local', effectiveSocietyId],
    queryFn: async () => {
      if (!effectiveSocietyId) return {};

      const { data, error } = await supabase
        .from('seller_profiles')
        .select('id, business_name, profile_image_url, rating, total_reviews, primary_group, categories, is_featured, products!inner(id)')
        .eq('society_id', effectiveSocietyId)
        .eq('verification_status', 'approved')
        .eq('is_available', true)
        .eq('products.is_available', true)
        .eq('products.approval_status', 'approved')
        .order('is_featured', { ascending: false })
        .order('rating', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Local sellers error:', error);
        return {};
      }

      // Strip joined products and group by primary_group
      const cleaned = (data || []).map(({ products, ...rest }: any) => rest);
      const grouped: Record<string, LocalSeller[]> = {};
      for (const seller of cleaned) {
        const group = seller.primary_group || 'Other';
        if (!grouped[group]) grouped[group] = [];
        grouped[group].push(seller as LocalSeller);
      }
      return grouped;
    },
    enabled: !!isApproved && !!effectiveSocietyId,
    staleTime: jitteredStaleTime(60_000),
  });
}

export function useNearbySocietySellers(radiusKm: number = 5, enabled: boolean = true) {
  const { effectiveSocietyId, isApproved } = useAuth();

  return useQuery({
    queryKey: ['store-discovery', 'nearby', effectiveSocietyId, radiusKm],
    queryFn: async () => {
      if (!effectiveSocietyId) return [];

      const { data, error } = await supabase.rpc('search_nearby_sellers', {
        _buyer_society_id: effectiveSocietyId,
        _radius_km: radiusKm,
      });

      if (error) {
        console.error('Nearby sellers error:', error);
        return [];
      }

      const sellers = (data as NearbySeller[]) || [];

      const ALL_BANDS: { label: string; minKm: number; maxKm: number }[] = [
        { label: 'Within 2 km', minKm: 0, maxKm: 2 },
        { label: 'Within 5 km', minKm: 2, maxKm: 5 },
        { label: 'Within 10 km', minKm: 5, maxKm: 10 },
      ];
      const BANDS = ALL_BANDS.filter(b => b.minKm < radiusKm);

      const bands: DistanceBand[] = BANDS.map(band => {
        const bandSellers = sellers.filter(
          s => s.distance_km >= band.minKm && s.distance_km < band.maxKm
        );

        // Group by society
        const societyMap: Record<string, { distanceKm: number; sellers: NearbySeller[] }> = {};
        for (const s of bandSellers) {
          const key = s.society_name;
          if (!societyMap[key]) {
            societyMap[key] = { distanceKm: s.distance_km, sellers: [] };
          }
          societyMap[key].sellers.push(s);
        }

        const societies: SocietyGroup[] = Object.entries(societyMap).map(([name, info]) => {
          const sellersByGroup: Record<string, NearbySeller[]> = {};
          for (const seller of info.sellers) {
            const group = seller.primary_group || 'Other';
            if (!sellersByGroup[group]) sellersByGroup[group] = [];
            sellersByGroup[group].push(seller);
          }
          return { societyName: name, distanceKm: info.distanceKm, sellersByGroup };
        });

        return { ...band, societies };
      }).filter(band => band.societies.length > 0);

      return bands;
    },
    enabled: !!isApproved && !!effectiveSocietyId && enabled,
    staleTime: jitteredStaleTime(60_000),
  });
}
