// Database types for the Greenfield Marketplace

export type UserRole = 'buyer' | 'seller' | 'admin';
export type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type OrderStatus = 'placed' | 'accepted' | 'preparing' | 'ready' | 'completed' | 'cancelled';
export type ProductCategory = 'home_food' | 'bakery' | 'snacks' | 'groceries' | 'other';

export interface Profile {
  id: string;
  phone: string;
  name: string;
  flat_number: string;
  block: string;
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
  is_available: boolean;
  availability_start: string | null;
  availability_end: string | null;
  accepts_cod: boolean;
  verification_status: VerificationStatus;
  rating: number;
  total_reviews: number;
  created_at: string;
  updated_at: string;
  // Joined data
  profile?: Profile;
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
  delivery_address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  seller?: SellerProfile;
  items?: OrderItem[];
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
  created_at: string;
  // Joined data
  buyer?: Profile;
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

// Category display info
export const CATEGORIES: { value: ProductCategory; label: string; icon: string; color: string }[] = [
  { value: 'home_food', label: 'Home Food', icon: '🍲', color: 'bg-orange-100' },
  { value: 'bakery', label: 'Bakery', icon: '🥐', color: 'bg-amber-100' },
  { value: 'snacks', label: 'Snacks', icon: '🍿', color: 'bg-yellow-100' },
  { value: 'groceries', label: 'Groceries', icon: '🥬', color: 'bg-green-100' },
  { value: 'other', label: 'Other', icon: '📦', color: 'bg-blue-100' },
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, { label: string; color: string }> = {
  placed: { label: 'Order Placed', color: 'bg-blue-100 text-blue-800' },
  accepted: { label: 'Accepted', color: 'bg-indigo-100 text-indigo-800' },
  preparing: { label: 'Preparing', color: 'bg-yellow-100 text-yellow-800' },
  ready: { label: 'Ready', color: 'bg-green-100 text-green-800' },
  completed: { label: 'Completed', color: 'bg-gray-100 text-gray-800' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
};
