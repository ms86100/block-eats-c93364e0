// Service Category Types for Society Super-App
// Now using TEXT type in database for dynamic category management

// ServiceCategory is now a flexible string type to support dynamic categories
// The predefined values below are for IDE autocomplete and common use cases
export type ServiceCategory = string;

// Common predefined categories for type hints (not exhaustive)
export type PredefinedCategory =
  // Food & Consumption
  | 'home_food' | 'bakery' | 'snacks' | 'groceries' | 'beverages'
  // Child Services
  | 'tuition' | 'daycare' | 'coaching'
  // Classes & Skills
  | 'yoga' | 'dance' | 'music' | 'art_craft' | 'language' | 'fitness'
  // Home Services
  | 'electrician' | 'plumber' | 'carpenter' | 'ac_service' | 'pest_control' | 'appliance_repair'
  // Domestic Help
  | 'maid' | 'cook' | 'driver' | 'nanny'
  // Personal Services
  | 'tailoring' | 'laundry' | 'beauty' | 'mehendi' | 'salon'
  // Professional Services
  | 'tax_consultant' | 'it_support' | 'tutoring' | 'resume_writing'
  // Rentals
  | 'equipment_rental' | 'vehicle_rental' | 'party_supplies' | 'baby_gear'
  // Buy & Sell
  | 'furniture' | 'electronics' | 'books' | 'toys' | 'kitchen' | 'clothing'
  // Events
  | 'catering' | 'decoration' | 'photography' | 'dj_music'
  // Pet Services
  | 'pet_food' | 'pet_grooming' | 'pet_sitting' | 'dog_walking'
  // Property
  | 'flat_rent' | 'roommate' | 'parking';

// ParentGroup is now a flexible string type to support dynamic groups from the database
export type ParentGroup = string;

export type ListingType = 'product' | 'service' | 'rental' | 'resale';
export type OrderType = 'purchase' | 'booking' | 'rental' | 'enquiry';
export type RentalPeriodType = 'hourly' | 'daily' | 'weekly' | 'monthly';
export type ItemCondition = 'new' | 'like_new' | 'good' | 'fair';

export interface CategoryBehavior {
  isPhysicalProduct: boolean;
  requiresPreparation: boolean;
  requiresTimeSlot: boolean;
  requiresDelivery: boolean;
  supportsCart: boolean;
  enquiryOnly: boolean;
  hasQuantity: boolean;
  hasDuration: boolean;
  hasDateRange: boolean;
  isNegotiable: boolean;
}

export interface CategoryFormHints {
  namePlaceholder: string | null;
  descriptionPlaceholder: string | null;
  priceLabel: string;
  durationLabel: string | null;
  showVegToggle: boolean;
  showDurationField: boolean;
  primaryButtonLabel: string | null;
  pricePrefix: string | null;
  placeholderEmoji: string | null;
}

export interface CategoryConfig {
  id: string;
  category: ServiceCategory;
  displayName: string;
  icon: string;
  color: string;
  parentGroup: ParentGroup;
  layoutType: 'ecommerce' | 'food' | 'service';
  behavior: CategoryBehavior;
  formHints: CategoryFormHints;
  displayOrder: number;
  isActive: boolean;
}

// PARENT_GROUPS constant removed - now fetched from database via useParentGroups hook

// Default behavior flags for each parent group
// Default fallback behavior for any unknown parent group
export const DEFAULT_FALLBACK_BEHAVIOR: CategoryBehavior = {
  isPhysicalProduct: false,
  requiresPreparation: false,
  requiresTimeSlot: false,
  requiresDelivery: false,
  supportsCart: false,
  enquiryOnly: false,
  hasQuantity: false,
  hasDuration: false,
  hasDateRange: false,
  isNegotiable: false,
};

