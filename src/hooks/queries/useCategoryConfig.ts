import { useQuery } from '@tanstack/react-query';
import { jitteredStaleTime } from '@/lib/query-utils';
import { fetchCategoryConfigs } from '@/hooks/useCategoryBehavior';

export function useCategoryConfig() {
  return useQuery({
    queryKey: ['category-configs'], // Shared cache key with useCategoryConfigs
    queryFn: fetchCategoryConfigs,
    staleTime: jitteredStaleTime(10 * 60 * 1000), // 10 min + jitter to prevent stampede
  });
}
