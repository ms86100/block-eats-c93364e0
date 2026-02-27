import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { hapticVibrate, hapticNotification } from '@/lib/haptics';

const ACTIONABLE_STATUSES = ['placed', 'enquired', 'quoted'] as const;

function createAlarmSound(audioContext: AudioContext) {
  const now = audioContext.currentTime;
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

export interface NewOrder {
  id: string;
  status: string;
  created_at: string;
  total_amount: number;
}

const MIN_POLL_MS = 3000;
const MAX_POLL_MS = 30000;
const BACKOFF_FACTOR = 1.5;
const SNOOZE_MS = 60000;
const LOOKBACK_MS = 5 * 60 * 1000; // 5 minutes (used for subsequent polls only)

export function useNewOrderAlert(sellerId: string | null) {
  const queryClient = useQueryClient();
  const [pendingAlerts, setPendingAlerts] = useState<NewOrder[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSeenAtRef = useRef<string | null>(null); // null = first poll fetches ALL actionable
  const pollDelayRef = useRef(MIN_POLL_MS);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const dismissedIdsRef = useRef<Set<string>>(new Set());
  const snoozedUntilRef = useRef<Record<string, number>>({});

  const handleNewOrder = useCallback((order: NewOrder) => {
    if (seenIdsRef.current.has(order.id)) return;
    if (dismissedIdsRef.current.has(order.id)) return;
    if (!ACTIONABLE_STATUSES.includes(order.status as typeof ACTIONABLE_STATUSES[number])) return;
    const snoozedUntil = snoozedUntilRef.current[order.id];
    if (snoozedUntil && Date.now() < snoozedUntil) return;
    seenIdsRef.current.add(order.id);
    if (!lastSeenAtRef.current || order.created_at > lastSeenAtRef.current) {
      lastSeenAtRef.current = order.created_at;
    }
    pollDelayRef.current = MIN_POLL_MS;
    setPendingAlerts(prev => [...prev, order]);
    queryClient.invalidateQueries({ queryKey: ['seller-orders', sellerId] });
    queryClient.invalidateQueries({ queryKey: ['seller-dashboard-stats', sellerId] });
  }, [sellerId, queryClient]);

  const stopBuzzing = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    try {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    } catch {}
  }, []);

  const startBuzzing = useCallback(() => {
    // DEFECT 8 FIX: Prevent overlapping buzzing intervals
    if (intervalRef.current) return;
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
    intervalRef.current = setInterval(() => {
      hapticVibrate(500);
      try {
        if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
          createAlarmSound(audioCtxRef.current);
        }
      } catch {}
    }, 3000);
  }, []);

  const dismiss = useCallback(() => {
    setPendingAlerts(prev => {
      if (prev.length === 0) return prev;
      dismissedIdsRef.current.add(prev[0].id);
      const remaining = prev.slice(1);
      if (remaining.length === 0) stopBuzzing();
      return remaining;
    });
  }, [stopBuzzing]);

  const snooze = useCallback(() => {
    setPendingAlerts(prev => {
      if (prev.length === 0) return prev;
      const current = prev[0];
      seenIdsRef.current.delete(current.id);
      snoozedUntilRef.current[current.id] = Date.now() + SNOOZE_MS;
      const remaining = prev.slice(1);
      if (remaining.length === 0) stopBuzzing();
      return remaining;
    });
  }, [stopBuzzing]);

  // ── Realtime subscription (primary, instant) ──
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
          const n = payload.new as any;
          handleNewOrder({
            id: n.id,
            status: n.status,
            created_at: n.created_at,
            total_amount: n.total_amount,
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sellerId, handleNewOrder]);

  // ── Polling fallback — fetches ALL actionable orders ──
  useEffect(() => {
    if (!sellerId) return;

    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        // DEFECT 6 FIX: On first poll (lastSeenAtRef.current is null), fetch ALL actionable orders
        let query = supabase
          .from('orders')
          .select('id, status, total_amount, created_at')
          .eq('seller_id', sellerId)
          .in('status', ACTIONABLE_STATUSES)
          .order('created_at', { ascending: true });

        if (lastSeenAtRef.current) {
          query = query.gt('created_at', lastSeenAtRef.current);
        }

        const { data } = await query;

        if (data && data.length > 0) {
          data.forEach(order => handleNewOrder(order as NewOrder));
        } else {
          pollDelayRef.current = Math.min(pollDelayRef.current * BACKOFF_FACTOR, MAX_POLL_MS);
        }
      } catch {
        // Silently ignore poll errors
      }

      if (!cancelled) {
        pollTimerRef.current = setTimeout(poll, pollDelayRef.current);
      }
    };

    pollTimerRef.current = setTimeout(poll, 0);

    return () => {
      cancelled = true;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [sellerId, handleNewOrder]);

  // ── Start/stop buzzing based on pendingAlerts ──
  useEffect(() => {
    if (pendingAlerts.length > 0) {
      startBuzzing();
    } else {
      stopBuzzing();
    }
    return () => stopBuzzing();
  }, [pendingAlerts.length, startBuzzing, stopBuzzing]);

  // ── Cleanup on unmount or sellerId change ──
  useEffect(() => {
    return () => {
      stopBuzzing();
    };
  }, [sellerId, stopBuzzing]);

  return { pendingAlerts, dismiss, snooze };
}
