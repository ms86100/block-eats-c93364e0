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
import { SellerProfile, ProductCategory, DAYS_OF_WEEK } from '@/types/database';
import { useCategoryConfigs } from '@/hooks/useCategoryBehavior';
import { useParentGroups } from '@/hooks/useParentGroups';
import { ParentGroup, ServiceCategory } from '@/types/categories';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArrowLeft, Loader2, PauseCircle, PlayCircle, Clock, Smartphone, Banknote, AlertTriangle, Building2, Globe, Truck, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { logAudit } from '@/lib/audit';
import { LicenseUpload } from '@/components/seller/LicenseUpload';

function LicenseUploadSection({ sellerId, primaryGroup }: { sellerId: string; primaryGroup: string }) {
  const [groupId, setGroupId] = useState<string | null>(null);
  const [requiresLicense, setRequiresLicense] = useState(false);

  useEffect(() => {
    const fetchGroup = async () => {
      const { data } = await supabase
        .from('parent_groups')
        .select('id, requires_license')
        .eq('slug', primaryGroup)
        .single();
      if (data) {
        setGroupId(data.id);
        setRequiresLicense((data as any).requires_license || false);
      }
    };
    fetchGroup();
  }, [primaryGroup]);

  if (!groupId || !requiresLicense) return null;
  return <LicenseUpload sellerId={sellerId} groupId={groupId} />;
}

