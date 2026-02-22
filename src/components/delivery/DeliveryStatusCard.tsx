import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Truck, Phone, MapPin, Key, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface DeliveryAssignment {
  id: string;
  status: string;
  rider_name: string | null;
  rider_phone: string | null;
  pickup_at: string | null;
  delivered_at: string | null;
  failed_reason: string | null;
  attempt_count: number;
  created_at: string;
}

interface DeliveryStatusCardProps {
  orderId: string;
  isBuyerView: boolean;
  showOtp?: boolean;
}

const DELIVERY_STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Assigning Rider', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  assigned: { label: 'Rider Assigned', color: 'bg-blue-100 text-blue-800', icon: Truck },
  picked_up: { label: 'Out for Delivery', color: 'bg-indigo-100 text-indigo-800', icon: Truck },
  at_gate: { label: 'At Your Gate', color: 'bg-cyan-100 text-cyan-800', icon: MapPin },
  delivered: { label: 'Delivered', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  failed: { label: 'Delivery Failed', color: 'bg-red-100 text-red-800', icon: XCircle },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-800', icon: XCircle },
};

export function DeliveryStatusCard({ orderId, isBuyerView, showOtp }: DeliveryStatusCardProps) {
  const [assignment, setAssignment] = useState<DeliveryAssignment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deliveryOtp, setDeliveryOtp] = useState<string | null>(null);

  useEffect(() => {
    fetchAssignment();

    // Realtime subscription
    const channel = supabase
      .channel(`delivery-${orderId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'delivery_assignments',
        filter: `order_id=eq.${orderId}`,
      }, (payload) => {
        if (payload.new) {
          setAssignment(payload.new as DeliveryAssignment);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orderId]);

  const fetchAssignment = async () => {
    try {
      const { data, error } = await supabase
        .from('delivery_assignments')
        .select('id, status, rider_name, rider_phone, pickup_at, delivered_at, failed_reason, attempt_count, created_at')
        .eq('order_id', orderId)
        .maybeSingle();

      if (!error && data) {
        setAssignment(data as DeliveryAssignment);
      }
    } catch (err) {
      console.error('Error fetching delivery assignment:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
        <Loader2 className="animate-spin text-muted-foreground" size={16} />
        <span className="text-sm text-muted-foreground">Loading delivery info...</span>
      </div>
    );
  }

  if (!assignment) return null;

  const config = DELIVERY_STATUS_CONFIG[assignment.status] || DELIVERY_STATUS_CONFIG.pending;
  const StatusIcon = config.icon;

  const deliverySteps = ['pending', 'assigned', 'picked_up', 'at_gate', 'delivered'];
  const currentStepIndex = deliverySteps.indexOf(assignment.status);

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck size={16} className="text-primary" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Delivery</p>
        </div>
        <Badge variant="secondary" className={config.color}>
          {config.label}
        </Badge>
      </div>

      {/* Progress dots */}
      {!['failed', 'cancelled'].includes(assignment.status) && (
        <div className="flex items-center gap-1">
          {deliverySteps.map((step, index) => (
            <div key={step} className="flex items-center flex-1">
              <div className={`h-1.5 rounded-full flex-1 ${
                index <= currentStepIndex ? 'bg-primary' : 'bg-muted'
              }`} />
            </div>
          ))}
        </div>
      )}

      {/* Rider info */}
      {assignment.rider_name && (
        <div className="flex items-center justify-between bg-muted/50 rounded-lg p-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Truck size={14} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">{assignment.rider_name}</p>
              <p className="text-[11px] text-muted-foreground">Delivery Partner</p>
            </div>
          </div>
          {assignment.rider_phone && (
            <a href={`tel:${assignment.rider_phone}`} className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
              <Phone size={14} className="text-accent" />
            </a>
          )}
        </div>
      )}

      {/* OTP display for buyer when rider has picked up */}
      {isBuyerView && ['picked_up', 'at_gate'].includes(assignment.status) && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-center gap-3">
          <Key size={18} className="text-primary shrink-0" />
          <div>
            <p className="text-xs font-semibold text-primary">Delivery OTP</p>
            <p className="text-[11px] text-muted-foreground">Share this with the delivery partner</p>
            <p className="text-xs text-muted-foreground mt-0.5">Check your notifications for the OTP code</p>
          </div>
        </div>
      )}

      {/* Failed reason */}
      {assignment.status === 'failed' && assignment.failed_reason && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-2.5">
          <p className="text-xs text-destructive">{assignment.failed_reason}</p>
        </div>
      )}

      {/* Status message */}
      {isBuyerView && (
        <p className="text-xs text-muted-foreground">
          {assignment.status === 'pending' && '⏳ Finding a delivery partner for your order...'}
          {assignment.status === 'assigned' && `✅ ${assignment.rider_name || 'A rider'} will pick up your order soon.`}
          {assignment.status === 'picked_up' && '🚚 Your order is on the way!'}
          {assignment.status === 'at_gate' && '🏠 Delivery partner is at your society gate.'}
          {assignment.status === 'delivered' && '🎉 Your order has been delivered!'}
          {assignment.status === 'failed' && '❌ Delivery could not be completed.'}
        </p>
      )}
    </div>
  );
}
