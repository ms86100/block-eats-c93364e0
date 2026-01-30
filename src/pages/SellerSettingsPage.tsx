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
import { Card, CardContent } from '@/components/ui/card';
import { ImageUpload } from '@/components/ui/image-upload';
import { useAuth } from '@/contexts/AuthContext';
import { SellerProfile, CATEGORIES, ProductCategory, DAYS_OF_WEEK } from '@/types/database';
import { useCategoryConfigs } from '@/hooks/useCategoryBehavior';
import { PARENT_GROUPS, ParentGroup, ServiceCategory } from '@/types/categories';
import { ArrowLeft, Loader2, PauseCircle, PlayCircle, Clock, Smartphone, Banknote, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function SellerSettingsPage() {
  const { user } = useAuth();
  const { groupedConfigs } = useCategoryConfigs();
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null);
  const [primaryGroup, setPrimaryGroup] = useState<ParentGroup | null>(null);
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
    accepts_upi: false,
    upi_id: '',
    is_available: true,
    cover_image_url: null as string | null,
    profile_image_url: null as string | null,
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
        const profile = data as any;
        setSellerProfile(profile);
        // Derive primary group from existing data or stored value
        const storedGroup = profile.primary_group as ParentGroup | null;
        setPrimaryGroup(storedGroup);
        setFormData({
          business_name: profile.business_name,
          description: profile.description || '',
          categories: profile.categories || [],
          availability_start: profile.availability_start?.slice(0, 5) || '09:00',
          availability_end: profile.availability_end?.slice(0, 5) || '21:00',
          operating_days: profile.operating_days || DAYS_OF_WEEK,
          accepts_cod: profile.accepts_cod ?? true,
          accepts_upi: profile.accepts_upi ?? false,
          upi_id: profile.upi_id || '',
          is_available: profile.is_available ?? true,
          cover_image_url: profile.cover_image_url || null,
          profile_image_url: profile.profile_image_url || null,
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCategoryChange = (category: ProductCategory, checked: boolean) => {
    // Get allowed categories for this seller's primary group
    const allowedCategories = primaryGroup ? groupedConfigs[primaryGroup]?.map(c => c.category) || [] : [];
    
    // Only allow categories within the seller's primary group
    if (!allowedCategories.includes(category as any) && checked) {
      toast.error(`This category is not available in your ${primaryGroup} group`);
      return;
    }
    
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

  const togglePauseShop = async () => {
    if (!sellerProfile) return;

    const newAvailability = !formData.is_available;
    setFormData({ ...formData, is_available: newAvailability });

    try {
      const { error } = await supabase
        .from('seller_profiles')
        .update({ is_available: newAvailability })
        .eq('id', sellerProfile.id);

      if (error) throw error;
      toast.success(newAvailability ? 'Store is now open!' : 'Store paused temporarily');
    } catch (error) {
      setFormData({ ...formData, is_available: !newAvailability });
      toast.error('Failed to update store status');
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

    if (formData.accepts_upi && !formData.upi_id.trim()) {
      toast.error('Please enter your UPI ID');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('seller_profiles')
        .update({
          business_name: formData.business_name.trim(),
          description: formData.description.trim() || null,
          categories: formData.categories as any,
          availability_start: formData.availability_start,
          availability_end: formData.availability_end,
          operating_days: formData.operating_days,
          accepts_cod: formData.accepts_cod,
          accepts_upi: formData.accepts_upi,
          upi_id: formData.accepts_upi ? formData.upi_id.trim() : null,
          is_available: formData.is_available,
          cover_image_url: formData.cover_image_url,
          profile_image_url: formData.profile_image_url,
        } as any)
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
          {/* Quick Pause/Resume Shop */}
          <Card className={formData.is_available ? 'border-success/30 bg-success/5' : 'border-warning/30 bg-warning/5'}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {formData.is_available ? (
                    <PlayCircle className="text-success" size={28} />
                  ) : (
                    <PauseCircle className="text-warning" size={28} />
                  )}
                  <div>
                    <p className="font-semibold">
                      {formData.is_available ? 'Store is Open' : 'Store is Paused'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formData.is_available
                        ? 'Customers can place orders'
                        : 'Temporarily not accepting orders'}
                    </p>
                  </div>
                </div>
                <Button
                  variant={formData.is_available ? 'outline' : 'default'}
                  size="sm"
                  onClick={togglePauseShop}
                >
                  {formData.is_available ? 'Pause Shop' : 'Resume Shop'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Cover & Profile Images */}
          <div className="bg-card rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold mb-3">Store Images</h3>
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Cover Image</Label>
                {user && (
                  <ImageUpload
                    value={formData.cover_image_url}
                    onChange={(url) => setFormData({ ...formData, cover_image_url: url })}
                    folder="sellers"
                    userId={user.id}
                    aspectRatio="video"
                    placeholder="Upload cover photo"
                  />
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Profile Photo</Label>
                {user && (
                  <ImageUpload
                    value={formData.profile_image_url}
                    onChange={(url) => setFormData({ ...formData, profile_image_url: url })}
                    folder="sellers"
                    userId={user.id}
                    aspectRatio="square"
                    placeholder="Upload profile photo"
                  />
                )}
              </div>
            </div>
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

          {/* Primary Group Info */}
          {primaryGroup && (
            <div className="bg-muted/50 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center text-2xl',
                  PARENT_GROUPS.find(g => g.value === primaryGroup)?.color
                )}>
                  {PARENT_GROUPS.find(g => g.value === primaryGroup)?.icon}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Your seller category</p>
                  <p className="font-semibold">{PARENT_GROUPS.find(g => g.value === primaryGroup)?.label}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <AlertTriangle size={12} />
                To change category group, please contact admin
              </p>
            </div>
          )}

          <div className="space-y-3">
            <Label>Categories * {primaryGroup && <span className="text-muted-foreground font-normal">(within {PARENT_GROUPS.find(g => g.value === primaryGroup)?.label})</span>}</Label>
            <div className="grid grid-cols-2 gap-3">
              {(primaryGroup ? groupedConfigs[primaryGroup] || [] : CATEGORIES.map(c => ({ category: c.value, displayName: c.label, icon: c.icon }))).map((config) => (
                <label
                  key={config.category}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    formData.categories.includes(config.category as any)
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  <Checkbox
                    checked={formData.categories.includes(config.category as any)}
                    onCheckedChange={(checked) =>
                      handleCategoryChange(config.category as any, checked as boolean)
                    }
                  />
                  <span className="text-lg">{config.icon}</span>
                  <span className="text-sm font-medium">{config.displayName}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-muted-foreground" />
              <Label>Operating Days</Label>
            </div>
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
            <p className="text-xs text-muted-foreground">
              Store will auto-close on non-operating days
            </p>
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
            <p className="text-xs text-muted-foreground">
              Store will auto-open/close based on schedule
            </p>
          </div>

          {/* Payment Methods */}
          <div className="space-y-3">
            <Label>Payment Methods</Label>
            
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <Banknote className="text-success" size={20} />
                <div>
                  <p className="font-medium text-sm">Cash on Delivery</p>
                  <p className="text-xs text-muted-foreground">Accept cash payments</p>
                </div>
              </div>
              <Switch
                checked={formData.accepts_cod}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, accepts_cod: checked })
                }
              />
            </div>

            <div className="p-4 bg-muted rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Smartphone className="text-info" size={20} />
                  <div>
                    <p className="font-medium text-sm">UPI Payments</p>
                    <p className="text-xs text-muted-foreground">GPay, PhonePe, Paytm</p>
                  </div>
                </div>
                <Switch
                  checked={formData.accepts_upi}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, accepts_upi: checked })
                  }
                />
              </div>
              
              {formData.accepts_upi && (
                <div className="space-y-2 pt-2 border-t">
                  <Label htmlFor="upi_id" className="text-xs">Your UPI ID</Label>
                  <Input
                    id="upi_id"
                    placeholder="yourname@upi"
                    value={formData.upi_id}
                    onChange={(e) =>
                      setFormData({ ...formData, upi_id: e.target.value })
                    }
                  />
                </div>
              )}
            </div>
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
