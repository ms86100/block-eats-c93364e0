import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { hapticVibrate, hapticNotification } from '@/lib/haptics';

/**
 * Continuous buzzing alert for sellers when a new order/booking/enquiry arrives.
 * Uses Supabase Realtime to listen for INSERT on orders table for the given seller.
 * Plays a repeating alarm sound + haptic vibration until the seller dismisses it.
 */

function createAlarmSound(audioContext: AudioContext) {
  const now = audioContext.currentTime;

  // Two-tone urgent alarm: high-low pattern
  for (let i = 0; i < 3; i++) {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);

    osc.frequency.value = i % 2 === 0 ? 880 : 660;
    osc.type = 'square';

    const start = now + i * 0.2;
    gain.gain.setValueAtTime(0.25, start);
    gain.gain.exponentialRampToValueAtTime(0.01, start + 0.18);

    osc.start(start);
    osc.stop(start + 0.2);
  }
}

interface NewOrder {
  id: string;
  status: string;
  created_at: string;
  total_amount: number;
}

export function useNewOrderAlert(sellerId: string | null) {
  const queryClient = useQueryClient();
  const [pendingAlert, setPendingAlert] = useState<NewOrder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startBuzzing = useCallback(() => {
    // Initial burst
    hapticNotification('warning');
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      createAlarmSound(audioCtxRef.current);
    } catch (e) {
      console.warn('[OrderAlert] Sound failed:', e);
    }

    // Repeat every 3 seconds
    intervalRef.current = setInterval(() => {
      hapticVibrate(500);
      try {
        if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
          createAlarmSound(audioCtxRef.current);
        }
      } catch {}
    }, 3000);
  }, []);

  const stopBuzzing = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    stopBuzzing();
    setPendingAlert(null);
  }, [stopBuzzing]);

  // Subscribe to new orders via Realtime
  useEffect(() => {
    if (!sellerId) return;

    const channel = supabase
      .channel(`seller-new-orders-${sellerId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `seller_id=eq.${sellerId}`,
        },
        (payload) => {
          const newOrder = payload.new as any;
          // Trigger alert for any new order/booking/enquiry
          setPendingAlert({
            id: newOrder.id,
            status: newOrder.status,
            created_at: newOrder.created_at,
            total_amount: newOrder.total_amount,
          });
          // Refresh the order list and stats
          queryClient.invalidateQueries({ queryKey: ['seller-orders', sellerId] });
          queryClient.invalidateQueries({ queryKey: ['seller-dashboard-stats', sellerId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sellerId]);

  // Start/stop buzzing based on pendingAlert
  useEffect(() => {
    if (pendingAlert) {
      startBuzzing();
    } else {
      stopBuzzing();
    }
    return () => stopBuzzing();
  }, [pendingAlert, startBuzzing, stopBuzzing]);

  return { pendingAlert, dismiss };
}
