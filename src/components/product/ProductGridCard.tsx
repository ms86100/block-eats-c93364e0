import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Minus, Clock, MessageCircle, Calendar, Truck, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { VegBadge } from '@/components/ui/veg-badge';
import { useCart } from '@/hooks/useCart';
import { Product } from '@/types/database';
import { CategoryBehavior } from '@/types/categories';
import { cn } from '@/lib/utils';

export interface ProductWithSeller extends Product {
  seller_name?: string;
  seller_rating?: number;
  seller_id: string;
  fulfillment_mode?: string | null;
  delivery_note?: string | null;
}

interface ProductGridCardProps {
  product: ProductWithSeller;
  behavior?: CategoryBehavior | null;
  onTap?: (product: ProductWithSeller) => void;
  className?: string;
}

export function ProductGridCard({ product, behavior, onTap, className }: ProductGridCardProps) {
  const { items, addItem, updateQuantity } = useCart();
  const cartItem = items.find((item) => item.product_id === product.id);
  const quantity = cartItem?.quantity || 0;

  const isService = behavior && (behavior.requiresTimeSlot || behavior.hasDuration || behavior.enquiryOnly);
  const supportsCart = behavior?.supportsCart ?? true;

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    addItem(product);
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    updateQuantity(product.id, quantity + 1);
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    updateQuantity(product.id, quantity - 1);
  };

  const handleCardClick = () => {
    onTap?.(product);
  };

  const actionLabel = behavior?.enquiryOnly
    ? 'Contact'
    : behavior?.requiresTimeSlot
      ? 'Book'
      : 'Add';

  const ActionIcon = behavior?.enquiryOnly
    ? MessageCircle
    : behavior?.requiresTimeSlot
      ? Calendar
      : Plus;

  return (
    <div
      onClick={handleCardClick}
      className={cn(
        'bg-card rounded-xl overflow-hidden shadow-sm border border-border/50 cursor-pointer transition-shadow hover:shadow-md flex flex-col',
        className
      )}
    >
      {/* Image */}
      <div className="relative aspect-square">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <span className="text-3xl">{isService ? '🛠️' : '🍽️'}</span>
          </div>
        )}

        {!product.is_available && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
            <span className="text-xs font-medium text-muted-foreground">Unavailable</span>
          </div>
        )}

        {/* Badges overlay */}
        <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
          {product.is_bestseller && (
            <Badge className="bg-warning text-warning-foreground text-[9px] px-1 py-0 h-4">
              ★ Best
            </Badge>
          )}
          {product.is_recommended && (
            <Badge className="bg-success text-white text-[9px] px-1 py-0 h-4">
              Recommended
            </Badge>
          )}
        </div>

        {/* Veg badge */}
        <div className="absolute top-1.5 right-1.5">
          <VegBadge isVeg={product.is_veg} size="sm" />
        </div>
      </div>

      {/* Content */}
      <div className="p-2.5 flex flex-col flex-1">
        <h4 className="font-medium text-sm leading-tight line-clamp-1">{product.name}</h4>

        {/* Price row */}
        <div className="flex items-center justify-between mt-1">
          <span className="font-bold text-sm text-foreground">
            {isService && !behavior?.enquiryOnly ? 'From ' : ''}₹{product.price}
          </span>
          {product.prep_time_minutes && !isService && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Clock size={9} />
              {product.prep_time_minutes}m
            </span>
          )}
          {isService && product.service_duration_minutes && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Clock size={9} />
              {product.service_duration_minutes >= 60
                ? `${Math.floor(product.service_duration_minutes / 60)}h`
                : `${product.service_duration_minutes}m`}
            </span>
          )}
        </div>

        {/* Fulfillment mode */}
        {product.fulfillment_mode && (
          <div className="flex items-center gap-1 mt-0.5">
            <Truck size={9} className="text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">
              {product.fulfillment_mode === 'self_pickup' && 'Pickup Only'}
              {product.fulfillment_mode === 'delivery' && 'Delivery'}
              {product.fulfillment_mode === 'both' && 'Pickup / Delivery'}
            </span>
          </div>
        )}

        {/* Seller name */}
        {product.seller_name && (
          <Link
            to={`/seller/${product.seller_id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-[11px] text-muted-foreground mt-1 truncate hover:text-primary transition-colors"
          >
            {product.seller_name}
          </Link>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action */}
        <div className="mt-2">
          {supportsCart && !isService ? (
            quantity === 0 ? (
              <Button
                size="sm"
                variant="outline"
                className="w-full h-7 text-xs border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                onClick={handleAdd}
                disabled={!product.is_available}
              >
                <Plus size={12} className="mr-0.5" /> Add
              </Button>
            ) : (
              <div className="flex items-center justify-center gap-2 border border-primary rounded-md h-7">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-primary"
                  onClick={handleDecrement}
                >
                  <Minus size={12} />
                </Button>
                <span className="font-semibold text-xs text-primary w-4 text-center">{quantity}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-primary"
                  onClick={handleIncrement}
                >
                  <Plus size={12} />
                </Button>
              </div>
            )
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="w-full h-7 text-xs border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              onClick={handleAdd}
              disabled={!product.is_available}
            >
              <ActionIcon size={12} className="mr-0.5" /> {actionLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
