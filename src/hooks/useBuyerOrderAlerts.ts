import { useEffect, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { IdentityContext } from '@/contexts/auth/contexts';
import { toast } from 'sonner';
import { hapticNotification } from '@/lib/haptics';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Real-time listener for buyer order status updates.
 * Uses raw useContext with null-safety to avoid fatal crashes
 * if AuthProvider hasn't mounted yet (HMR / startup race).
 */

const STATUS_MESSAGES: Record<string, { icon: string; title: string; description: string; haptic: 'success' | 'warning' | 'error' }> = {
  accepted: { icon: '✅', title: 'Order Accepted!', description: 'The seller has accepted your order.', haptic: 'success' },
  preparing: { icon: '👨‍🍳', title: 'Being Prepared', description: 'Your order is being prepared now.', haptic: 'success' },
  ready: { icon: '🎉', title: 'Order Ready!', description: 'Your order is ready for pickup!', haptic: 'success' },
  picked_up: { icon: '📦', title: 'Order Picked Up', description: 'Your order has been picked up for delivery.', haptic: 'success' },
  delivered: { icon: '🚚', title: 'Order Delivered!', description: 'Your order has been delivered.', haptic: 'success' },
  completed: { icon: '⭐', title: 'Order Completed', description: 'Your order is complete. Leave a review!', haptic: 'success' },
  cancelled: { icon: '❌', title: 'Order Cancelled', description: 'Your order has been cancelled.', haptic: 'error' },
  quoted: { icon: '💰', title: 'Quote Received', description: 'The seller sent you a price quote.', haptic: 'success' },
  scheduled: { icon: '📅', title: 'Booking Confirmed', description: 'Your booking has been confirmed.', haptic: 'success' },
};

export function useBuyerOrderAlerts() {
  const identity = useContext(IdentityContext);
  const user = identity?.user ?? null;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`buyer-order-updates-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `buyer_id=eq.${user.id}`,
        },
        (payload) => {
          const newStatus = (payload.new as any)?.status;
          const oldStatus = (payload.old as any)?.status;

          // C4: If old status is undefined (REPLICA IDENTITY not FULL), skip to avoid spam toasts
          if (!newStatus || oldStatus === undefined || newStatus === oldStatus) return;

          const msg = STATUS_MESSAGES[newStatus];
          if (!msg) return;

          hapticNotification(msg.haptic);

          toast(msg.title, {
            description: msg.description,
            icon: msg.icon,
            duration: 6000,
            action: {
              label: 'View',
              onClick: () => {
                window.location.hash = `#/orders/${(payload.new as any).id}`;
              },
            },
          });

          queryClient.invalidateQueries({ queryKey: ['orders'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);
}
