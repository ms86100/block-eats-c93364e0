// Database types for the Sociva Marketplace
import { ServiceCategory } from './categories';

export type UserRole = 'buyer' | 'seller' | 'admin';

export interface SocietyAdmin {
  id: string;
  society_id: string;
  user_id: string;
  role: 'admin' | 'moderator';
  appointed_by: string | null;
  created_at: string;
}

export interface Builder {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BuilderMember {
  id: string;
  builder_id: string;
  user_id: string;
  role: 'member' | 'admin';
  created_at: string;
}
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
export interface Society {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  geofence_radius_meters: number;
  is_verified: boolean;
  is_active: boolean;
  admin_user_id: string | null;
  member_count: number;
  logo_url: string | null;
  rules_text: string | null;
  invite_code: string | null;
  auto_approve_residents: boolean;
  approval_method: string;
  builder_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  phone: string;
  name: string;
  flat_number: string;
  block: string;
  phase: string | null;
  avatar_url: string | null;
  verification_status: VerificationStatus;
  society_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  society?: Society;
}

export interface SellerProfile {
  id: string;
  user_id: string;
  business_name: string;
  description: string | null;
  categories: ProductCategory[];
  primary_group: string | null;
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
  society_id: string | null;
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

export type ItemStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'delivered' | 'cancelled';

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  status?: ItemStatus;
  created_at: string;
  updated_at?: string;
}

export const ITEM_STATUS_LABELS: Record<ItemStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-muted text-muted-foreground' },
  accepted: { label: 'Accepted', color: 'bg-blue-100 text-blue-700' },
  preparing: { label: 'Preparing', color: 'bg-yellow-100 text-yellow-700' },
  ready: { label: 'Ready', color: 'bg-cyan-100 text-cyan-700' },
  delivered: { label: 'Delivered', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700' },
};

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

// CATEGORIES constant removed - now fetched from database via useCategoryConfigs hook

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
