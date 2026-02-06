import { supabase } from '@/integrations/supabase/client';
import { OrderStatus } from '@/types/database';

interface NotificationPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Send a push notification to a user via the send-push-notification edge function
 */
export async function sendPushNotification(payload: NotificationPayload): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: payload,
    });

    if (error) {
      console.error('Failed to send push notification:', error);
      return false;
    }

    console.log('Push notification sent:', data);
    return data?.sent > 0;
  } catch (err) {
    console.error('Error sending push notification:', err);
    return false;
  }
}

/**
 * Get notification content based on order status change
 */
function getOrderNotificationContent(
  status: OrderStatus,
  sellerName: string,
  buyerName: string,
  orderId: string,
  isForSeller: boolean
): { title: string; body: string } | null {
  const shortOrderId = orderId.slice(0, 8);

  if (isForSeller) {
    // Notifications for sellers
    switch (status) {
      case 'placed':
        return {
          title: '🆕 New Order Received!',
          body: `${buyerName} placed an order. Tap to view and accept.`,
        };
      case 'cancelled':
        return {
          title: '❌ Order Cancelled',
          body: `Order #${shortOrderId} from ${buyerName} was cancelled.`,
        };
      default:
        return null;
    }
  } else {
    // Notifications for buyers
    switch (status) {
      case 'accepted':
        return {
          title: '✅ Order Accepted!',
          body: `${sellerName} accepted your order and will start preparing it.`,
        };
      case 'preparing':
        return {
          title: '👨‍🍳 Order Being Prepared',
          body: `${sellerName} is now preparing your order.`,
        };
      case 'ready':
        return {
          title: '🎉 Order Ready!',
          body: `Your order from ${sellerName} is ready for pickup!`,
        };
      case 'picked_up':
        return {
          title: '📦 Order Picked Up',
          body: `Your order from ${sellerName} has been picked up.`,
        };
      case 'delivered':
        return {
          title: '🚚 Order Delivered',
          body: `Your order from ${sellerName} has been delivered!`,
        };
      case 'completed':
        return {
          title: '⭐ Order Completed',
          body: `Your order from ${sellerName} is complete. Leave a review!`,
        };
      case 'cancelled':
        return {
          title: '❌ Order Cancelled',
          body: `Your order from ${sellerName} was cancelled.`,
        };
      case 'quoted':
        return {
          title: '💰 Quote Received',
          body: `${sellerName} sent you a price quote for your enquiry.`,
        };
      case 'scheduled':
        return {
          title: '📅 Booking Confirmed',
          body: `${sellerName} confirmed your booking.`,
        };
      default:
        return null;
    }
  }
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
  // Determine who should receive the notification
  // - Seller receives: placed (new order)
  // - Buyer receives: accepted, preparing, ready, completed, cancelled, etc.
  
  const sellerNotification = getOrderNotificationContent(
    newStatus,
    sellerName,
    buyerName,
    orderId,
    true
  );
  
  const buyerNotification = getOrderNotificationContent(
    newStatus,
    sellerName,
    buyerName,
    orderId,
    false
  );

  const notificationData = {
    orderId,
    type: 'order',
    status: newStatus,
  };

  // Send to seller if applicable
  if (sellerNotification) {
    await sendPushNotification({
      userId: sellerUserId,
      title: sellerNotification.title,
      body: sellerNotification.body,
      data: notificationData,
    });
  }

  // Send to buyer if applicable
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
  const truncatedMessage = messagePreview.length > 50 
    ? messagePreview.substring(0, 50) + '...' 
    : messagePreview;

  await sendPushNotification({
    userId: recipientId,
    title: `💬 Message from ${senderName}`,
    body: truncatedMessage,
    data: {
      orderId,
      type: 'chat',
    },
  });
}
