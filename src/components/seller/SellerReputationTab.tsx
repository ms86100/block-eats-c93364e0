import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, XCircle, ShieldCheck, Clock, TrendingUp } from 'lucide-react';

interface SellerReputationTabProps {
  sellerId: string;
}

interface ReputationSummary {
  total_events: number;
  positive_events: number;
  negative_events: number;
  fulfillment_rate: number;
  recent_events: {
    event_type: string;
    is_positive: boolean;
    occurred_at: string;
  }[];
}

export function SellerReputationTab({ sellerId }: SellerReputationTabProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['seller-reputation', sellerId],
    queryFn: async (): Promise<ReputationSummary> => {
      const { data: events } = await supabase
        .from('seller_reputation_ledger')
        .select('event_type, is_positive, occurred_at')
        .eq('seller_id', sellerId)
        .order('occurred_at', { ascending: false })
        .limit(100);

      const all = events || [];
      const positive = all.filter(e => e.is_positive).length;
      const negative = all.filter(e => !e.is_positive).length;
      const total = all.length;
      const fulfillmentRate = total > 0 ? Math.round((positive / total) * 100) : 100;

      return {
        total_events: total,
        positive_events: positive,
        negative_events: negative,
        fulfillment_rate: fulfillmentRate,
        recent_events: all.slice(0, 10),
      };
    },
    enabled: !!sellerId,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return <div className="space-y-3 p-4"><Skeleton className="h-20 w-full rounded-xl" /><Skeleton className="h-32 w-full rounded-xl" /></div>;
  }

  if (!data || data.total_events === 0) {
    return (
      <div className="text-center py-8">
        <ShieldCheck className="mx-auto text-muted-foreground mb-2" size={28} />
        <p className="text-sm text-muted-foreground">No reputation history yet</p>
        <p className="text-xs text-muted-foreground mt-1">Events will appear as orders are completed</p>
      </div>
    );
  }

  const eventLabels: Record<string, { label: string; icon: typeof CheckCircle; color: string }> = {
    order_completed: { label: 'Order Completed', icon: CheckCircle, color: 'text-success' },
    order_cancelled: { label: 'Order Cancelled', icon: XCircle, color: 'text-destructive' },
    dispute_resolved: { label: 'Dispute Resolved', icon: ShieldCheck, color: 'text-success' },
    dispute_lost: { label: 'Dispute Lost', icon: XCircle, color: 'text-destructive' },
    response_fast: { label: 'Fast Response', icon: Clock, color: 'text-primary' },
    response_slow: { label: 'Slow Response', icon: Clock, color: 'text-warning' },
  };

  return (
    <div className="space-y-4 p-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <Card>
          <CardContent className="p-3 text-center">
            <TrendingUp size={16} className="mx-auto text-primary mb-1" />
            <p className="text-lg font-bold">{data.fulfillment_rate}%</p>
            <p className="text-[10px] text-muted-foreground">Fulfillment</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <CheckCircle size={16} className="mx-auto text-success mb-1" />
            <p className="text-lg font-bold">{data.positive_events}</p>
            <p className="text-[10px] text-muted-foreground">Positive</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <XCircle size={16} className="mx-auto text-destructive mb-1" />
            <p className="text-lg font-bold">{data.negative_events}</p>
            <p className="text-[10px] text-muted-foreground">Issues</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Events */}
      <Card>
        <CardContent className="p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Recent Activity</p>
          <div className="space-y-2">
            {data.recent_events.map((event, i) => {
              const config = eventLabels[event.event_type] || { label: event.event_type, icon: Clock, color: 'text-muted-foreground' };
              const Icon = config.icon;
              const timeAgo = new Date(event.occurred_at);
              const diffHours = (Date.now() - timeAgo.getTime()) / (1000 * 60 * 60);
              const timeLabel = diffHours < 1 ? 'Just now' : diffHours < 24 ? `${Math.floor(diffHours)}h ago` : `${Math.floor(diffHours / 24)}d ago`;

              return (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Icon size={12} className={config.color} />
                    <span className="text-xs">{config.label}</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground">{timeLabel}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
