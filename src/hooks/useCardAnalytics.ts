import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * DB-backed analytics tracking for ProductListingCard.
 * Writes to marketplace_events table. No console-only logging.
 */

interface CardEvent {
  productId: string;
  category: string;
  price: number;
  sellerId: string;
  layout: string;
}

async function emit(eventType: string, data: CardEvent) {
  try {
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id || null;

    await supabase.from('marketplace_events').insert({
      product_id: data.productId,
      seller_id: data.sellerId,
      category: data.category,
      layout_type: data.layout,
      event_type: eventType,
      user_id: userId,
      metadata: { price: data.price },
    });
  } catch {
    // Silent fail — analytics must never break UI
  }
}

export function useCardAnalytics(product: CardEvent) {
  const impressionFired = useRef(false);
  const ref = useRef<HTMLDivElement>(null);

  const payload: CardEvent = {
    productId: product.productId,
    category: product.category,
    price: product.price,
    sellerId: product.sellerId,
    layout: product.layout,
  };

  // Intersection observer for impression tracking
  useEffect(() => {
    if (!ref.current || impressionFired.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !impressionFired.current) {
          impressionFired.current = true;
          emit('impression', payload);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.productId]);

  const onCardClick = useCallback(() => {
    emit('click', payload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.productId]);

  const onAddClick = useCallback(() => {
    emit('add_to_cart', payload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.productId]);

  const onWishlistClick = useCallback(() => {
    emit('wishlist', payload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.productId]);

  return { ref, onCardClick, onAddClick, onWishlistClick };
}