export default function SellerSettingsPage() {
  const { user, currentSellerId, sellerProfiles } = useAuth();
  const { groupedConfigs } = useCategoryConfigs();
  const { getGroupBySlug } = useParentGroups();
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
    // Bank account details for Razorpay payouts
    bank_account_number: '',
    bank_ifsc_code: '',
    bank_account_holder: '',
    // Cross-society commerce
    sell_beyond_community: false,
    delivery_radius_km: 5,
    // Fulfillment mode
    fulfillment_mode: 'self_pickup' as string,
    delivery_note: '',
  });

  useEffect(() => {
    if (currentSellerId) {
      fetchProfile();
    } else if (sellerProfiles.length > 0) {
      // Fallback: use first seller profile if currentSellerId not set
      fetchProfileById(sellerProfiles[0].id);
    } else {
      setIsLoading(false);
    }
  }, [currentSellerId, sellerProfiles]);

  const fetchProfileById = async (sellerId: string) => {
    try {
      const { data } = await supabase
        .from('seller_profiles')
        .select('*')
        .eq('id', sellerId)
        .maybeSingle();

      if (data) {
        const profile = data as any;
        setSellerProfile(profile);
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
          bank_account_number: profile.bank_account_number || '',
          bank_ifsc_code: profile.bank_ifsc_code || '',
          bank_account_holder: profile.bank_account_holder || '',
          sell_beyond_community: profile.sell_beyond_community ?? false,
          delivery_radius_km: profile.delivery_radius_km ?? 5,
          fulfillment_mode: profile.fulfillment_mode || 'self_pickup',
          delivery_note: profile.delivery_note || '',
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProfile = async () => {
    if (!currentSellerId) return;
    await fetchProfileById(currentSellerId);
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

      // Audit log
      if ((sellerProfile as any).society_id) {
        logAudit(
          newAvailability ? 'store_resumed' : 'store_paused',
          'seller_profile',
          sellerProfile.id,
          (sellerProfile as any).society_id
        );
      }
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
          bank_account_number: formData.bank_account_number.trim() || null,
          bank_ifsc_code: formData.bank_ifsc_code.trim() || null,
          bank_account_holder: formData.bank_account_holder.trim() || null,
          sell_beyond_community: formData.sell_beyond_community,
          delivery_radius_km: formData.delivery_radius_km,
          fulfillment_mode: formData.fulfillment_mode,
          delivery_note: formData.delivery_note.trim() || null,
        } as any)
        .eq('id', sellerProfile.id);

      if (error) throw error;

      toast.success('Settings saved successfully');

      // Audit log for profile changes
      if ((sellerProfile as any).society_id) {
        logAudit(
          'seller_settings_updated',
          'seller_profile',
          sellerProfile.id,
          (sellerProfile as any).society_id,
          { business_name: formData.business_name, categories: formData.categories }
        );
      }
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
      <div className="p-4 pb-24 safe-top">
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
              placeholder="Tell customers about your business..."
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
                  getGroupBySlug(primaryGroup)?.color
                )}>
                  {getGroupBySlug(primaryGroup)?.icon}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Your seller category</p>
                  <p className="font-semibold">{getGroupBySlug(primaryGroup)?.label}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <AlertTriangle size={12} />
                To change category group, please contact admin
              </p>
            </div>
          )}

          <div className="space-y-3">
            <Label>Categories * {primaryGroup && <span className="text-muted-foreground font-normal">(within {getGroupBySlug(primaryGroup)?.label})</span>}</Label>
            <div className="grid grid-cols-2 gap-3">
              {(primaryGroup ? groupedConfigs[primaryGroup] || [] : []).map((config) => (
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

          {/* Fulfillment Mode */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Truck size={16} className="text-muted-foreground" />
              <Label>Fulfillment Mode</Label>
            </div>
            <div className="p-4 bg-muted rounded-lg space-y-3">
              <RadioGroup
                value={formData.fulfillment_mode}
                onValueChange={(value) => setFormData({ ...formData, fulfillment_mode: value })}
                className="space-y-2"
              >
                <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-background/50 cursor-pointer">
                  <RadioGroupItem value="self_pickup" />
                  <div>
                    <p className="text-sm font-medium">Self Pickup Only</p>
                    <p className="text-xs text-muted-foreground">Buyer picks up from your location</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-background/50 cursor-pointer">
                  <RadioGroupItem value="delivery" />
                  <div>
                    <p className="text-sm font-medium">I Deliver</p>
                    <p className="text-xs text-muted-foreground">You deliver to buyer's location</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-background/50 cursor-pointer">
                  <RadioGroupItem value="both" />
                  <div>
                    <p className="text-sm font-medium">Both</p>
                    <p className="text-xs text-muted-foreground">Buyer can choose pickup or delivery</p>
                  </div>
                </label>
              </RadioGroup>
              {(formData.fulfillment_mode === 'delivery' || formData.fulfillment_mode === 'both') && (
                <div className="space-y-2 pt-2 border-t">
                  <Label htmlFor="delivery_note" className="text-xs">Delivery Instructions</Label>
                  <Input
                    id="delivery_note"
                    placeholder="e.g. Pickup from Gate 2 or Will deliver within 1 hour"
                    value={formData.delivery_note}
                    onChange={(e) => setFormData({ ...formData, delivery_note: e.target.value })}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Preview My Store */}
          {sellerProfile && (
            <Link to={`/seller/${sellerProfile.id}`}>
              <Button variant="outline" className="w-full gap-2">
                <Eye size={16} />
                Preview My Store
              </Button>
            </Link>
          )}

          {/* Sell Beyond Community */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Globe size={16} className="text-muted-foreground" />
              <Label>Cross-Society Sales</Label>
            </div>
            <div className="p-4 bg-muted rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Sell beyond my community</p>
                  <p className="text-xs text-muted-foreground">
                    Allow buyers from nearby societies to order
                  </p>
                </div>
                <Switch
                  checked={formData.sell_beyond_community}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, sell_beyond_community: checked })
                  }
                />
              </div>
              {formData.sell_beyond_community && (
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Delivery Radius</span>
                    <span className="text-sm font-medium text-primary">
                      {formData.delivery_radius_km} km
                    </span>
                  </div>
                  <Slider
                    value={[formData.delivery_radius_km]}
                    onValueChange={([v]) =>
                      setFormData({ ...formData, delivery_radius_km: v })
                    }
                    min={1}
                    max={10}
                    step={1}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Buyers within {formData.delivery_radius_km} km can order from you
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Dynamic License Upload (for regulated categories) */}
          {sellerProfile && primaryGroup && (
            <LicenseUploadSection sellerId={sellerProfile.id} primaryGroup={primaryGroup} />
          )}

          {/* Bank Account Details for Payouts */}
          {(formData.accepts_upi || true) && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-muted-foreground" />
              <Label>Bank Account for Payouts</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Payments will be settled to this bank account
            </p>
              
              <div className="space-y-3 bg-muted rounded-lg p-4">
                <div className="space-y-2">
                  <Label htmlFor="bank_account_holder" className="text-xs">Account Holder Name</Label>
                  <Input
                    id="bank_account_holder"
                    placeholder="As per bank records"
                    value={formData.bank_account_holder}
                    onChange={(e) =>
                      setFormData({ ...formData, bank_account_holder: e.target.value })
                    }
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="bank_account_number" className="text-xs">Account Number</Label>
                  <Input
                    id="bank_account_number"
                    placeholder="Enter bank account number"
                    value={formData.bank_account_number}
                    onChange={(e) =>
                      setFormData({ ...formData, bank_account_number: e.target.value })
                    }
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="bank_ifsc_code" className="text-xs">IFSC Code</Label>
                  <Input
                    id="bank_ifsc_code"
                    placeholder="e.g., SBIN0001234"
                    value={formData.bank_ifsc_code}
                    onChange={(e) =>
                      setFormData({ ...formData, bank_ifsc_code: e.target.value.toUpperCase() })
                    }
                  />
                </div>
              </div>
            </div>
          )}
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
