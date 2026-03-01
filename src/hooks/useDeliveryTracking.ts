import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface RiderLocation {
  latitude: number;
  longitude: number;
  speed_kmh: number | null;
  heading: number | null;
  recorded_at: string;
}

interface DeliveryTrackingState {
  riderLocation: RiderLocation | null;
  eta: number | null;
  distance: number | null;
  status: string | null;
  riderName: string | null;
  riderPhone: string | null;
  riderPhotoUrl: string | null;
  lastLocationAt: string | null;
  isLoading: boolean;
  /** C5: True when last GPS update is older than 2 minutes */
  isLocationStale: boolean;
}

export function useDeliveryTracking(assignmentId: string | null | undefined): DeliveryTrackingState {
  const [state, setState] = useState<DeliveryTrackingState>({
    riderLocation: null,
    eta: null,
    distance: null,
    status: null,
    riderName: null,
    riderPhone: null,
    riderPhotoUrl: null,
    lastLocationAt: null,
    isLoading: true,
    isLocationStale: false,
  });

  // C5: Periodic staleness check — every 30s, mark stale if last update > 2 min ago
  useEffect(() => {
    const interval = setInterval(() => {
      setState(prev => {
        if (!prev.lastLocationAt) return prev;
        const stale = Date.now() - new Date(prev.lastLocationAt).getTime() > 2 * 60 * 1000;
        if (stale !== prev.isLocationStale) return { ...prev, isLocationStale: stale };
        return prev;
      });
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!assignmentId) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    // Fetch initial assignment data
    (async () => {
      const { data } = await supabase
        .from('delivery_assignments')
        .select('id, status, rider_name, rider_phone, rider_photo_url, eta_minutes, distance_meters, last_location_lat, last_location_lng, last_location_at')
        .eq('id', assignmentId)
        .single();

      if (data) {
        setState(prev => ({
          ...prev,
          status: data.status,
          riderName: data.rider_name,
          riderPhone: data.rider_phone,
          riderPhotoUrl: data.rider_photo_url,
          eta: data.eta_minutes,
          distance: data.distance_meters,
          lastLocationAt: data.last_location_at,
          riderLocation: data.last_location_lat && data.last_location_lng ? {
            latitude: data.last_location_lat,
            longitude: data.last_location_lng,
            speed_kmh: null,
            heading: null,
            recorded_at: data.last_location_at || new Date().toISOString(),
          } : null,
          isLoading: false,
        }));
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    })();

    // Subscribe to delivery_assignments changes (status, ETA, distance)
    const assignmentChannel = supabase
      .channel(`tracking-assignment-${assignmentId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'delivery_assignments',
        filter: `id=eq.${assignmentId}`,
      }, (payload) => {
        const d = payload.new as any;
        setState(prev => ({
          ...prev,
          status: d.status,
          riderName: d.rider_name ?? prev.riderName,
          riderPhone: d.rider_phone ?? prev.riderPhone,
          riderPhotoUrl: d.rider_photo_url ?? prev.riderPhotoUrl,
          eta: d.eta_minutes ?? prev.eta,
          distance: d.distance_meters ?? prev.distance,
          lastLocationAt: d.last_location_at ?? prev.lastLocationAt,
          riderLocation: d.last_location_lat && d.last_location_lng ? {
            latitude: d.last_location_lat,
            longitude: d.last_location_lng,
            speed_kmh: prev.riderLocation?.speed_kmh ?? null,
            heading: prev.riderLocation?.heading ?? null,
            recorded_at: d.last_location_at || new Date().toISOString(),
          } : prev.riderLocation,
        }));
      })
      .subscribe();

    // Subscribe to delivery_locations for live GPS updates
    const locationChannel = supabase
      .channel(`tracking-location-${assignmentId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'delivery_locations',
        filter: `assignment_id=eq.${assignmentId}`,
      }, (payload) => {
        const loc = payload.new as any;
        setState(prev => ({
          ...prev,
          riderLocation: {
            latitude: loc.latitude,
            longitude: loc.longitude,
            speed_kmh: loc.speed_kmh,
            heading: loc.heading,
            recorded_at: loc.recorded_at,
          },
          lastLocationAt: loc.recorded_at,
        }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(assignmentChannel);
      supabase.removeChannel(locationChannel);
    };
  }, [assignmentId]);

  return state;
}
