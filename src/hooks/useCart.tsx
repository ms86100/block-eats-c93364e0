import { createContext, useContext, useCallback, useMemo, ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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

const CART_QUERY_KEY = ['cart-items'] as const;

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // React Query — cached, deduplicated, background-refreshed
  const { data: items = [], isLoading } = useQuery({
    queryKey: [...CART_QUERY_KEY, user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('cart_items')
        .select(`*, product:products(*, seller:seller_profiles(*))`)
        .eq('user_id', user.id);
      if (error) throw error;
      return (data as any as (CartItem & { product: Product })[]) || [];
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000, // 10 min — cart rarely changes from other devices
    gcTime: 60 * 60 * 1000,
  });

  const setOptimistic = useCallback((updater: (prev: (CartItem & { product: Product })[]) => (CartItem & { product: Product })[]) => {
    queryClient.setQueryData([...CART_QUERY_KEY, user?.id], (old: any) => updater(old || []));
  }, [queryClient, user?.id]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [...CART_QUERY_KEY, user?.id] });
  }, [queryClient, user?.id]);

  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const totalAmount = useMemo(
    () => items.reduce((sum, item) => sum + (item.product?.price || 0) * item.quantity, 0),
    [items]
  );

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

    // Optimistic update
    setOptimistic(prev => {
      const existing = prev.find(item => item.product_id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product_id === product.id ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [...prev, {
        id: `temp-${Date.now()}`,
        user_id: user.id,
        product_id: product.id,
        quantity,
        created_at: new Date().toISOString(),
        product,
        society_id: null,
      } as CartItem & { product: Product }];
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
          .insert({ user_id: user.id, product_id: product.id, quantity });
        if (error) throw error;
      }
      toast.success('Added to cart');
      invalidate(); // Sync with server for real IDs
    } catch (error) {
      invalidate(); // Rollback
      handleApiError(error, 'Failed to add item');
    }
  }, [user, setOptimistic, invalidate]);

  const removeItem = useCallback(async (productId: string) => {
    if (!user) return;
    const prev = items;
    setOptimistic(old => old.filter(item => item.product_id !== productId));

    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', user.id)
        .eq('product_id', productId);
      if (error) throw error;
      toast.success('Removed from cart');
    } catch (error) {
      queryClient.setQueryData([...CART_QUERY_KEY, user?.id], prev);
      handleApiError(error, 'Failed to remove item');
    }
  }, [user, items, setOptimistic, queryClient]);

  const updateQuantity = useCallback(async (productId: string, quantity: number) => {
    if (!user) return;
    if (quantity <= 0) { await removeItem(productId); return; }

    const prev = items;
    setOptimistic(old => old.map(item =>
      item.product_id === productId ? { ...item, quantity } : item
    ));

    try {
      const { error } = await supabase
        .from('cart_items')
        .update({ quantity })
        .eq('user_id', user.id)
        .eq('product_id', productId);
      if (error) throw error;
    } catch (error) {
      queryClient.setQueryData([...CART_QUERY_KEY, user?.id], prev);
      handleApiError(error, 'Failed to update quantity');
    }
  }, [user, items, setOptimistic, removeItem, queryClient]);

  const clearCart = useCallback(async () => {
    if (!user) return;
    const prev = items;
    setOptimistic(() => []);

    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', user.id);
      if (error) throw error;
    } catch (error) {
      queryClient.setQueryData([...CART_QUERY_KEY, user?.id], prev);
      console.error('Error clearing cart:', error);
    }
  }, [user, items, setOptimistic, queryClient]);

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
    refresh: async () => { invalidate(); },
  }), [items, itemCount, totalAmount, sellerGroups, isLoading, addItem, updateQuantity, removeItem, clearCart, invalidate]);

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
