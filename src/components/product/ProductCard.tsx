import { Plus, Minus, Star, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { VegBadge } from '@/components/ui/veg-badge';
import { Badge } from '@/components/ui/badge';
import { Product } from '@/types/database';
import { useCart } from '@/hooks/useCart';
import { cn } from '@/lib/utils';

interface ProductCardProps {
  product: Product;
  variant?: 'horizontal' | 'vertical';
}

export function ProductCard({ product, variant = 'horizontal' }: ProductCardProps) {
  const { items, addItem, updateQuantity } = useCart();
  const cartItem = items.find((item) => item.product_id === product.id);
  const quantity = cartItem?.quantity || 0;

  const handleAdd = () => {
    addItem(product);
  };

  const handleIncrement = () => {
    updateQuantity(product.id, quantity + 1);
  };

  const handleDecrement = () => {
    updateQuantity(product.id, quantity - 1);
  };

  if (variant === 'vertical') {
    return (
      <Card className="overflow-hidden">
        <div className="relative aspect-square">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <span className="text-3xl">🍽️</span>
            </div>
          )}
          {!product.is_available && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="text-white text-sm font-medium">Unavailable</span>
            </div>
          )}
          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {product.is_bestseller && (
              <Badge className="bg-warning text-warning-foreground text-[10px] px-1.5">
                <Star size={10} className="mr-0.5 fill-current" />
                Bestseller
              </Badge>
            )}
            {product.is_recommended && (
              <Badge className="bg-success text-white text-[10px] px-1.5">
                <Award size={10} className="mr-0.5" />
                Recommended
              </Badge>
            )}
          </div>
        </div>
        <CardContent className="p-3">
          <div className="flex items-start gap-2">
            <VegBadge isVeg={product.is_veg} size="sm" className="mt-1" />
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm truncate">{product.name}</h4>
              <p className="text-sm font-semibold text-primary mt-1">
                ₹{product.price}
              </p>
            </div>
          </div>
          <div className="mt-3">
            {quantity === 0 ? (
              <Button
                size="sm"
                variant="outline"
                className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                onClick={handleAdd}
                disabled={!product.is_available}
              >
                Add
              </Button>
            ) : (
              <div className="flex items-center justify-center gap-3 border border-primary rounded-md">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-primary"
                  onClick={handleDecrement}
                >
                  <Minus size={16} />
                </Button>
                <span className="font-semibold text-primary w-6 text-center">
                  {quantity}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-primary"
                  onClick={handleIncrement}
                >
                  <Plus size={16} />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex gap-3 py-4 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <VegBadge isVeg={product.is_veg} size="sm" className="mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-medium">{product.name}</h4>
              {product.is_bestseller && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-warning/20 text-warning-foreground">
                  <Star size={10} className="mr-0.5 fill-warning text-warning" />
                  Bestseller
                </Badge>
              )}
              {product.is_recommended && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-success/20 text-success">
                  Recommended
                </Badge>
              )}
            </div>
            {product.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {product.description}
              </p>
            )}
            <p className="font-semibold mt-2">₹{product.price}</p>
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="relative w-24 h-24 rounded-lg overflow-hidden">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <span className="text-2xl">🍽️</span>
            </div>
          )}
        </div>
        {quantity === 0 ? (
          <Button
            size="sm"
            variant="outline"
            className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground -mt-4 relative z-10 bg-background shadow-sm"
            onClick={handleAdd}
            disabled={!product.is_available}
          >
            Add +
          </Button>
        ) : (
          <div className="flex items-center gap-2 -mt-4 relative z-10 bg-primary rounded-md px-2 shadow-sm">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-primary-foreground hover:bg-primary-foreground/20"
              onClick={handleDecrement}
            >
              <Minus size={14} />
            </Button>
            <span className="font-semibold text-primary-foreground w-4 text-center">
              {quantity}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-primary-foreground hover:bg-primary-foreground/20"
              onClick={handleIncrement}
            >
              <Plus size={14} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
