// Database types for the Greenfield Marketplace
import { ServiceCategory } from './categories';

export type UserRole = 'buyer' | 'seller' | 'admin';
export type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type OrderStatus = 'placed' | 'accepted' | 'preparing' | 'ready' | 'picked_up' | 'delivered' | 'completed' | 'cancelled' | 'enquired' | 'quoted' | 'scheduled' | 'in_progress' | 'returned';
// ProductCategory is now an alias to ServiceCategory for backward compatibility
export type ProductCategory = ServiceCategory;
export type PaymentMethod = 'cod' | 'upi';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type OrderType = 'purchase' | 'booking' | 'rental' | 'enquiry';
export type ListingType = 'product' | 'service' | 'rental' | 'resale';
export type RentalPeriodType = 'hourly' | 'daily' | 'weekly' | 'monthly';
export type ItemCondition = 'new' | 'like_new' | 'good' | 'fair';
export interface Profile {
  id: string;
  phone: string;
  name: string;
  flat_number: string;
  block: string;
  phase: string | null;
  avatar_url: string | null;
  verification_status: VerificationStatus;
  created_at: string;
  updated_at: string;
}

export interface SellerProfile {
  id: string;
  user_id: string;
  business_name: string;
  description: string | null;
  categories: ProductCategory[];
  cover_image_url: string | null;
  profile_image_url: string | null;
  is_available: boolean;
  availability_start: string | null;
  availability_end: string | null;
  operating_days: string[];
  accepts_cod: boolean;
  accepts_upi: boolean;
  upi_id: string | null;
  verification_status: VerificationStatus;
  rating: number;
  total_reviews: number;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  profile?: Profile;
  is_favorite?: boolean;
}

export interface Product {
  id: string;
  seller_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: ProductCategory;
  is_veg: boolean;
  is_available: boolean;
  is_bestseller: boolean;
  is_recommended: boolean;
  is_urgent: boolean;
  // New fields for services/rentals/resale (optional for backward compat)
  listing_type?: ListingType | string;
  service_duration_minutes?: number | null;
  deposit_amount?: number | null;
  rental_period_type?: RentalPeriodType | string | null;
  min_rental_duration?: number | null;
  max_rental_duration?: number | null;
  condition?: ItemCondition | string | null;
  is_negotiable?: boolean;
  location_required?: boolean;
  available_slots?: any | null;
  created_at: string;
  updated_at: string;
  // Joined data
  seller?: SellerProfile;
}

export interface Order {
  id: string;
  buyer_id: string;
  seller_id: string;
  status: OrderStatus;
  total_amount: number;
  payment_type: string;
  payment_status: PaymentStatus;
  delivery_address: string | null;
  notes: string | null;
  rejection_reason: string | null;
  auto_cancel_at: string | null;
  // New fields for booking/rental orders (optional for backward compat)
  order_type?: OrderType | string;
  scheduled_date?: string | null;
  scheduled_time_start?: string | null;
  scheduled_time_end?: string | null;
  rental_start_date?: string | null;
  rental_end_date?: string | null;
  deposit_paid?: boolean;
  deposit_refunded?: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  seller?: SellerProfile;
  buyer?: Profile;
  items?: OrderItem[];
  payment?: PaymentRecord;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  created_at: string;
}

export interface Review {
  id: string;
  order_id: string;
  buyer_id: string;
  seller_id: string;
  rating: number;
  comment: string | null;
  is_hidden: boolean;
  hidden_reason: string | null;
  created_at: string;
  // Joined data
  buyer?: Profile;
  order?: Order;
}

export interface CartItem {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  // Joined data
  product?: Product;
}

export interface Favorite {
  id: string;
  user_id: string;
  seller_id: string;
  created_at: string;
  // Joined data
  seller?: SellerProfile;
}

export interface FeaturedItem {
  id: string;
  type: 'seller' | 'category' | 'banner';
  reference_id: string;
  title: string | null;
  image_url: string | null;
  link_url: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaymentRecord {
  id: string;
  order_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  transaction_reference: string | null;
  platform_fee: number;
  net_amount: number;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  order_id: string;
  sender_id: string;
  receiver_id: string;
  message_text: string;
  read_status: boolean;
  created_at: string;
  // Joined data
  sender?: Profile;
}

// Category display info (extended to include all service categories for backward compatibility)
export const CATEGORIES: { value: ProductCategory; label: string; icon: string; color: string }[] = [
  // Food & Groceries
  { value: 'home_food', label: 'Home Food', icon: '🍲', color: 'bg-orange-100' },
  { value: 'bakery', label: 'Bakery', icon: '🥐', color: 'bg-amber-100' },
  { value: 'snacks', label: 'Snacks', icon: '🍿', color: 'bg-yellow-100' },
  { value: 'groceries', label: 'Groceries', icon: '🥬', color: 'bg-green-100' },
  { value: 'beverages', label: 'Beverages', icon: '🥤', color: 'bg-cyan-100' },
  // Classes
  { value: 'tuition', label: 'Tuition', icon: '📚', color: 'bg-indigo-100' },
  { value: 'yoga', label: 'Yoga', icon: '🧘', color: 'bg-purple-100' },
  { value: 'dance', label: 'Dance', icon: '💃', color: 'bg-pink-100' },
  { value: 'music', label: 'Music', icon: '🎵', color: 'bg-violet-100' },
  // Services
  { value: 'electrician', label: 'Electrician', icon: '⚡', color: 'bg-yellow-100' },
  { value: 'plumber', label: 'Plumber', icon: '🔧', color: 'bg-blue-100' },
  { value: 'carpenter', label: 'Carpenter', icon: '🪚', color: 'bg-amber-100' },
  // Rentals
  { value: 'equipment_rental', label: 'Equipment Rental', icon: '🔧', color: 'bg-teal-100' },
  { value: 'vehicle_rental', label: 'Vehicle Rental', icon: '🚗', color: 'bg-slate-100' },
  // Buy & Sell
  { value: 'furniture', label: 'Furniture', icon: '🛋️', color: 'bg-amber-100' },
  { value: 'electronics', label: 'Electronics', icon: '📱', color: 'bg-blue-100' },
  { value: 'books', label: 'Books', icon: '📖', color: 'bg-emerald-100' },
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, { label: string; color: string }> = {
  placed: { label: 'Order Placed', color: 'bg-blue-100 text-blue-800' },
  accepted: { label: 'Accepted', color: 'bg-indigo-100 text-indigo-800' },
  preparing: { label: 'Preparing', color: 'bg-yellow-100 text-yellow-800' },
  ready: { label: 'Ready', color: 'bg-green-100 text-green-800' },
  picked_up: { label: 'Picked Up', color: 'bg-teal-100 text-teal-800' },
  delivered: { label: 'Delivered', color: 'bg-emerald-100 text-emerald-800' },
  completed: { label: 'Completed', color: 'bg-gray-100 text-gray-800' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
  // New service/rental statuses
  enquired: { label: 'Enquiry Sent', color: 'bg-purple-100 text-purple-800' },
  quoted: { label: 'Quote Received', color: 'bg-orange-100 text-orange-800' },
  scheduled: { label: 'Scheduled', color: 'bg-cyan-100 text-cyan-800' },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-800' },
  returned: { label: 'Returned', color: 'bg-slate-100 text-slate-800' },
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-800' },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-800' },
  refunded: { label: 'Refunded', color: 'bg-purple-100 text-purple-800' },
};

export const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
