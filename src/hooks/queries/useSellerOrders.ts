import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const PAGE_SIZE = 20;

interface SellerOrderStats {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  preparingOrders: number;
  readyOrders: number;
  todayOrders: number;
  totalEarnings: number;
  todayEarnings: number;
  weekEarnings: number;
}

export function useSellerOrderStats(sellerId: string | null) {
  return useQuery({
    queryKey: ['seller-order-stats', sellerId],
    queryFn: async (): Promise<SellerOrderStats> => {
      // Use count queries instead of downloading all rows
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const weekISO = weekStart.toISOString();

      const [
        { count: totalOrders },
        { count: pendingOrders },
        { count: completedOrders },
        { count: preparingOrders },
        { count: readyOrders },
        { count: todayOrders },
        { data: earningsData },
        { data: todayEarningsData },
        { data: weekEarningsData },
      ] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('seller_id', sellerId!),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('seller_id', sellerId!).not('status', 'in', '("completed","cancelled")'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('seller_id', sellerId!).eq('status', 'completed'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('seller_id', sellerId!).eq('status', 'preparing'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('seller_id', sellerId!).eq('status', 'ready'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('seller_id', sellerId!).gte('created_at', todayISO),
        supabase.from('orders').select('total_amount').eq('seller_id', sellerId!).eq('status', 'completed'),
        supabase.from('orders').select('total_amount').eq('seller_id', sellerId!).eq('status', 'completed').gte('created_at', todayISO),
        supabase.from('orders').select('total_amount').eq('seller_id', sellerId!).eq('status', 'completed').gte('created_at', weekISO),
      ]);

      const sum = (data: any[] | null) => (data || []).reduce((s, o) => s + Number(o.total_amount), 0);

      return {
        totalOrders: totalOrders || 0,
        pendingOrders: pendingOrders || 0,
        completedOrders: completedOrders || 0,
        preparingOrders: preparingOrders || 0,
        readyOrders: readyOrders || 0,
        todayOrders: todayOrders || 0,
        totalEarnings: sum(earningsData),
        todayEarnings: sum(todayEarningsData),
        weekEarnings: sum(weekEarningsData),
      };
    },
    enabled: !!sellerId,
    staleTime: 0,
  });
}

export function useSellerOrdersInfinite(sellerId: string | null, filter: string = 'all') {
  return useInfiniteQuery({
    queryKey: ['seller-orders', sellerId, filter],
    queryFn: async ({ pageParam }) => {
      let query = supabase
        .from('orders')
        .select(`*, buyer:profiles!orders_buyer_id_fkey(name, block, flat_number), items:order_items(id, product_name, quantity, unit_price, status)`)
        .eq('seller_id', sellerId!)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      // Apply filter
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      switch (filter) {
        case 'today':
          query = query.gte('created_at', today.toISOString());
          break;
        case 'pending':
          query = query.in('status', ['placed', 'accepted']);
          break;
        case 'preparing':
          query = query.eq('status', 'preparing');
          break;
        case 'ready':
          query = query.eq('status', 'ready');
          break;
        case 'completed':
          query = query.eq('status', 'completed');
          break;
      }

      if (pageParam) {
        query = query.lt('created_at', pageParam);
      }

      const { data } = await query;
      return (data as any[]) || [];
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return lastPage[lastPage.length - 1]?.created_at;
    },
    enabled: !!sellerId,
    staleTime: 0,
  });
}

export function useSellerOrderFilterCounts(sellerId: string | null) {
  return useQuery({
    queryKey: ['seller-order-filter-counts', sellerId],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      const [all, todayCount, pending, preparing, ready, completed] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('seller_id', sellerId!),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('seller_id', sellerId!).gte('created_at', todayISO),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('seller_id', sellerId!).in('status', ['placed', 'accepted']),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('seller_id', sellerId!).eq('status', 'preparing'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('seller_id', sellerId!).eq('status', 'ready'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('seller_id', sellerId!).eq('status', 'completed'),
      ]);

      return {
        all: all.count || 0,
        today: todayCount.count || 0,
        pending: pending.count || 0,
        preparing: preparing.count || 0,
        ready: ready.count || 0,
        completed: completed.count || 0,
      };
    },
    enabled: !!sellerId,
    staleTime: 0,
  });
}