// Known default behaviors for common groups (used as hints, not as the source of truth)
export const DEFAULT_GROUP_BEHAVIORS: Record<string, CategoryBehavior> = {
  food: {
    isPhysicalProduct: true,
    requiresPreparation: true,
    requiresTimeSlot: false,
    requiresDelivery: true,
    supportsCart: true,
    enquiryOnly: false,
    hasQuantity: true,
    hasDuration: false,
    hasDateRange: false,
    isNegotiable: false,
  },
  classes: {
    isPhysicalProduct: false,
    requiresPreparation: false,
    requiresTimeSlot: true,
    requiresDelivery: false,
    supportsCart: false,
    enquiryOnly: false,
    hasQuantity: false,
    hasDuration: true,
    hasDateRange: false,
    isNegotiable: false,
  },
  services: {
    isPhysicalProduct: false,
    requiresPreparation: false,
    requiresTimeSlot: true,
    requiresDelivery: false,
    supportsCart: false,
    enquiryOnly: false,
    hasQuantity: false,
    hasDuration: true,
    hasDateRange: false,
    isNegotiable: false,
  },
  personal: {
    isPhysicalProduct: false,
    requiresPreparation: false,
    requiresTimeSlot: true,
    requiresDelivery: false,
    supportsCart: false,
    enquiryOnly: false,
    hasQuantity: false,
    hasDuration: true,
    hasDateRange: false,
    isNegotiable: false,
  },
  professional: {
    isPhysicalProduct: false,
    requiresPreparation: false,
    requiresTimeSlot: false,
    requiresDelivery: false,
    supportsCart: false,
    enquiryOnly: true,
    hasQuantity: false,
    hasDuration: false,
    hasDateRange: false,
    isNegotiable: false,
  },
  rentals: {
    isPhysicalProduct: true,
    requiresPreparation: false,
    requiresTimeSlot: false,
    requiresDelivery: false,
    supportsCart: false,
    enquiryOnly: false,
    hasQuantity: false,
    hasDuration: false,
    hasDateRange: true,
    isNegotiable: false,
  },
  resale: {
    isPhysicalProduct: true,
    requiresPreparation: false,
    requiresTimeSlot: false,
    requiresDelivery: false,
    supportsCart: false,
    enquiryOnly: true,
    hasQuantity: false,
    hasDuration: false,
    hasDateRange: false,
    isNegotiable: true,
  },
  events: {
    isPhysicalProduct: false,
    requiresPreparation: true,
    requiresTimeSlot: true,
    requiresDelivery: true,
    supportsCart: false,
    enquiryOnly: false,
    hasQuantity: false,
    hasDuration: true,
    hasDateRange: false,
    isNegotiable: false,
  },
  pets: {
    isPhysicalProduct: false,
    requiresPreparation: false,
    requiresTimeSlot: true,
    requiresDelivery: false,
    supportsCart: false,
    enquiryOnly: false,
    hasQuantity: false,
    hasDuration: true,
    hasDateRange: false,
    isNegotiable: false,
  },
  property: {
    isPhysicalProduct: false,
    requiresPreparation: false,
    requiresTimeSlot: false,
    requiresDelivery: false,
    supportsCart: false,
    enquiryOnly: true,
    hasQuantity: false,
    hasDuration: false,
    hasDateRange: false,
    isNegotiable: true,
  },
};

// Get listing type based on category behavior
export function getListingType(behavior: CategoryBehavior): ListingType {
  if (behavior.hasDateRange) return 'rental';
  if (behavior.enquiryOnly && behavior.isNegotiable) return 'resale';
  if (behavior.requiresTimeSlot || behavior.hasDuration) return 'service';
  return 'product';
}

// Get order type based on category behavior
export function getOrderType(behavior: CategoryBehavior): OrderType {
  if (behavior.enquiryOnly) return 'enquiry';
  if (behavior.hasDateRange) return 'rental';
  if (behavior.requiresTimeSlot || behavior.hasDuration) return 'booking';
  return 'purchase';
}

// Extended order status for services
export type ExtendedOrderStatus = 
  | 'placed' | 'accepted' | 'preparing' | 'ready' | 'picked_up' | 'delivered' | 'completed' | 'cancelled'
  | 'enquired' | 'quoted' | 'scheduled' | 'in_progress' | 'returned';

export const EXTENDED_ORDER_STATUS_LABELS: Record<ExtendedOrderStatus, { label: string; color: string }> = {
  placed: { label: 'Order Placed', color: 'bg-blue-100 text-blue-800' },
  accepted: { label: 'Accepted', color: 'bg-indigo-100 text-indigo-800' },
  preparing: { label: 'Preparing', color: 'bg-yellow-100 text-yellow-800' },
  ready: { label: 'Ready', color: 'bg-green-100 text-green-800' },
  picked_up: { label: 'Picked Up', color: 'bg-teal-100 text-teal-800' },
  delivered: { label: 'Delivered', color: 'bg-emerald-100 text-emerald-800' },
  completed: { label: 'Completed', color: 'bg-gray-100 text-gray-800' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
  enquired: { label: 'Enquiry Sent', color: 'bg-purple-100 text-purple-800' },
  quoted: { label: 'Quote Received', color: 'bg-orange-100 text-orange-800' },
  scheduled: { label: 'Scheduled', color: 'bg-cyan-100 text-cyan-800' },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-800' },
  returned: { label: 'Returned', color: 'bg-slate-100 text-slate-800' },
};

export const ITEM_CONDITION_LABELS: Record<ItemCondition, { label: string; color: string }> = {
  new: { label: 'Brand New', color: 'bg-green-100 text-green-800' },
  like_new: { label: 'Like New', color: 'bg-teal-100 text-teal-800' },
  good: { label: 'Good', color: 'bg-blue-100 text-blue-800' },
  fair: { label: 'Fair', color: 'bg-yellow-100 text-yellow-800' },
};

export const RENTAL_PERIOD_LABELS: Record<RentalPeriodType, string> = {
  hourly: 'per hour',
  daily: 'per day',
  weekly: 'per week',
  monthly: 'per month',
};
