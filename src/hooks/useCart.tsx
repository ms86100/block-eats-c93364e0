import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CartItem, Product } from '@/types/database';
import { toast } from 'sonner';

interface CartContextType {
  items: (CartItem & { product: Product })[];
  itemCount: number;
  totalAmount: number;
  currentSellerId: string | null;
  isLoading: boolean;
  addItem: (product: Product, quantity?: number) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refresh: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<(CartItem & { product: Product })[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchCart = async () => {
    if (!user) {
      setItems([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('cart_items')
        .select(`
          *,
          product:products(*, seller:seller_profiles(*))
        `)
        .eq('user_id', user.id);

      if (error) throw error;
      setItems((data as any) || []);
    } catch (error) {
      console.error('Error fetching cart:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCart();
  }, [user]);

  const currentSellerId = items.length > 0 ? items[0].product?.seller_id : null;

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  
  const totalAmount = items.reduce(
    (sum, item) => sum + (item.product?.price || 0) * item.quantity,
    0
  );

  const addItem = async (product: Product, quantity = 1) => {
    if (!user) {
      toast.error('Please sign in to add items to cart');
      return;
    }

    // Check if adding from different seller
    if (currentSellerId && currentSellerId !== product.seller_id) {
      toast.error('You can only order from one seller at a time. Clear your cart first.');
      return;
    }

    try {
      const existingItem = items.find(item => item.product_id === product.id);
      
      if (existingItem) {
        await updateQuantity(product.id, existingItem.quantity + quantity);
      } else {
        const { error } = await supabase
          .from('cart_items')
          .insert({
            user_id: user.id,
            product_id: product.id,
            quantity,
          });

        if (error) throw error;
        toast.success('Added to cart');
        await fetchCart();
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast.error('Failed to add item');
    }
  };

  const updateQuantity = async (productId: string, quantity: number) => {
    if (!user) return;

    try {
      if (quantity <= 0) {
        await removeItem(productId);
        return;
      }

      const { error } = await supabase
        .from('cart_items')
        .update({ quantity })
        .eq('user_id', user.id)
        .eq('product_id', productId);

      if (error) throw error;
      await fetchCart();
    } catch (error) {
      console.error('Error updating quantity:', error);
      toast.error('Failed to update quantity');
    }
  };

  const removeItem = async (productId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', user.id)
        .eq('product_id', productId);

      if (error) throw error;
      toast.success('Removed from cart');
      await fetchCart();
    } catch (error) {
      console.error('Error removing item:', error);
      toast.error('Failed to remove item');
    }
  };

  const clearCart = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
      setItems([]);
    } catch (error) {
      console.error('Error clearing cart:', error);
    }
  };

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        totalAmount,
        currentSellerId,
        isLoading,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        refresh: fetchCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
