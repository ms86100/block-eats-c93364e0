import { supabase } from '@/integrations/supabase/client';
import { OrderStatus } from '@/types/database';
import { ORDER_NOTIF_TITLES_BUYER, ORDER_NOTIF_TITLES_SELLER } from '@/lib/order-notification-titles';

interface NotificationPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Send a push notification with retry + exponential backoff (max 3 attempts).
 */
export async function sendPushNotification(payload: NotificationPayload): Promise<boolean> {
  const MAX_ATTEMPTS = 3;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: payload,
      });

      if (error) {
        console.error(`[Push] Attempt ${attempt}/${MAX_ATTEMPTS} failed:`, error);
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, attempt * 1000));
          continue;
        }
        return false;
      }

      console.log('Push notification sent:', data);
      return data?.sent > 0;
    } catch (err) {
      console.error(`[Push] Attempt ${attempt}/${MAX_ATTEMPTS} exception:`, err);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, attempt * 1000));
        continue;
      }
      return false;
    }
  }
  return false;
}

// ── Body lookup maps (titles come from order-notification-titles.ts) ──

const BUYER_BODIES: Record<string, (seller: string) => string> = {
  accepted: (s) => `${s} accepted your order and will start preparing it.`,
  preparing: (s) => `${s} is now preparing your order.`,
  ready: (s) => `Your order from ${s} is ready for pickup!`,
  picked_up: (s) => `Your order from ${s} has been picked up.`,
  on_the_way: (s) => `Your order from ${s} is on the way!`,
  arrived: (s) => `The service provider from ${s} has arrived.`,
  assigned: (s) => `A delivery partner has been assigned for your ${s} order.`,
  delivered: (s) => `Your order from ${s} has been delivered!`,
  completed: (s) => `Your order from ${s} is complete. Leave a review!`,
  cancelled: (s) => `Your order from ${s} was cancelled.`,
  quoted: (s) => `${s} sent you a price quote for your enquiry.`,
  scheduled: (s) => `${s} confirmed your booking.`,
  in_progress: (s) => `${s} has started working on your service request.`,
};

const SELLER_BODIES: Record<string, (buyer: string) => string> = {
  placed: (b) => `${b} placed an order. Tap to view and accept.`,
  enquired: (b) => `${b} sent a new booking request. Tap to review.`,
  cancelled: (b) => `Order from ${b} was cancelled.`,
};

function getOrderNotificationContent(
  status: OrderStatus,
  sellerName: string,
  buyerName: string,
  orderId: string,
  isForSeller: boolean
): { title: string; body: string } | null {
  if (isForSeller) {
    const title = ORDER_NOTIF_TITLES_SELLER[status];
    if (!title) return null;
    const bodyFn = SELLER_BODIES[status];
    return bodyFn ? { title, body: bodyFn(buyerName) } : null;
  }

  const title = ORDER_NOTIF_TITLES_BUYER[status];
  if (!title) return null;
  const bodyFn = BUYER_BODIES[status];
  return bodyFn ? { title, body: bodyFn(sellerName) } : null;
}

/**
 * Send order status change notification to the appropriate user
 */
export async function sendOrderStatusNotification(
  orderId: string,
  newStatus: OrderStatus,
  buyerId: string,
  sellerId: string,
  sellerUserId: string,
  sellerName: string,
  buyerName: string
): Promise<void> {
  const sellerNotification = getOrderNotificationContent(newStatus, sellerName, buyerName, orderId, true);
  const buyerNotification = getOrderNotificationContent(newStatus, sellerName, buyerName, orderId, false);

  const notificationData = {
    orderId,
    type: 'order',
    status: newStatus,
  };

  if (sellerNotification) {
    await sendPushNotification({
      userId: sellerUserId,
      title: sellerNotification.title,
      body: sellerNotification.body,
      data: notificationData,
    });
  }

  if (buyerNotification) {
    await sendPushNotification({
      userId: buyerId,
      title: buyerNotification.title,
      body: buyerNotification.body,
      data: notificationData,
    });
  }
}

/**
 * Send new chat message notification
 */
export async function sendChatNotification(
  recipientId: string,
  senderName: string,
  orderId: string,
  messagePreview: string
): Promise<void> {
  const truncatedMessage =
    messagePreview.length > 50 ? messagePreview.substring(0, 50) + '...' : messagePreview;

  await sendPushNotification({
    userId: recipientId,
    title: `Message from ${senderName}`,
    body: truncatedMessage,
    data: {
      orderId,
      type: 'chat',
    },
  });
}
