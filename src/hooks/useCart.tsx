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
  addItem: (product: Product, quantity?: number, silent?: boolean) => Promise<void>;
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
      const items = (data as any as (CartItem & { product: Product })[]) || [];
      return items.filter(item => item.product?.is_available !== false);
    },
    enabled: !!user,
    staleTime: 30 * 1000, // 30s — keep cart fresh after order clears it
    gcTime: 60 * 60 * 1000,
  });

  const setOptimistic = useCallback((updater: (prev: (CartItem & { product: Product })[]) => (CartItem & { product: Product })[]) => {
    queryClient.setQueryData([...CART_QUERY_KEY, user?.id], (old: any) => updater(old || []));
  }, [queryClient, user?.id]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [...CART_QUERY_KEY, user?.id] });
    queryClient.invalidateQueries({ queryKey: ['cart-count', user?.id] });
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

  const addItem = useCallback(async (product: Product, quantity = 1, silent = false) => {
    if (!user) {
      toast.error('Please sign in to add items to cart');
      return;
    }

    // Optimistic update
    setOptimistic(prev => {
      const existing = prev.find(item => item.product_id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product_id === product.id ? { ...item, quantity: Math.min(item.quantity + quantity, 99) } : item
        );
      }
      return [...prev, {
        id: `temp-${crypto.randomUUID()}`,
        user_id: user.id,
        product_id: product.id,
        quantity,
        created_at: new Date().toISOString(),
        product,
        society_id: null,
      } as CartItem & { product: Product }];
    });

    const prevCount = queryClient.getQueryData(['cart-count', user?.id]);
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
          .update({ quantity: Math.min(existing.quantity + quantity, 99) })
          .eq('user_id', user.id)
          .eq('product_id', product.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cart_items')
          .insert({ user_id: user.id, product_id: product.id, quantity });
        if (error) throw error;
      }
      if (!silent) toast.success('Added to cart');
      queryClient.setQueryData(['cart-count', user?.id], (old: number | undefined) => (old || 0) + quantity);
      invalidate();
    } catch (error) {
      queryClient.setQueryData(['cart-count', user?.id], prevCount);
      invalidate(); // Rollback
      handleApiError(error, 'Failed to add item');
    }
  }, [user, setOptimistic, invalidate, queryClient]);

  // #24: Capture prev from queryClient to avoid stale closure
  const removeItem = useCallback(async (productId: string) => {
    if (!user) return;
    const prev = queryClient.getQueryData([...CART_QUERY_KEY, user?.id]) as any[] || [];
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
  }, [user, setOptimistic, queryClient]);

  const updateQuantity = useCallback(async (productId: string, quantity: number) => {
    if (!user) return;
    if (quantity <= 0) { await removeItem(productId); return; }
    // #17: Cap quantity at 99 to prevent unreasonable orders
    const cappedQuantity = Math.min(quantity, 99);

    const prev = queryClient.getQueryData([...CART_QUERY_KEY, user?.id]) as any[] || [];
    setOptimistic(old => old.map(item =>
      item.product_id === productId ? { ...item, quantity: cappedQuantity } : item
    ));

    try {
      const { error } = await supabase
        .from('cart_items')
        .update({ quantity: cappedQuantity })
        .eq('user_id', user.id)
        .eq('product_id', productId);
      if (error) throw error;
    } catch (error) {
      queryClient.setQueryData([...CART_QUERY_KEY, user?.id], prev);
      handleApiError(error, 'Failed to update quantity');
    }
  }, [user, setOptimistic, removeItem, queryClient]);

  const clearCart = useCallback(async () => {
    if (!user) return;
    const prev = queryClient.getQueryData([...CART_QUERY_KEY, user?.id]) as any[] || [];
    setOptimistic(() => []);

    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', user.id);
      if (error) throw error;
      // Sync cart-count query with cleared state
      queryClient.setQueryData(['cart-count', user?.id], 0);
    } catch (error) {
      queryClient.setQueryData([...CART_QUERY_KEY, user?.id], prev);
      console.error('Error clearing cart:', error);
    }
  }, [user, setOptimistic, queryClient]);

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
