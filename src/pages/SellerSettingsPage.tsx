import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { SellerProfile, CATEGORIES, ProductCategory, DAYS_OF_WEEK } from '@/types/database';
import { ArrowLeft, Loader2, Camera } from 'lucide-react';
import { toast } from 'sonner';

export default function SellerSettingsPage() {
  const { user } = useAuth();
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    business_name: '',
    description: '',
    categories: [] as ProductCategory[],
    availability_start: '09:00',
    availability_end: '21:00',
    operating_days: DAYS_OF_WEEK as string[],
    accepts_cod: true,
  });

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('seller_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setSellerProfile(data as SellerProfile);
        setFormData({
          business_name: data.business_name,
          description: data.description || '',
          categories: data.categories || [],
          availability_start: data.availability_start || '09:00',
          availability_end: data.availability_end || '21:00',
          operating_days: data.operating_days || DAYS_OF_WEEK,
          accepts_cod: data.accepts_cod,
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

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

  const handleDayChange = (day: string, checked: boolean) => {
    if (checked) {
      setFormData({
        ...formData,
        operating_days: [...formData.operating_days, day],
      });
    } else {
      setFormData({
        ...formData,
        operating_days: formData.operating_days.filter((d) => d !== day),
      });
    }
  };

  const handleSave = async () => {
    if (!sellerProfile) return;

    if (!formData.business_name.trim()) {
      toast.error('Please enter a business name');
      return;
    }

    if (formData.categories.length === 0) {
      toast.error('Please select at least one category');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('seller_profiles')
        .update({
          business_name: formData.business_name.trim(),
          description: formData.description.trim() || null,
          categories: formData.categories,
          availability_start: formData.availability_start,
          availability_end: formData.availability_end,
          operating_days: formData.operating_days,
          accepts_cod: formData.accepts_cod,
        })
        .eq('id', sellerProfile.id);

      if (error) throw error;

      toast.success('Settings saved successfully');
    } catch (error: any) {
      console.error('Error saving:', error);
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout showHeader={false}>
        <div className="p-4">
          <Skeleton className="h-8 w-32 mb-4" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  if (!sellerProfile) {
    return (
      <AppLayout showHeader={false}>
        <div className="p-4 text-center py-12">
          <p className="text-muted-foreground">Seller profile not found</p>
          <Link to="/become-seller">
            <Button className="mt-4">Become a Seller</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout showHeader={false} showNav={false}>
      <div className="p-4 pb-24">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/seller" className="text-muted-foreground">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-xl font-bold">Store Settings</h1>
        </div>

        <div className="space-y-5">
          {/* Cover & Profile Images */}
          <div className="bg-card rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold mb-3">Store Images</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Cover Image</Label>
                <div className="mt-1 aspect-video bg-muted rounded-lg flex items-center justify-center relative overflow-hidden">
                  {sellerProfile.cover_image_url ? (
                    <img
                      src={sellerProfile.cover_image_url}
                      alt="Cover"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Camera className="text-muted-foreground" size={24} />
                  )}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Profile Photo</Label>
                <div className="mt-1 aspect-square bg-muted rounded-lg flex items-center justify-center relative overflow-hidden">
                  {sellerProfile.profile_image_url ? (
                    <img
                      src={sellerProfile.profile_image_url}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Camera className="text-muted-foreground" size={24} />
                  )}
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Image upload coming soon
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="business_name">Business Name *</Label>
            <Input
              id="business_name"
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

          <div className="space-y-3">
            <Label>Operating Days</Label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((day) => (
                <label
                  key={day}
                  className={`flex items-center justify-center w-12 h-10 rounded-lg border cursor-pointer transition-colors ${
                    formData.operating_days.includes(day)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground'
                  }`}
                >
                  <Checkbox
                    checked={formData.operating_days.includes(day)}
                    onCheckedChange={(checked) =>
                      handleDayChange(day, checked as boolean)
                    }
                    className="hidden"
                  />
                  <span className="text-xs font-medium">{day}</span>
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

          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <p className="font-medium">Accept Cash on Delivery</p>
              <p className="text-xs text-muted-foreground">
                Allow customers to pay in cash
              </p>
            </div>
            <Switch
              checked={formData.accepts_cod}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, accepts_cod: checked })
              }
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-card border-t safe-bottom">
        <Button className="w-full" onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
          Save Changes
        </Button>
      </div>
    </AppLayout>
  );
}
