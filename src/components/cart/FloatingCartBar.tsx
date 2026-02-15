import { Link } from 'react-router-dom';
import { ShoppingCart, ChevronRight } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { cn } from '@/lib/utils';

interface FloatingCartBarProps {
  className?: string;
}

export function FloatingCartBar({ className }: FloatingCartBarProps) {
  const { itemCount, totalAmount } = useCart();

  if (itemCount === 0) return null;

  return (
    <div className={cn('fixed bottom-16 left-0 right-0 z-40 px-4 pb-2 safe-bottom', className)}>
      <Link to="/cart">
        <div className="bg-primary rounded-xl px-4 py-3 flex items-center justify-between shadow-lg animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="relative">
              <ShoppingCart size={20} className="text-primary-foreground" />
              <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-primary-foreground text-primary text-[9px] font-bold flex items-center justify-center">
                {itemCount > 9 ? '9+' : itemCount}
              </span>
            </div>
            <div>
              <p className="text-primary-foreground text-sm font-semibold">
                {itemCount} item{itemCount !== 1 ? 's' : ''}
              </p>
              <p className="text-primary-foreground/80 text-xs">₹{totalAmount}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-primary-foreground font-semibold text-sm">
            View Cart
            <ChevronRight size={16} />
          </div>
        </div>
      </Link>
    </div>
  );
}
