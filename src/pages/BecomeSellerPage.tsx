import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { CATEGORIES, ProductCategory } from '@/types/database';
import { ArrowLeft, Store, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function BecomeSellerPage() {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    business_name: '',
    description: '',
    categories: [] as ProductCategory[],
    availability_start: '09:00',
    availability_end: '21:00',
    accepts_cod: true,
  });

  const handleCategoryChange = (category: ProductCategory, checked: boolean) => {
    if (checked) {
      setFormData({
        ...formData,
        categories: [...formData.categories, category],
      });
    } else {
      setFormData({
        ...formData,
        categories: formData.categories.filter((c) => c !== category),
      });
    }
  };

  const handleSubmit = async () => {
    if (!user) return;

    if (!formData.business_name.trim()) {
      toast.error('Please enter a business name');
      return;
    }

    if (formData.categories.length === 0) {
      toast.error('Please select at least one category');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.from('seller_profiles').insert({
        user_id: user.id,
        business_name: formData.business_name.trim(),
        description: formData.description.trim() || null,
        categories: formData.categories,
        availability_start: formData.availability_start,
        availability_end: formData.availability_end,
        accepts_cod: formData.accepts_cod,
      });

      if (error) throw error;

      // Add seller role
      await supabase.from('user_roles').insert({
        user_id: user.id,
        role: 'seller',
      });

      await refreshProfile();
      toast.success('Application submitted! Awaiting admin approval.');
      navigate('/seller');
    } catch (error: any) {
      console.error('Error submitting application:', error);
      toast.error(error.message || 'Failed to submit application');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppLayout showHeader={false} showNav={false}>
      <div className="p-4">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft size={20} />
          <span>Back</span>
        </Link>

        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
            <Store className="text-secondary-foreground" size={32} />
          </div>
          <h1 className="text-2xl font-bold">Become a Seller</h1>
          <p className="text-muted-foreground mt-2">
            Share your homemade food with Greenfield neighbors
          </p>
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="business_name">Business Name *</Label>
            <Input
              id="business_name"
              placeholder="e.g., Amma's Kitchen"
              value={formData.business_name}
              onChange={(e) =>
                setFormData({ ...formData, business_name: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Tell customers about your food..."
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
            />
          </div>

          <div className="space-y-3">
            <Label>Categories *</Label>
            <div className="grid grid-cols-2 gap-3">
              {CATEGORIES.map(({ value, label, icon }) => (
                <label
                  key={value}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    formData.categories.includes(value)
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  <Checkbox
                    checked={formData.categories.includes(value)}
                    onCheckedChange={(checked) =>
                      handleCategoryChange(value, checked as boolean)
                    }
                  />
                  <span className="text-lg">{icon}</span>
                  <span className="text-sm font-medium">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Availability Hours</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="start" className="text-xs text-muted-foreground">
                  Opens at
                </Label>
                <Input
                  id="start"
                  type="time"
                  value={formData.availability_start}
                  onChange={(e) =>
                    setFormData({ ...formData, availability_start: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="end" className="text-xs text-muted-foreground">
                  Closes at
                </Label>
                <Input
                  id="end"
                  type="time"
                  value={formData.availability_end}
                  onChange={(e) =>
                    setFormData({ ...formData, availability_end: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer">
            <Checkbox
              checked={formData.accepts_cod}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, accepts_cod: checked as boolean })
              }
            />
            <div>
              <span className="font-medium">Accept Cash on Delivery</span>
              <p className="text-xs text-muted-foreground">
                Allow customers to pay in cash
              </p>
            </div>
          </label>

          <div className="bg-muted rounded-lg p-4 text-sm">
            <h4 className="font-semibold mb-2">What happens next?</h4>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Your application will be reviewed by admin</li>
              <li>• Once approved, you can add products</li>
              <li>• Start receiving orders from neighbors!</li>
            </ul>
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="animate-spin mr-2" size={18} />
            ) : null}
            Submit Application
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
