import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Bell, ShoppingBag, ArrowRight } from 'lucide-react';
import { useCurrency } from '@/hooks/useCurrency';
import { motion, AnimatePresence } from 'framer-motion';

interface NewOrderAlertOverlayProps {
  order: { id: string; status: string; total_amount: number } | null;
  onDismiss: () => void;
}

function statusLabel(status: string): string {
  switch (status) {
    case 'enquired': return '📋 New Enquiry';
    case 'placed': return '🛒 New Order';
    case 'quoted': return '💬 Quote Request';
    default: return '🔔 New Order';
  }
}

export function NewOrderAlertOverlay({ order, onDismiss }: NewOrderAlertOverlayProps) {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();

  if (!order) return null;

  const handleView = () => {
    onDismiss();
    navigate(`/orders/${order.id}`);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-6"
        onClick={onDismiss}
      >
        <motion.div
          initial={{ scale: 0.8, y: 40 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.8, y: 40 }}
          transition={{ type: 'spring', damping: 20 }}
          className="bg-background rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Pulsing bell icon */}
          <div className="flex justify-center">
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 0.8 }}
              className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center"
            >
              <Bell size={32} className="text-accent" />
            </motion.div>
          </div>

          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold text-foreground">{statusLabel(order.status)}</h2>
            {order.total_amount > 0 && (
              <p className="text-2xl font-bold text-accent tabular-nums">{formatPrice(order.total_amount)}</p>
            )}
            <p className="text-sm text-muted-foreground">Tap to view and respond</p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 h-12 text-base"
              onClick={onDismiss}
            >
              Dismiss
            </Button>
            <Button
              className="flex-1 h-12 text-base bg-accent hover:bg-accent/90 text-accent-foreground gap-2"
              onClick={handleView}
            >
              <ShoppingBag size={18} />
              View
              <ArrowRight size={16} />
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
