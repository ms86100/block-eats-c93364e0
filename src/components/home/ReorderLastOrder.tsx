import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { RefreshCw, Store, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useCurrency } from '@/hooks/useCurrency';

interface LastOrder {
  id: string;
  seller_name: string;
  item_count: number;
  total_amount: number;
  created_at: string;
  items: { product_id: string; quantity: number }[];
}

export function ReorderLastOrder() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const [lastOrder, setLastOrder] = useState<LastOrder | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('orders')
      .select(`
        id, total_amount, created_at,
        seller:seller_profiles!orders_seller_id_fkey(business_name),
        order_items(product_id, quantity)
      `)
      .eq('buyer_id', user.id)
      .in('status', ['completed', 'delivered'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data && data.order_items?.length > 0) {
          setLastOrder({
            id: data.id,
            seller_name: (data.seller as any)?.business_name || 'Seller',
            item_count: data.order_items.length,
            total_amount: data.total_amount,
            created_at: data.created_at,
            items: data.order_items.map((i: any) => ({
              product_id: i.product_id,
              quantity: i.quantity,
            })),
          });
        }
      });
  }, [user]);

  if (!lastOrder) return null;

  const handleReorder = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const productIds = lastOrder.items.map(i => i.product_id).filter(Boolean);
      const { data: available } = await supabase
        .from('products')
        .select('id, price')
        .in('id', productIds)
        .eq('is_available', true);

      if (!available?.length) {
        toast.error('Items from this order are no longer available');
        setIsLoading(false);
        return;
      }

      const availableSet = new Set(available.map(p => p.id));
      const unavailableCount = productIds.length - availableSet.size;

      // Clear existing cart and add items
      await supabase.from('cart_items').delete().eq('user_id', user.id);
      const inserts = lastOrder.items
        .filter(i => availableSet.has(i.product_id))
        .map(i => ({ user_id: user.id, product_id: i.product_id, quantity: i.quantity }));

      const { error } = await supabase.from('cart_items').insert(inserts);
      if (error) throw error;

      if (unavailableCount > 0) {
        toast.info(`${unavailableCount} item(s) were unavailable and skipped`);
      }
      toast.success('Cart rebuilt! Review and checkout.');
      navigate('/cart');
    } catch {
      toast.error('Failed to reorder');
    } finally {
      setIsLoading(false);
    }
  };

  const daysAgo = Math.floor((Date.now() - new Date(lastOrder.created_at).getTime()) / 86400000);
  const timeLabel = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo}d ago`;

  return (
    <div className="mx-4 mt-3">
      <button
        onClick={handleReorder}
        disabled={isLoading}
        className="w-full flex items-center gap-3 bg-card border border-border rounded-xl p-3 active:scale-[0.98] transition-all"
      >
        <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
          <RefreshCw size={18} className={`text-accent-foreground ${isLoading ? 'animate-spin' : ''}`} />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold text-foreground truncate">
            Reorder from {lastOrder.seller_name}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {lastOrder.item_count} item{lastOrder.item_count !== 1 ? 's' : ''} · {formatPrice(lastOrder.total_amount)} · {timeLabel}
          </p>
        </div>
        <ChevronRight size={16} className="text-muted-foreground shrink-0" />
      </button>
    </div>
  );
}
