import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CartItem, Product } from '@/types/database';
import { toast } from 'sonner';
import { useCategoryConfigs } from '@/hooks/useCategoryBehavior';
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
  const { configs: categoryConfigs } = useCategoryConfigs();
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

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  
  const totalAmount = items.reduce(
    (sum, item) => sum + (item.product?.price || 0) * item.quantity,
    0
  );

  // Group items by seller for multi-vendor support
  const sellerGroups: SellerGroup[] = Object.values(
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
  );

  const addItem = async (product: Product, quantity = 1) => {
    if (!user) {
      toast.error('Please sign in to add items to cart');
      return;
    }

    // Client-side guard: check product-level action_type first, then category
    const actionType = (product as any).action_type || 'add_to_cart';
    if (actionType !== 'add_to_cart' && actionType !== 'buy_now') {
      toast.error('This item uses a different flow — tap to view details.');
      return;
    }

    const productCategory = (product as any).category;
    if (productCategory && categoryConfigs.length > 0) {
      const catConfig = categoryConfigs.find(c => c.category === productCategory);
      if (catConfig && !catConfig.behavior?.supportsCart) {
        toast.error('This item uses a booking or enquiry flow — tap to view details.');
        return;
      }
    }

    const existingItem = items.find(item => item.product_id === product.id);
    const prevItems = [...items];

    // Optimistic update
    if (existingItem) {
      setItems(prev =>
        prev.map(item =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        )
      );
    } else {
      const optimisticItem = {
        id: `temp-${Date.now()}`,
        user_id: user.id,
        product_id: product.id,
        quantity,
        created_at: new Date().toISOString(),
        product,
      } as CartItem & { product: Product };
      setItems(prev => [...prev, optimisticItem]);
    }

    try {
      if (existingItem) {
        const { error } = await supabase
          .from('cart_items')
          .update({ quantity: existingItem.quantity + quantity })
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
      // Rollback on failure
      setItems(prevItems);
      handleApiError(error, 'Failed to add item');
    }
  };

  const updateQuantity = async (productId: string, quantity: number) => {
    if (!user) return;

    if (quantity <= 0) {
      await removeItem(productId);
      return;
    }

    const prevItems = [...items];

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
  };

  const removeItem = async (productId: string) => {
    if (!user) return;

    const prevItems = [...items];

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
  };

  const clearCart = async () => {
    if (!user) return;

    const prevItems = [...items];
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
  };

  return (
    <CartContext.Provider
      value={{
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