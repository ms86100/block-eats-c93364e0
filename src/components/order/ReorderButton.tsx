import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { OrderItem } from '@/types/database';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface ReorderButtonProps {
  orderItems: OrderItem[];
  sellerId: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function ReorderButton({ 
  orderItems, 
  sellerId, 
  variant = 'default',
  size = 'default',
  className 
}: ReorderButtonProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleReorder = async () => {
    if (!user) {
      toast.error('Please log in to reorder');
      return;
    }

    if (orderItems.length === 0) {
      toast.error('No items to reorder');
      return;
    }

    setIsLoading(true);
    try {
      // First, check which products still exist and are available
      const productIds = orderItems
        .filter(item => item.product_id)
        .map(item => item.product_id);

      const { data: availableProducts } = await supabase
        .from('products')
        .select('id, price, seller_id')
        .in('id', productIds)
        .eq('is_available', true);

      if (!availableProducts || availableProducts.length === 0) {
        toast.error('None of these items are currently available');
        setIsLoading(false);
        return;
      }

      // Clear existing cart items from this seller (optional - or merge)
      await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', user.id);

      // Add items to cart
      const cartInserts = orderItems
        .filter(item => 
          item.product_id && 
          availableProducts.some(p => p.id === item.product_id)
        )
        .map(item => ({
          user_id: user.id,
          product_id: item.product_id!,
          quantity: item.quantity,
        }));

      if (cartInserts.length === 0) {
        toast.error('None of these items are currently available');
        setIsLoading(false);
        return;
      }

      const { error } = await supabase
        .from('cart_items')
        .insert(cartInserts);

      if (error) throw error;

      const unavailableCount = orderItems.length - cartInserts.length;
      if (unavailableCount > 0) {
        toast.info(`${unavailableCount} item(s) were unavailable and skipped`);
      }

      toast.success('Items added to cart!');
      navigate('/cart');
    } catch (error) {
      console.error('Error reordering:', error);
      toast.error('Failed to reorder. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleReorder}
      disabled={isLoading}
      className={className}
    >
      <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
      {size !== 'icon' && <span className="ml-2">{isLoading ? 'Adding...' : 'Reorder'}</span>}
    </Button>
  );
}
