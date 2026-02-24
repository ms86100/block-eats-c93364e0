import { Link, useLocation } from 'react-router-dom';
import { ShoppingCart, ChevronRight } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { useCurrency } from '@/hooks/useCurrency';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface FloatingCartBarProps {
  className?: string;
}

export function FloatingCartBar({ className }: FloatingCartBarProps) {
  const { itemCount, totalAmount, items } = useCart();
  const { formatPrice } = useCurrency();
  const location = useLocation();

  if (itemCount === 0 || location.pathname === '/cart') return null;

  const thumbnails = items
    .filter(i => i.product?.image_url)
    .slice(0, 3)
    .map(i => i.product!.image_url!);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className={cn('fixed bottom-20 left-0 right-0 z-40 px-3 pb-2 safe-bottom', className)}
      >
        <Link to="/cart">
          <motion.div
            className="rounded-2xl bg-primary px-4 py-3.5 flex items-center justify-between shadow-cta"
            whileTap={{ scale: 0.97 }}
          >
            <div className="flex items-center gap-2.5">
              {/* Product thumbnails */}
              {thumbnails.length > 0 && (
                <div className="flex -space-x-2">
                  {thumbnails.map((url, i) => (
                    <div key={i} className="w-7 h-7 rounded-full border-2 border-primary-foreground/20 overflow-hidden product-image-bg">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
              <div>
                <p className="text-primary-foreground text-sm font-bold">
                  {itemCount} item{itemCount !== 1 ? 's' : ''} · {formatPrice(totalAmount)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-0.5 text-primary-foreground font-bold text-sm">
              View Cart
              <ChevronRight size={14} />
            </div>
          </motion.div>
        </Link>
      </motion.div>
    </AnimatePresence>
  );
}
