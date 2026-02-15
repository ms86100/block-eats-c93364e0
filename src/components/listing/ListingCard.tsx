import { Link } from 'react-router-dom';
import { useCategoryBehavior } from '@/hooks/useCategoryBehavior';
import { ServiceCategory, ITEM_CONDITION_LABELS, RENTAL_PERIOD_LABELS, ItemCondition, RentalPeriodType } from '@/types/categories';
import { ProductActionType } from '@/types/database';
import { ACTION_CONFIG } from '@/lib/marketplace-constants';
import { VegBadge } from '@/components/ui/veg-badge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Plus, Minus, Clock, Star, Zap } from 'lucide-react';

export interface Listing {
  id: string;
  seller_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: ServiceCategory;
  is_veg?: boolean;
  is_available: boolean;
  is_bestseller?: boolean;
  is_recommended?: boolean;
  is_urgent?: boolean;
  listing_type?: string;
  service_duration_minutes?: number;
  deposit_amount?: number;
  rental_period_type?: RentalPeriodType;
  condition?: ItemCondition;
  is_negotiable?: boolean;
  action_type?: string;
  seller?: {
    business_name: string;
    rating?: number;
    profile_image_url?: string;
  };
}

interface ListingCardProps {
  listing: Listing;
  quantity?: number;
  onAdd?: () => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
  onEnquire?: () => void;
  onBook?: () => void;
  onRent?: () => void;
  compact?: boolean;
}

export function ListingCard({
  listing,
  quantity = 0,
  onAdd,
  onIncrement,
  onDecrement,
  onEnquire,
  onBook,
  onRent,
  compact = false,
}: ListingCardProps) {
  const { behavior, listingType, supportsCart, requiresTimeSlot, hasDateRange, enquiryOnly, isNegotiable, hasDuration } = 
    useCategoryBehavior(listing.category);

  // Use action_type from the listing (set by DB trigger), fallback to deriving from behavior
  const actionType: ProductActionType = (listing.action_type as ProductActionType) || 'add_to_cart';
  const actionConfig = ACTION_CONFIG[actionType] || ACTION_CONFIG.add_to_cart;
  const ActionIcon = actionConfig.icon;

  const renderActionButton = () => {
    // Cart-compatible items
    if (actionConfig.isCart && supportsCart) {
      if (quantity > 0) {
        return (
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8 rounded-full"
              onClick={(e) => {
                e.preventDefault();
                onDecrement?.();
              }}
            >
              <Minus size={14} />
            </Button>
            <span className="w-6 text-center font-semibold">{quantity}</span>
            <Button
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={(e) => {
                e.preventDefault();
                onIncrement?.();
              }}
            >
              <Plus size={14} />
            </Button>
          </div>
        );
      }
      return (
        <Button
          size="sm"
          className="rounded-full"
          onClick={(e) => {
            e.preventDefault();
            onAdd?.();
          }}
        >
          <Plus size={14} className="mr-1" />
          {actionConfig.shortLabel}
        </Button>
      );
    }

    // Non-cart actions: use the appropriate callback based on action type
    const handleNonCartAction = (e: React.MouseEvent) => {
      e.preventDefault();
      if (actionType === 'contact_seller' || enquiryOnly) {
        onEnquire?.();
      } else if (hasDateRange) {
        onRent?.();
      } else {
        onBook?.();
      }
    };

    return (
      <Button
        size="sm"
        variant={enquiryOnly ? 'secondary' : 'default'}
        className="rounded-full"
        onClick={handleNonCartAction}
      >
        <ActionIcon size={14} className="mr-1" />
        {actionConfig.shortLabel}
      </Button>
    );
  };

  const renderPriceInfo = () => {
    // Rental pricing
    if (listing.rental_period_type) {
      return (
        <div>
          <span className="font-bold text-lg">₹{listing.price}</span>
          <span className="text-xs text-muted-foreground ml-1">
            {RENTAL_PERIOD_LABELS[listing.rental_period_type]}
          </span>
          {listing.deposit_amount && listing.deposit_amount > 0 && (
            <p className="text-xs text-muted-foreground">
              + ₹{listing.deposit_amount} deposit
            </p>
          )}
        </div>
      );
    }

    // Service duration pricing
    if (listing.service_duration_minutes) {
      return (
        <div>
          <span className="font-bold text-lg">₹{listing.price}</span>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock size={10} />
            {listing.service_duration_minutes} min
          </p>
        </div>
      );
    }

    // Standard pricing
    return (
      <div>
        <span className="font-bold text-lg">₹{listing.price}</span>
        {isNegotiable && (
          <Badge variant="outline" className="ml-2 text-[10px]">
            Negotiable
          </Badge>
        )}
      </div>
    );
  };

  const renderBadges = () => {
    const badges = [];

    if (listing.is_bestseller) {
      badges.push(
        <Badge key="bestseller" variant="secondary" className="bg-warning/20 text-warning-foreground text-[10px]">
          <Star size={10} className="mr-0.5 fill-current" />
          Bestseller
        </Badge>
      );
    }

    if (listing.is_urgent) {
      badges.push(
        <Badge key="urgent" variant="destructive" className="text-[10px]">
          <Zap size={10} className="mr-0.5" />
          Urgent
        </Badge>
      );
    }

    if (listing.condition) {
      const conditionInfo = ITEM_CONDITION_LABELS[listing.condition];
      badges.push(
        <Badge key="condition" variant="outline" className={cn('text-[10px]', conditionInfo.color)}>
          {conditionInfo.label}
        </Badge>
      );
    }

    return badges.length > 0 ? (
      <div className="flex flex-wrap gap-1 mb-1">{badges}</div>
    ) : null;
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 bg-card rounded-lg">
        {listing.image_url && (
          <img
            src={listing.image_url}
            alt={listing.name}
            className="w-16 h-16 rounded-lg object-cover"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{listing.name}</p>
          <p className="text-sm font-semibold text-primary">₹{listing.price}</p>
        </div>
        {renderActionButton()}
      </div>
    );
  }

  return (
    <div className="flex gap-3 p-3 border-b border-border last:border-0">
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          {listing.is_veg !== undefined && <VegBadge isVeg={listing.is_veg} size="sm" />}
          <div className="flex-1 min-w-0">
            {renderBadges()}
            <h4 className="font-medium leading-tight">{listing.name}</h4>
            {listing.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                {listing.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-end justify-between mt-2">
          {renderPriceInfo()}
          {renderActionButton()}
        </div>
      </div>

      {/* Image */}
      {listing.image_url && (
        <div className="relative w-24 h-24 rounded-lg overflow-hidden shrink-0">
          <img
            src={listing.image_url}
            alt={listing.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}
    </div>
  );
}
