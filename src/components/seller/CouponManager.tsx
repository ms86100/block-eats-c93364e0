import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Ticket, Plus, Trash2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useCurrency } from '@/hooks/useCurrency';

interface Coupon {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  min_order_amount: number | null;
  max_discount_amount: number | null;
  usage_limit: number | null;
  times_used: number;
  per_user_limit: number;
  is_active: boolean;
  starts_at: string;
  expires_at: string | null;
  created_at: string;
}

export function CouponManager() {
  const { currentSellerId, profile, viewAsSocietyId } = useAuth();
  const { formatPrice, currencySymbol } = useCurrency();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    discount_type: 'percentage',
    discount_value: '',
    min_order_amount: '',
    max_discount_amount: '',
    usage_limit: '',
    per_user_limit: '1',
    expires_at: '',
  });

  useEffect(() => {
    if (currentSellerId) fetchCoupons();
  }, [currentSellerId]);

  const fetchCoupons = async () => {
    if (!currentSellerId) return;
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('seller_id', currentSellerId)
      .order('created_at', { ascending: false });
    if (!error) setCoupons((data as Coupon[]) || []);
    setIsLoading(false);
  };

  const handleCreate = async () => {
    if (!currentSellerId || !profile?.society_id) {
      toast.error('Missing seller or society information');
      return;
    }
    if (!formData.code || !formData.discount_value) {
      toast.error('Code and discount value are required');
      return;
    }

    const { error } = await supabase.from('coupons').insert({
      seller_id: currentSellerId,
      society_id: profile.society_id,
      code: formData.code.toUpperCase().trim(),
      discount_type: formData.discount_type,
      discount_value: Number(formData.discount_value),
      min_order_amount: formData.min_order_amount ? Number(formData.min_order_amount) : 0,
      max_discount_amount: formData.max_discount_amount ? Number(formData.max_discount_amount) : null,
      usage_limit: formData.usage_limit ? Number(formData.usage_limit) : null,
      per_user_limit: Number(formData.per_user_limit) || 1,
      expires_at: formData.expires_at || null,
    });

    if (error) {
      if (error.message.includes('unique')) toast.error('This coupon code already exists in your society');
      else toast.error('Failed to create coupon');
      return;
    }

    toast.success('Coupon created!');
    setShowForm(false);
    setFormData({ code: '', discount_type: 'percentage', discount_value: '', min_order_amount: '', max_discount_amount: '', usage_limit: '', per_user_limit: '1', expires_at: '' });
    fetchCoupons();
  };

  const toggleCoupon = async (id: string, isActive: boolean) => {
    await supabase.from('coupons').update({ is_active: !isActive }).eq('id', id);
    setCoupons(coupons.map(c => c.id === id ? { ...c, is_active: !isActive } : c));
  };

  const deleteCoupon = async (id: string) => {
    await supabase.from('coupons').delete().eq('id', id);
    setCoupons(coupons.filter(c => c.id !== id));
    toast.success('Coupon deleted');
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied!');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Ticket className="text-primary" size={20} />
          Promotions & Coupons
        </h3>
        <Button size="sm" onClick={() => setShowForm(!showForm)} disabled={!!viewAsSocietyId}>
          <Plus size={16} className="mr-1" />
          {showForm ? 'Cancel' : 'New Coupon'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Code</Label>
                <Input placeholder="e.g. WELCOME10" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} className="uppercase" />
              </div>
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={formData.discount_type} onValueChange={v => setFormData({ ...formData, discount_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="flat">Flat ({currencySymbol})</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Discount Value</Label>
                <Input type="number" placeholder={formData.discount_type === 'percentage' ? '10' : '50'} value={formData.discount_value} onChange={e => setFormData({ ...formData, discount_value: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Min Order ({currencySymbol})</Label>
                <Input type="number" placeholder="0" value={formData.min_order_amount} onChange={e => setFormData({ ...formData, min_order_amount: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Max Discount ({currencySymbol})</Label>
                <Input type="number" placeholder="No limit" value={formData.max_discount_amount} onChange={e => setFormData({ ...formData, max_discount_amount: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Usage Limit</Label>
                <Input type="number" placeholder="Unlimited" value={formData.usage_limit} onChange={e => setFormData({ ...formData, usage_limit: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Per User Limit</Label>
                <Input type="number" value={formData.per_user_limit} onChange={e => setFormData({ ...formData, per_user_limit: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Expires At</Label>
                <Input type="datetime-local" value={formData.expires_at} onChange={e => setFormData({ ...formData, expires_at: e.target.value })} />
              </div>
            </div>
            <Button onClick={handleCreate} className="w-full">Create Coupon</Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-4">Loading coupons...</p>
      ) : coupons.length === 0 ? (
        <div className="text-center py-8 bg-muted rounded-xl">
          <Ticket className="mx-auto text-muted-foreground mb-2" size={32} />
          <p className="text-sm text-muted-foreground">No coupons yet. Create one to attract more customers!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {coupons.map((coupon) => (
            <Card key={coupon.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-bold text-primary">{coupon.code}</span>
                      <button onClick={() => copyCode(coupon.code)}><Copy size={14} className="text-muted-foreground" /></button>
                      <Badge variant={coupon.is_active ? 'default' : 'secondary'}>
                        {coupon.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {coupon.discount_type === 'percentage' ? `${coupon.discount_value}% off` : `${formatPrice(coupon.discount_value)} off`}
                      {coupon.min_order_amount ? ` on orders above ${formatPrice(coupon.min_order_amount)}` : ''}
                      {coupon.max_discount_amount ? ` (max ${formatPrice(coupon.max_discount_amount)})` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Used: {coupon.times_used}{coupon.usage_limit ? `/${coupon.usage_limit}` : ''} times
                      {coupon.expires_at && ` · Expires: ${format(new Date(coupon.expires_at), 'dd MMM yyyy')}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={coupon.is_active} onCheckedChange={() => toggleCoupon(coupon.id, coupon.is_active)} />
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteCoupon(coupon.id)}>
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
