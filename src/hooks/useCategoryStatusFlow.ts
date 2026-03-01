import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface StatusFlowStep {
  status_key: string;
  sort_order: number;
  actor: string;
  is_terminal: boolean;
}

/**
 * Fetches category-driven status flow for an order based on its seller's
 * parent_group and the order's type (purchase vs enquiry).
 */
export function useCategoryStatusFlow(
  sellerPrimaryGroup: string | null | undefined,
  orderType: string | null | undefined,
  fulfillmentType?: string | null
) {
  const [flow, setFlow] = useState<StatusFlowStep[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!sellerPrimaryGroup) {
      setIsLoading(false);
      return;
    }

    const transactionType = resolveTransactionType(sellerPrimaryGroup, orderType, fulfillmentType);

    (async () => {
      const { data, error } = await supabase
        .from('category_status_flows')
        .select('status_key, sort_order, actor, is_terminal')
        .eq('parent_group', sellerPrimaryGroup)
        .eq('transaction_type', transactionType)
        .neq('status_key', 'cancelled')
        .order('sort_order', { ascending: true });

      if (!error && data) {
        setFlow(data as StatusFlowStep[]);
      }
      setIsLoading(false);
    })();
  }, [sellerPrimaryGroup, orderType, fulfillmentType]);

  return { flow, isLoading };
}

function resolveTransactionType(
  parentGroup: string,
  orderType: string | null | undefined,
  fulfillmentType?: string | null
): string {
  if (orderType === 'enquiry') {
    if (['classes', 'events'].includes(parentGroup)) return 'book_slot';
    return 'request_service';
  }
  // Self-pickup or seller-delivery → self_fulfillment (no delivery partner steps)
  if (fulfillmentType && ['self_pickup', 'seller_delivery'].includes(fulfillmentType)) {
    return 'self_fulfillment';
  }
  return 'cart_purchase';
}

/**
 * Given a flow + current status + actor, returns the next status the actor can move to.
 */
export function getNextStatusForActor(
  flow: StatusFlowStep[],
  currentStatus: string,
  actor: string
): string | null {
  const currentIndex = flow.findIndex(s => s.status_key === currentStatus);
  if (currentIndex === -1) return null;

  const next = flow[currentIndex + 1];
  if (!next) return null;

  // Seller can only advance to seller-actionable steps
  if (actor === 'seller' && next.actor !== 'seller') return null;

  return next.status_key;
}

/**
 * Returns the display steps for the timeline (non-terminal, non-cancelled).
 */
export function getTimelineSteps(flow: StatusFlowStep[]): StatusFlowStep[] {
  return flow.filter(s => !s.is_terminal && s.status_key !== 'cancelled');
}
