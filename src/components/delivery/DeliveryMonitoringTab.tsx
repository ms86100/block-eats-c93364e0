import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Truck, Clock, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

interface DeliveryRecord {
  id: string;
  order_id: string;
  status: string;
  rider_name: string | null;
  rider_phone: string | null;
  delivery_fee: number;
  created_at: string;
  pickup_at: string | null;
  delivered_at: string | null;
  failed_reason: string | null;
}

interface DeliveryMonitoringTabProps {
  societyId?: string;
}

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  assigned: { label: 'Assigned', color: 'bg-blue-100 text-blue-800' },
  picked_up: { label: 'In Transit', color: 'bg-indigo-100 text-indigo-800' },
  at_gate: { label: 'At Gate', color: 'bg-cyan-100 text-cyan-800' },
  delivered: { label: 'Delivered', color: 'bg-green-100 text-green-800' },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-800' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-800' },
};

export function DeliveryMonitoringTab({ societyId }: DeliveryMonitoringTabProps) {
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'completed' | 'failed'>('active');

  useEffect(() => {
    fetchDeliveries();
  }, [societyId, filter]);

  const fetchDeliveries = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('delivery_assignments')
        .select('id, order_id, status, rider_name, rider_phone, delivery_fee, created_at, pickup_at, delivered_at, failed_reason')
        .order('created_at', { ascending: false })
        .limit(50);

      if (societyId) {
        query = query.eq('society_id', societyId);
      }

      if (filter === 'active') {
        query = query.in('status', ['pending', 'assigned', 'picked_up', 'at_gate']);
      } else if (filter === 'completed') {
        query = query.eq('status', 'delivered');
      } else {
        query = query.in('status', ['failed', 'cancelled']);
      }

      const { data, error } = await query;
      if (!error) setDeliveries((data || []) as DeliveryRecord[]);
    } catch (err) {
      console.error('Error fetching deliveries:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const activeCount = deliveries.length;

  const stats = {
    active: deliveries.filter(d => ['pending', 'assigned', 'picked_up', 'at_gate'].includes(d.status)).length,
    delivered: deliveries.filter(d => d.status === 'delivered').length,
    failed: deliveries.filter(d => ['failed', 'cancelled'].includes(d.status)).length,
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3 text-center">
          <Truck className="mx-auto text-blue-600 mb-1" size={18} />
          <p className="text-lg font-bold text-blue-700">{stats.active}</p>
          <p className="text-[10px] text-blue-600">Active</p>
        </div>
        <div className="bg-green-50 dark:bg-green-950/30 rounded-xl p-3 text-center">
          <CheckCircle className="mx-auto text-green-600 mb-1" size={18} />
          <p className="text-lg font-bold text-green-700">{stats.delivered}</p>
          <p className="text-[10px] text-green-600">Delivered</p>
        </div>
        <div className="bg-red-50 dark:bg-red-950/30 rounded-xl p-3 text-center">
          <XCircle className="mx-auto text-red-600 mb-1" size={18} />
          <p className="text-lg font-bold text-red-700">{stats.failed}</p>
          <p className="text-[10px] text-red-600">Failed</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['active', 'completed', 'failed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <Button variant="ghost" size="icon" className="ml-auto h-8 w-8" onClick={fetchDeliveries}>
          <RefreshCw size={14} />
        </Button>
      </div>

      {/* Delivery list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : deliveries.length === 0 ? (
        <div className="text-center py-8">
          <Truck className="mx-auto text-muted-foreground mb-2" size={32} />
          <p className="text-sm text-muted-foreground">No {filter} deliveries</p>
        </div>
      ) : (
        <div className="space-y-2">
          {deliveries.map(delivery => {
            const statusConfig = STATUS_BADGES[delivery.status] || STATUS_BADGES.pending;
            return (
              <div key={delivery.id} className="bg-card border border-border rounded-xl p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-mono text-muted-foreground">
                    #{delivery.order_id.slice(0, 8)}
                  </span>
                  <Badge variant="secondary" className={`text-[10px] ${statusConfig.color}`}>
                    {statusConfig.label}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    {delivery.rider_name && (
                      <p className="text-sm font-medium">{delivery.rider_name}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      {format(new Date(delivery.created_at), 'MMM d, h:mm a')}
                    </p>
                  </div>
                  {delivery.delivery_fee > 0 && (
                    <span className="text-sm font-semibold">₹{delivery.delivery_fee}</span>
                  )}
                </div>
                {delivery.failed_reason && (
                  <div className="mt-1.5 flex items-start gap-1.5">
                    <AlertTriangle size={12} className="text-destructive shrink-0 mt-0.5" />
                    <p className="text-[11px] text-destructive">{delivery.failed_reason}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
