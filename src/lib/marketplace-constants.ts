import { Plus, ShoppingBag, Calendar, Send, MessageCircle, Phone, Home, Handshake } from 'lucide-react';
import { ProductActionType } from '@/types/database';

/**
 * Shared ACTION_CONFIG — single source of truth for all product action buttons.
 * Used by ProductGridCard, ProductDetailSheet, ProductCard, ListingCard, etc.
 */
export const ACTION_CONFIG: Record<ProductActionType, { label: string; shortLabel: string; icon: typeof Plus; isCart: boolean }> = {
  add_to_cart: { label: 'Add to Cart', shortLabel: 'ADD', icon: Plus, isCart: true },
  buy_now: { label: 'Buy Now', shortLabel: 'BUY', icon: ShoppingBag, isCart: true },
  book: { label: 'Book Now', shortLabel: 'Book', icon: Calendar, isCart: false },
  request_service: { label: 'Request Service', shortLabel: 'Request', icon: Send, isCart: false },
  request_quote: { label: 'Request Quote', shortLabel: 'Quote', icon: MessageCircle, isCart: false },
  contact_seller: { label: 'Contact Seller', shortLabel: 'Contact', icon: Phone, isCart: false },
  schedule_visit: { label: 'Schedule Visit', shortLabel: 'Visit', icon: Home, isCart: false },
  make_offer: { label: 'Make an Offer', shortLabel: 'Offer', icon: Handshake, isCart: false },
};

/** Shared sort options used across CategoryPage, CategoryGroupPage, and SearchPage */
export const SORT_OPTIONS = [
  { key: 'relevance' as const, label: 'Relevance' },
  { key: 'price_low' as const, label: 'Price: Low' },
  { key: 'price_high' as const, label: 'Price: High' },
  { key: 'popular' as const, label: 'Popular' },
] as const;

export type SortKey = (typeof SORT_OPTIONS)[number]['key'];
