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
import { CroppableImageUpload } from '@/components/ui/croppable-image-upload';
import { DAYS_OF_WEEK } from '@/types/database';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArrowLeft, Loader2, PauseCircle, PlayCircle, Clock, Smartphone, Banknote, AlertTriangle, Building2, Globe, Truck, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LicenseUpload } from '@/components/seller/LicenseUpload';
import { useSellerSettings } from '@/hooks/useSellerSettings';

function LicenseUploadSection({ sellerId, primaryGroup }: { sellerId: string; primaryGroup: string }) {
  const [groupId, setGroupId] = useState<string | null>(null);
  const [requiresLicense, setRequiresLicense] = useState(false);

  useEffect(() => {
    const fetchGroup = async () => {
      const { data } = await supabase.from('parent_groups').select('id, requires_license').eq('slug', primaryGroup).single();
      if (data) { setGroupId(data.id); setRequiresLicense((data as any).requires_license || false); }
    };
    fetchGroup();
  }, [primaryGroup]);

  if (!groupId || !requiresLicense) return null;
  return <LicenseUpload sellerId={sellerId} groupId={groupId} />;
}

export default function SellerSettingsPage() {
  const {
    user, sellerProfile, primaryGroup, isLoading, isSaving,
    formData, setFormData, currencySymbol,
    groupedConfigs, getGroupBySlug,
    handleCategoryChange, handleDayChange, togglePauseShop, handleSave,
  } = useSellerSettings();

  if (isLoading) {
    return (
      <AppLayout showHeader={false}>
        <div className="p-4"><Skeleton className="h-8 w-32 mb-4" /><Skeleton className="h-48 w-full rounded-xl" /></div>
      </AppLayout>
    );
  }

  if (!sellerProfile) {
    return (
      <AppLayout showHeader={false}>
        <div className="p-4 text-center py-12">
          <p className="text-muted-foreground">Seller profile not found</p>
          <Link to="/become-seller"><Button className="mt-4">Become a Seller</Button></Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout showHeader={false} showNav={false}>
      <div className="p-4 pb-24 safe-top">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/seller" className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-muted shrink-0"><ArrowLeft size={18} /></Link>
          <h1 className="text-xl font-bold">Store Settings</h1>
        </div>

        <div className="space-y-5">
          {/* Pause/Resume */}
          <Card className={formData.is_available ? 'border-success/30 bg-success/5' : 'border-warning/30 bg-warning/5'}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {formData.is_available ? <PlayCircle className="text-success" size={28} /> : <PauseCircle className="text-warning" size={28} />}
                  <div>
                    <p className="font-semibold">{formData.is_available ? 'Store is Open' : 'Store is Paused'}</p>
                    <p className="text-xs text-muted-foreground">{formData.is_available ? 'Customers can place orders' : 'Temporarily not accepting orders'}</p>
                  </div>
                </div>
                <Button variant={formData.is_available ? 'outline' : 'default'} size="sm" onClick={togglePauseShop}>{formData.is_available ? 'Pause Shop' : 'Resume Shop'}</Button>
              </div>
            </CardContent>
          </Card>

          {/* Store Images */}
          <div className="bg-card rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold mb-3">Store Images</h3>
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Cover Image</Label>
                {user && <div className="max-h-48 max-w-full"><CroppableImageUpload value={formData.cover_image_url} onChange={(url) => setFormData({ ...formData, cover_image_url: url })} folder="sellers" userId={user.id} aspectRatio="video" placeholder="Upload cover photo" className="max-h-48" cropAspect={16 / 9} /></div>}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Profile Photo</Label>
                {user && <div className="max-w-[160px]"><CroppableImageUpload value={formData.profile_image_url} onChange={(url) => setFormData({ ...formData, profile_image_url: url })} folder="sellers" userId={user.id} aspectRatio="square" placeholder="Upload profile photo" cropAspect={1} /></div>}
              </div>
            </div>
          </div>

          {/* Business Name & Description */}
          <div className="space-y-2">
            <Label htmlFor="business_name">Business Name *</Label>
            <Input id="business_name" value={formData.business_name} onChange={(e) => setFormData({ ...formData, business_name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" placeholder="Tell customers about your business..." value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} />
          </div>

          {/* Primary Group */}
          {primaryGroup && (
            <div className="bg-muted/50 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center text-2xl', getGroupBySlug(primaryGroup)?.color)}>{getGroupBySlug(primaryGroup)?.icon}</div>
                <div>
                  <p className="text-xs text-muted-foreground">Your seller category</p>
                  <p className="font-semibold">{getGroupBySlug(primaryGroup)?.label}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><AlertTriangle size={12} /> To change category group, please contact admin</p>
            </div>
          )}

          {/* Categories */}
          <div className="space-y-3">
            <Label>Categories * {primaryGroup && <span className="text-muted-foreground font-normal">(within {getGroupBySlug(primaryGroup)?.label})</span>}</Label>
            <div className="grid grid-cols-2 gap-3">
              {(primaryGroup ? groupedConfigs[primaryGroup] || [] : []).map((config) => (
                <label key={config.category} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${formData.categories.includes(config.category as any) ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'}`}>
                  <Checkbox checked={formData.categories.includes(config.category as any)} onCheckedChange={(checked) => handleCategoryChange(config.category as any, checked as boolean)} />
                  <span className="text-lg">{config.icon}</span>
                  <span className="text-sm font-medium">{config.displayName}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Operating Days */}
          <div className="space-y-3">
            <div className="flex items-center gap-2"><Clock size={16} className="text-muted-foreground" /><Label>Operating Days</Label></div>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((day) => (
                <label key={day} className={`flex items-center justify-center w-12 h-10 rounded-lg border cursor-pointer transition-colors ${formData.operating_days.includes(day) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
                  <Checkbox checked={formData.operating_days.includes(day)} onCheckedChange={(checked) => handleDayChange(day, checked as boolean)} className="hidden" />
                  <span className="text-xs font-medium">{day}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Store will auto-close on non-operating days</p>
          </div>

          {/* Hours */}
          <div className="space-y-2">
            <Label>Availability Hours</Label>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="start" className="text-xs text-muted-foreground">Opens at</Label><Input id="start" type="time" value={formData.availability_start} onChange={(e) => setFormData({ ...formData, availability_start: e.target.value })} /></div>
              <div><Label htmlFor="end" className="text-xs text-muted-foreground">Closes at</Label><Input id="end" type="time" value={formData.availability_end} onChange={(e) => setFormData({ ...formData, availability_end: e.target.value })} /></div>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="space-y-3">
            <Label>Payment Methods</Label>
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3"><Banknote className="text-success" size={20} /><div><p className="font-medium text-sm">Cash on Delivery</p><p className="text-xs text-muted-foreground">Accept cash payments</p></div></div>
              <Switch checked={formData.accepts_cod} onCheckedChange={(checked) => setFormData({ ...formData, accepts_cod: checked })} />
            </div>
            <div className="p-4 bg-muted rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3"><Smartphone className="text-info" size={20} /><div><p className="font-medium text-sm">UPI Payments</p><p className="text-xs text-muted-foreground">Accepts UPI payments</p></div></div>
                <Switch checked={formData.accepts_upi} onCheckedChange={(checked) => setFormData({ ...formData, accepts_upi: checked })} />
              </div>
              {formData.accepts_upi && (
                <div className="space-y-2 pt-2 border-t"><Label htmlFor="upi_id" className="text-xs">Your UPI ID</Label><Input id="upi_id" placeholder="yourname@upi" value={formData.upi_id} onChange={(e) => setFormData({ ...formData, upi_id: e.target.value })} /></div>
              )}
            </div>
          </div>

          {/* Min Order */}
          <div className="space-y-3">
            <div className="flex items-center gap-2"><Banknote size={16} className="text-muted-foreground" /><Label>Minimum Order Amount</Label></div>
            <div className="p-4 bg-muted rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div><p className="font-medium text-sm">Set minimum order value</p><p className="text-xs text-muted-foreground">Buyers must meet this amount to place an order</p></div>
                <Switch checked={formData.minimum_order_amount !== ''} onCheckedChange={(checked) => setFormData({ ...formData, minimum_order_amount: checked ? '100' : '' })} />
              </div>
              {formData.minimum_order_amount !== '' && (
                <div className="space-y-2 pt-2 border-t"><Label htmlFor="min_order" className="text-xs">Minimum Amount ({currencySymbol})</Label><Input id="min_order" type="number" min="0" placeholder="e.g. 100" value={formData.minimum_order_amount} onChange={(e) => setFormData({ ...formData, minimum_order_amount: e.target.value })} /></div>
              )}
            </div>
          </div>

          {/* Fulfillment */}
          <div className="space-y-3">
            <div className="flex items-center gap-2"><Truck size={16} className="text-muted-foreground" /><Label>Fulfillment Mode</Label></div>
            <div className="p-4 bg-muted rounded-lg space-y-3">
            <RadioGroup value={formData.fulfillment_mode} onValueChange={(value) => setFormData({ ...formData, fulfillment_mode: value })} className="space-y-2">
                <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-background/50 cursor-pointer"><RadioGroupItem value="self_pickup" /><div><p className="text-sm font-medium">Self Pickup Only</p><p className="text-xs text-muted-foreground">Buyer picks up from your location</p></div></label>
                <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-background/50 cursor-pointer"><RadioGroupItem value="seller_delivery" /><div><p className="text-sm font-medium">I Deliver</p><p className="text-xs text-muted-foreground">You deliver to buyer's location</p></div></label>
                <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-background/50 cursor-pointer"><RadioGroupItem value="platform_delivery" /><div><p className="text-sm font-medium">Delivery Partner</p><p className="text-xs text-muted-foreground">A platform delivery partner will deliver</p></div></label>
                <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-background/50 cursor-pointer"><RadioGroupItem value="pickup_and_seller_delivery" /><div><p className="text-sm font-medium">Pickup + I Deliver</p><p className="text-xs text-muted-foreground">Buyer can choose pickup or you deliver</p></div></label>
                <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-background/50 cursor-pointer"><RadioGroupItem value="pickup_and_platform_delivery" /><div><p className="text-sm font-medium">Pickup + Delivery Partner</p><p className="text-xs text-muted-foreground">Buyer can choose pickup or delivery partner delivers</p></div></label>
              </RadioGroup>
              {formData.fulfillment_mode !== 'self_pickup' && (
                <p className="text-xs text-primary/80 bg-primary/5 rounded-lg p-2">💡 Delivery fee is managed by the platform admin</p>
              )}
              {(formData.fulfillment_mode === 'platform_delivery' || formData.fulfillment_mode === 'pickup_and_platform_delivery') && (
                <p className="text-xs text-muted-foreground bg-muted rounded-lg p-2">🚴 A delivery partner will be auto-assigned when the order is ready</p>
              )}
              {(formData.fulfillment_mode === 'seller_delivery' || formData.fulfillment_mode === 'pickup_and_seller_delivery') && (
                <div className="space-y-2 pt-2 border-t"><Label htmlFor="delivery_note" className="text-xs">Delivery Instructions</Label><Input id="delivery_note" placeholder="e.g. Will deliver within 1 hour" value={formData.delivery_note} onChange={(e) => setFormData({ ...formData, delivery_note: e.target.value })} /></div>
              )}
            </div>
          </div>

          {/* Preview */}
          {sellerProfile && <Link to={`/seller/${sellerProfile.id}`}><Button variant="outline" className="w-full gap-2"><Eye size={16} /> Preview My Store</Button></Link>}

          {/* Cross-Society */}
          <div className="space-y-3">
            <div className="flex items-center gap-2"><Globe size={16} className="text-muted-foreground" /><Label>Cross-Society Sales</Label></div>
            <div className="p-4 bg-muted rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <div><p className="font-medium text-sm">Sell beyond my community</p><p className="text-xs text-muted-foreground">Allow buyers from nearby societies to order</p></div>
                <Switch checked={formData.sell_beyond_community} onCheckedChange={(checked) => setFormData({ ...formData, sell_beyond_community: checked })} />
              </div>
              {formData.sell_beyond_community && (
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Delivery Radius</span><span className="text-sm font-medium text-primary">{formData.delivery_radius_km} km</span></div>
                  <Slider value={[formData.delivery_radius_km]} onValueChange={([v]) => setFormData({ ...formData, delivery_radius_km: v })} min={1} max={10} step={1} />
                  <p className="text-[10px] text-muted-foreground">Buyers within {formData.delivery_radius_km} km can order from you</p>
                </div>
              )}
            </div>
          </div>

          {/* License */}
          {sellerProfile && primaryGroup && <LicenseUploadSection sellerId={sellerProfile.id} primaryGroup={primaryGroup} />}

          {/* Bank Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-2"><Building2 size={16} className="text-muted-foreground" /><Label>Bank Account for Payouts</Label></div>
            <p className="text-xs text-muted-foreground">Payments will be settled to this bank account</p>
            <div className="space-y-3 bg-muted rounded-lg p-4">
              <div className="space-y-2"><Label htmlFor="bank_account_holder" className="text-xs">Account Holder Name</Label><Input id="bank_account_holder" placeholder="As per bank records" value={formData.bank_account_holder} onChange={(e) => setFormData({ ...formData, bank_account_holder: e.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="bank_account_number" className="text-xs">Account Number</Label><Input id="bank_account_number" placeholder="Enter bank account number" value={formData.bank_account_number} onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="bank_ifsc_code" className="text-xs">IFSC Code</Label><Input id="bank_ifsc_code" placeholder="e.g., SBIN0001234" value={formData.bank_ifsc_code} onChange={(e) => setFormData({ ...formData, bank_ifsc_code: e.target.value.toUpperCase() })} /></div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-card border-t border-border pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <Button className="w-full h-12" onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="animate-spin mr-2" size={18} /> : null} Save Changes
        </Button>
      </div>
    </AppLayout>
  );
}
