import { useDeliveryTracking } from '@/hooks/useDeliveryTracking';
import { Phone, Truck, Navigation, Clock, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface LiveDeliveryTrackerProps {
  assignmentId: string;
  isBuyerView: boolean;
}

function formatDistance(meters: number | null): string {
  if (!meters) return '';
  if (meters < 1000) return `${meters}m away`;
  return `${(meters / 1000).toFixed(1)} km away`;
}

function getProximityMessage(distance: number | null, eta: number | null): string {
  if (distance !== null && distance < 50) return '🏠 At your doorstep!';
  if (distance !== null && distance < 200) return '🏃 Almost there!';
  if (distance !== null && distance < 500) return '📍 Arriving soon!';
  if (eta !== null && eta <= 2) return '⏱️ Arriving in about 2 minutes';
  if (eta !== null && eta <= 5) return `⏱️ Arriving in about ${eta} minutes`;
  if (eta !== null) return `🕐 ETA: ${eta} minutes`;
  if (distance !== null) return `📏 ${formatDistance(distance)}`;
  return '🛵 On the way to you';
}

function getLastSeenText(lastLocationAt: string | null): string | null {
  if (!lastLocationAt) return null;
  const diffMs = Date.now() - new Date(lastLocationAt).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return null; // Recent enough
  if (diffMin > 3) return `Last seen ${diffMin} min ago`;
  return null;
}

export function LiveDeliveryTracker({ assignmentId, isBuyerView }: LiveDeliveryTrackerProps) {
  const tracking = useDeliveryTracking(assignmentId);

  if (tracking.isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
    );
  }

  if (!tracking.status) return null;

  const isInTransit = ['picked_up', 'on_the_way', 'at_gate'].includes(tracking.status);
  const lastSeen = getLastSeenText(tracking.lastLocationAt);

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation size={16} className="text-primary" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Live Tracking</p>
        </div>
        {tracking.eta && isInTransit && (
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            <Clock size={10} className="mr-1" />
            {tracking.eta} min
          </Badge>
        )}
      </div>

      {/* Proximity / ETA message */}
      {isBuyerView && isInTransit && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-center">
          <p className="text-sm font-semibold text-primary">
            {getProximityMessage(tracking.distance, tracking.eta)}
          </p>
          {tracking.distance !== null && tracking.distance > 500 && (
            <p className="text-xs text-muted-foreground mt-1">
              {formatDistance(tracking.distance)}
            </p>
          )}
          {tracking.isLocationStale && (
            <p className="text-[10px] text-destructive mt-1">⚠️ Location may be outdated — rider GPS not updating</p>
          )}
          {!tracking.isLocationStale && lastSeen && (
            <p className="text-[10px] text-muted-foreground mt-1">⚠️ {lastSeen}</p>
          )}
        </div>
      )}

      {/* Rider info */}
      {tracking.riderName && (
        <div className="flex items-center justify-between bg-muted/50 rounded-lg p-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
              {tracking.riderPhotoUrl ? (
                <img src={tracking.riderPhotoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <Truck size={16} className="text-primary" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium">{tracking.riderName}</p>
              <p className="text-[11px] text-muted-foreground">Delivery Partner</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {tracking.riderPhone && (
              <a href={`tel:${tracking.riderPhone}`} className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                <Phone size={14} className="text-accent" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Status messages */}
      {isBuyerView && (
        <p className="text-xs text-muted-foreground">
          {tracking.status === 'assigned' && `✅ ${tracking.riderName || 'A rider'} will pick up your order soon.`}
          {tracking.status === 'picked_up' && '🚚 Your order has been picked up!'}
          {tracking.status === 'on_the_way' && '🛵 Your order is on the way!'}
          {tracking.status === 'at_gate' && '🏠 Delivery partner is at your society gate.'}
          {tracking.status === 'delivered' && '🎉 Your order has been delivered!'}
        </p>
      )}
      {!isBuyerView && (
        <p className="text-xs text-muted-foreground">
          {tracking.status === 'assigned' && `🚴 ${tracking.riderName || 'Rider'} assigned.`}
          {tracking.status === 'picked_up' && '📦 Rider has picked up the order.'}
          {tracking.status === 'on_the_way' && '🛵 Rider is on the way to delivery.'}
          {tracking.status === 'at_gate' && '🏠 Rider is at the buyer\'s gate.'}
          {tracking.status === 'delivered' && '✅ Delivery completed.'}
        </p>
      )}
    </div>
  );
}
