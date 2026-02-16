import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CartItem, Product } from '@/types/database';
import { toast } from 'sonner';
import { handleApiError } from '@/lib/query-utils';

interface SellerGroup {
  sellerId: string;
  sellerName: string;
  items: (CartItem & { product: Product })[];
  subtotal: number;
}

interface CartContextType {
  items: (CartItem & { product: Product })[];
  itemCount: number;
  totalAmount: number;
  sellerGroups: SellerGroup[];
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

  const fetchCart = useCallback(async () => {
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
  }, [user]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  // Memoize derived values to prevent re-renders in consumers
  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const totalAmount = useMemo(
    () => items.reduce((sum, item) => sum + (item.product?.price || 0) * item.quantity, 0),
    [items]
  );

  // Memoize seller groups to prevent re-computation on every render
  const sellerGroups: SellerGroup[] = useMemo(() =>
    Object.values(
      items.reduce<Record<string, SellerGroup>>((groups, item) => {
        const sellerId = item.product?.seller_id || 'unknown';
        if (!groups[sellerId]) {
          groups[sellerId] = {
            sellerId,
            sellerName: (item.product as any)?.seller?.business_name || 'Seller',
            items: [],
            subtotal: 0,
          };
        }
        groups[sellerId].items.push(item);
        groups[sellerId].subtotal += (item.product?.price || 0) * item.quantity;
        return groups;
      }, {})
    ),
    [items]
  );

  const addItem = useCallback(async (product: Product, quantity = 1) => {
    if (!user) {
      toast.error('Please sign in to add items to cart');
      return;
    }

    setItems(prev => {
      const existingItem = prev.find(item => item.product_id === product.id);
      if (existingItem) {
        return prev.map(item =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      const optimisticItem = {
        id: `temp-${Date.now()}`,
        user_id: user.id,
        product_id: product.id,
        quantity,
        created_at: new Date().toISOString(),
        product,
      } as CartItem & { product: Product };
      return [...prev, optimisticItem];
    });

    try {
      const { data: existing } = await supabase
        .from('cart_items')
        .select('quantity')
        .eq('user_id', user.id)
        .eq('product_id', product.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('cart_items')
          .update({ quantity: existing.quantity + quantity })
          .eq('user_id', user.id)
          .eq('product_id', product.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cart_items')
          .insert({
            user_id: user.id,
            product_id: product.id,
            quantity,
          });
        if (error) throw error;
      }
      toast.success('Added to cart');
      // Sync with server to get real IDs
      await fetchCart();
    } catch (error) {
      // Rollback on failure by refetching
      await fetchCart();
      handleApiError(error, 'Failed to add item');
    }
  }, [user, fetchCart]);

  const updateQuantity = useCallback(async (productId: string, quantity: number) => {
    if (!user) return;

    if (quantity <= 0) {
      await removeItem(productId);
      return;
    }

    const prevItems = items;

    // Optimistic update
    setItems(prev =>
      prev.map(item =>
        item.product_id === productId ? { ...item, quantity } : item
      )
    );

    try {
      const { error } = await supabase
        .from('cart_items')
        .update({ quantity })
        .eq('user_id', user.id)
        .eq('product_id', productId);

      if (error) throw error;
    } catch (error) {
      setItems(prevItems);
      handleApiError(error, 'Failed to update quantity');
    }
  }, [user, items]);

  const removeItem = useCallback(async (productId: string) => {
    if (!user) return;

    const prevItems = items;

    // Optimistic removal
    setItems(prev => prev.filter(item => item.product_id !== productId));

    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', user.id)
        .eq('product_id', productId);

      if (error) throw error;
      toast.success('Removed from cart');
    } catch (error) {
      setItems(prevItems);
      handleApiError(error, 'Failed to remove item');
    }
  }, [user, items]);

  const clearCart = useCallback(async () => {
    if (!user) return;

    const prevItems = items;
    setItems([]);

    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
    } catch (error) {
      setItems(prevItems);
      console.error('Error clearing cart:', error);
    }
  }, [user, items]);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo<CartContextType>(() => ({
    items,
    itemCount,
    totalAmount,
    sellerGroups,
    isLoading,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    refresh: fetchCart,
  }), [items, itemCount, totalAmount, sellerGroups, isLoading, addItem, updateQuantity, removeItem, clearCart, fetchCart]);

  return (
    <CartContext.Provider value={contextValue}>
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
