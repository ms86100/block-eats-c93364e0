import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Ticket, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useCurrency } from '@/hooks/useCurrency';

interface CouponInputProps {
  sellerId: string;
  totalAmount: number;
  onApply: (coupon: { id: string; code: string; discountAmount: number }) => void;
  onRemove: () => void;
  appliedCoupon: { id: string; code: string; discountAmount: number } | null;
}

export function CouponInput({ sellerId, totalAmount, onApply, onRemove, appliedCoupon }: CouponInputProps) {
  const { formatPrice } = useCurrency();
  const { user, effectiveSocietyId } = useAuth();
  const [code, setCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  const handleApply = async () => {
    if (!code.trim() || !user || !effectiveSocietyId) return;
    setIsValidating(true);

    try {
      // Fetch coupon by code and society
      const { data: coupon, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', code.toUpperCase().trim())
        .eq('society_id', effectiveSocietyId)
        .eq('seller_id', sellerId)
        .eq('is_active', true)
        .single();

      if (error || !coupon) {
        toast.error('Invalid or expired coupon code');
        return;
      }

      // Check expiry
      if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
        toast.error('This coupon has expired');
        return;
      }

      // Check start date
      if (new Date(coupon.starts_at) > new Date()) {
        toast.error('This coupon is not yet active');
        return;
      }

      // Check usage limit
      if (coupon.usage_limit && coupon.times_used >= coupon.usage_limit) {
        toast.error('This coupon has reached its usage limit');
        return;
      }

      // Check per-user limit
      const { count } = await supabase
        .from('coupon_redemptions')
        .select('*', { count: 'exact', head: true })
        .eq('coupon_id', coupon.id)
        .eq('user_id', user.id);

      if (count !== null && count >= coupon.per_user_limit) {
        toast.error('You have already used this coupon');
        return;
      }

      // Check min order
      if (coupon.min_order_amount && totalAmount < coupon.min_order_amount) {
        toast.error(`Minimum order of ${formatPrice(coupon.min_order_amount)} required`);
        return;
      }

      // Calculate discount
      let discountAmount = 0;
      if (coupon.discount_type === 'percentage') {
        discountAmount = (totalAmount * coupon.discount_value) / 100;
        if (coupon.max_discount_amount) {
          discountAmount = Math.min(discountAmount, coupon.max_discount_amount);
        }
      } else {
        discountAmount = Math.min(coupon.discount_value, totalAmount);
      }

      discountAmount = Math.round(discountAmount * 100) / 100;

      onApply({ id: coupon.id, code: coupon.code, discountAmount });
      toast.success(`Coupon applied! You save ${formatPrice(discountAmount)}`);
    } catch {
      toast.error('Failed to validate coupon');
    } finally {
      setIsValidating(false);
    }
  };

  if (appliedCoupon) {
    return (
      <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <Check className="text-primary" size={18} />
          <div>
            <span className="font-mono font-bold text-primary text-sm">{appliedCoupon.code}</span>
            <p className="text-xs text-muted-foreground">You save {formatPrice(appliedCoupon.discountAmount)}</p>
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={onRemove}>
          <X size={16} />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
        <Input
          placeholder="Enter coupon code"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          className="pl-9 uppercase"
        />
      </div>
      <Button variant="outline" onClick={handleApply} disabled={isValidating || !code.trim()}>
        {isValidating ? 'Checking...' : 'Apply'}
      </Button>
    </div>
  );
}
