import { useSystemSettingsRaw } from '@/hooks/useSystemSettingsRaw';

const LABEL_KEYS = [
  // Trust signals
  'label_in_your_society', 'label_distance_m_format', 'label_distance_km_format',
  'label_your_neighbor', 'label_active_now', 'label_active_hours_ago',
  'label_active_yesterday', 'label_on_time_format', 'label_social_proof_format',
  'label_social_proof_singular', 'label_social_proof_plural', 'label_stable_price',
  // Notify me
  'label_notify_me', 'label_notify_watching', 'label_notify_watching_long', 'label_notify_me_long',
  // Checkout
  'label_checkout_community_support', 'label_checkout_community_emoji',
  'label_neighborhood_guarantee', 'label_neighborhood_guarantee_desc',
  'label_neighborhood_guarantee_badge', 'label_neighborhood_guarantee_emoji',
  'label_dispute_sla_notice',
  // Group buy
  'label_group_buy_title', 'label_group_buy_subtitle', 'label_group_buy_empty',
  'label_group_buy_empty_desc', 'label_group_buy_join', 'label_group_buy_leave',
  'label_group_buy_fulfilled',
  // Seller intelligence
  'label_demand_insights_title', 'label_demand_insights_empty',
  'label_reputation_empty', 'label_reputation_empty_desc',
  // Discovery
  'label_discovery_popular', 'label_discovery_new',
  // Reorder
  'label_reorder_prefix', 'label_reorder_success', 'label_reorder_unavailable',
  // Seller analytics
  'label_analytics_intelligence_title', 'label_analytics_active_buyers',
  'label_analytics_views', 'label_analytics_conversion',
  'label_analytics_fee_format', 'label_analytics_fee_desc',
  // Thresholds
  'on_time_badge_min_orders', 'stable_price_days', 'new_this_week_days',
  'discovery_min_products', 'discovery_max_items', 'price_history_max_points',
  'demand_insights_max_items', 'dispute_sla_warning_hours',
  // JSON enums
  'dispute_categories_json', 'reputation_event_labels_json', 'dispute_status_options_json',
];

const DEFAULTS: Record<string, string> = {
  label_in_your_society: 'In your society',
  label_distance_m_format: '{distance}m away',
  label_distance_km_format: '{distance} km away',
  label_your_neighbor: 'Your neighbor',
  label_active_now: 'Active now',
  label_active_hours_ago: '{hours}h ago',
  label_active_yesterday: 'Yesterday',
  label_on_time_format: '✓ On-time: {pct}%',
  label_social_proof_format: '👥 {count} {unit} ordered this week',
  label_social_proof_singular: 'family',
  label_social_proof_plural: 'families',
  label_stable_price: 'Stable Price (30+ days)',
  label_notify_me: 'Notify Me',
  label_notify_watching: 'Watching',
  label_notify_watching_long: "Watching — We'll notify you",
  label_notify_me_long: 'Notify Me When Available',
  label_checkout_community_support: 'This order supports {count} local business{suffix} in your community',
  label_checkout_community_emoji: '💚',
  label_neighborhood_guarantee: 'Neighborhood Guarantee',
  label_neighborhood_guarantee_desc: 'Your society committee will review this as a neutral party',
  label_neighborhood_guarantee_badge: 'Protected by Neighborhood Guarantee — disputes resolved by your society committee',
  label_neighborhood_guarantee_emoji: '🛡️',
  label_dispute_sla_notice: 'The committee will review within 48 hours.',
  label_group_buy_title: 'Community Group Buys',
  label_group_buy_subtitle: 'Pool orders with neighbors for better deals',
  label_group_buy_empty: 'No active group buys',
  label_group_buy_empty_desc: 'Group buys from your community will appear here',
  label_group_buy_join: 'Join Group Buy',
  label_group_buy_leave: 'Leave Group Buy',
  label_group_buy_fulfilled: '✓ Target Reached',
  label_demand_insights_title: 'What buyers are searching for',
  label_demand_insights_empty: 'No seller in your society offers these items yet — opportunity!',
  label_reputation_empty: 'No reputation history yet',
  label_reputation_empty_desc: 'Events will appear as orders are completed',
  label_discovery_popular: 'Popular near you',
  label_discovery_new: 'New this week',
  label_reorder_prefix: 'Reorder from',
  label_reorder_success: 'Cart rebuilt! Review and checkout.',
  label_reorder_unavailable: 'Items from this order are no longer available',
  label_analytics_intelligence_title: '30-Day Intelligence',
  label_analytics_active_buyers: 'Active Buyers',
  label_analytics_views: 'Views',
  label_analytics_conversion: 'Conversion',
  label_analytics_fee_format: '{pct}% platform fee',
  label_analytics_fee_desc: 'Applied on each completed order',
  on_time_badge_min_orders: '5',
  stable_price_days: '30',
  new_this_week_days: '7',
  discovery_min_products: '3',
  discovery_max_items: '10',
  price_history_max_points: '30',
  demand_insights_max_items: '5',
  dispute_sla_warning_hours: '48',
  dispute_categories_json: '[{"value":"noise","label":"Noise"},{"value":"parking","label":"Parking"},{"value":"pet","label":"Pet Related"},{"value":"maintenance","label":"Maintenance"},{"value":"other","label":"Other"}]',
  reputation_event_labels_json: '{"order_completed":{"label":"Order Completed","color":"text-success"},"order_cancelled":{"label":"Order Cancelled","color":"text-destructive"},"dispute_resolved":{"label":"Dispute Resolved","color":"text-success"},"dispute_lost":{"label":"Dispute Lost","color":"text-destructive"},"response_fast":{"label":"Fast Response","color":"text-primary"},"response_slow":{"label":"Slow Response","color":"text-warning"}}',
  dispute_status_options_json: '[{"value":"acknowledged","label":"Acknowledge"},{"value":"under_review","label":"Under Review"},{"value":"resolved","label":"Resolved"},{"value":"escalated","label":"Escalated"},{"value":"closed","label":"Close"}]',
};

export interface MarketplaceLabels {
  // Labels
  label: (key: string) => string;
  // Thresholds as numbers
  threshold: (key: string) => number;
  // JSON enums parsed
  disputeCategories: () => { value: string; label: string }[];
  reputationEventLabels: () => Record<string, { label: string; color: string }>;
  disputeStatusOptions: () => { value: string; label: string }[];
}

export function useMarketplaceLabels(): MarketplaceLabels {
  const { getSetting } = useSystemSettingsRaw(LABEL_KEYS);

  const label = (key: string): string => {
    const val = getSetting(key);
    return val || DEFAULTS[key] || '';
  };

  const threshold = (key: string): number => {
    const val = getSetting(key) || DEFAULTS[key] || '0';
    return parseInt(val, 10) || 0;
  };

  const parseJson = <T,>(key: string): T => {
    try {
      const raw = getSetting(key) || DEFAULTS[key] || '[]';
      return JSON.parse(raw) as T;
    } catch {
      return (DEFAULTS[key] ? JSON.parse(DEFAULTS[key]) : []) as T;
    }
  };

  return {
    label,
    threshold,
    disputeCategories: () => parseJson<{ value: string; label: string }[]>('dispute_categories_json'),
    reputationEventLabels: () => parseJson<Record<string, { label: string; color: string }>>('reputation_event_labels_json'),
    disputeStatusOptions: () => parseJson<{ value: string; label: string }[]>('dispute_status_options_json'),
  };
}
