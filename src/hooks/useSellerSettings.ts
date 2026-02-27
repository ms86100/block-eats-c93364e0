import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SellerProfile, ProductCategory, DAYS_OF_WEEK } from '@/types/database';
import { useCategoryConfigs } from '@/hooks/useCategoryBehavior';
import { useParentGroups } from '@/hooks/useParentGroups';
import { ParentGroup } from '@/types/categories';
import { useCurrency } from '@/hooks/useCurrency';
import { toast } from 'sonner';
import { friendlyError } from '@/lib/utils';
import { logAudit } from '@/lib/audit';

export interface SellerSettingsFormData {
  business_name: string;
  description: string;
  categories: ProductCategory[];
  availability_start: string;
  availability_end: string;
  operating_days: string[];
  accepts_cod: boolean;
  accepts_upi: boolean;
  upi_id: string;
  is_available: boolean;
  cover_image_url: string | null;
  profile_image_url: string | null;
  bank_account_number: string;
  bank_ifsc_code: string;
  bank_account_holder: string;
  sell_beyond_community: boolean;
  delivery_radius_km: number;
  fulfillment_mode: string;
  delivery_note: string;
  minimum_order_amount: string;
}

const DEFAULT_FORM: SellerSettingsFormData = {
  business_name: '',
  description: '',
  categories: [],
  availability_start: '09:00',
  availability_end: '21:00',
  operating_days: DAYS_OF_WEEK as string[],
  accepts_cod: true,
  accepts_upi: false,
  upi_id: '',
  is_available: true,
  cover_image_url: null,
  profile_image_url: null,
  bank_account_number: '',
  bank_ifsc_code: '',
  bank_account_holder: '',
  sell_beyond_community: false,
  delivery_radius_km: 5,
  fulfillment_mode: 'self_pickup' as string,
  delivery_note: '',
  minimum_order_amount: '',
};

export function useSellerSettings() {
  const { user, currentSellerId, sellerProfiles } = useAuth();
  const { currencySymbol } = useCurrency();
  const { groupedConfigs } = useCategoryConfigs();
  const { getGroupBySlug } = useParentGroups();
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null);
  const [primaryGroup, setPrimaryGroup] = useState<ParentGroup | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<SellerSettingsFormData>(DEFAULT_FORM);

  useEffect(() => {
    if (currentSellerId) fetchProfileById(currentSellerId);
    else if (sellerProfiles.length > 0) fetchProfileById(sellerProfiles[0].id);
    else setIsLoading(false);
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
        setPrimaryGroup(profile.primary_group as ParentGroup | null);
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
          minimum_order_amount: profile.minimum_order_amount?.toString() || '',
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCategoryChange = (category: ProductCategory, checked: boolean) => {
    const allowedCategories = primaryGroup ? groupedConfigs[primaryGroup]?.map(c => c.category) || [] : [];
    if (!allowedCategories.includes(category as any) && checked) {
      toast.error(`This category is not available in your ${primaryGroup} group`);
      return;
    }
    setFormData(prev => ({
      ...prev,
      categories: checked ? [...prev.categories, category] : prev.categories.filter(c => c !== category),
    }));
  };

  const handleDayChange = (day: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      operating_days: checked ? [...prev.operating_days, day] : prev.operating_days.filter(d => d !== day),
    }));
  };

  const togglePauseShop = async () => {
    if (!sellerProfile) return;
    const newAvailability = !formData.is_available;
    setFormData(prev => ({ ...prev, is_available: newAvailability }));
    try {
      const { error } = await supabase.from('seller_profiles').update({ is_available: newAvailability }).eq('id', sellerProfile.id);
      if (error) throw error;
      toast.success(newAvailability ? 'Store is now open!' : 'Store paused temporarily');
      if ((sellerProfile as any).society_id) {
        logAudit(newAvailability ? 'store_resumed' : 'store_paused', 'seller_profile', sellerProfile.id, (sellerProfile as any).society_id);
      }
    } catch {
      setFormData(prev => ({ ...prev, is_available: !newAvailability }));
      toast.error('Failed to update store status');
    }
  };

  const handleSave = async () => {
    if (!sellerProfile) return;
    if (!formData.business_name.trim()) { toast.error('Please enter a business name'); return; }
    if (formData.categories.length === 0) { toast.error('Please select at least one category'); return; }
    if (formData.accepts_upi && !formData.upi_id.trim()) { toast.error('Please enter your UPI ID'); return; }

    setIsSaving(true);
    try {
      const minOrder = formData.minimum_order_amount ? parseFloat(formData.minimum_order_amount) : null;
      const { error } = await supabase.from('seller_profiles').update({
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
        minimum_order_amount: (minOrder !== null && !isNaN(minOrder) && minOrder > 0) ? minOrder : null,
      } as any).eq('id', sellerProfile.id);

      if (error) throw error;
      toast.success('Settings saved successfully');
      if ((sellerProfile as any).society_id) {
        logAudit('seller_settings_updated', 'seller_profile', sellerProfile.id, (sellerProfile as any).society_id, { business_name: formData.business_name, categories: formData.categories });
      }
    } catch (error: any) {
      console.error('Error saving:', error);
      toast.error(friendlyError(error));
    } finally {
      setIsSaving(false);
    }
  };

  return {
    user, sellerProfile, primaryGroup, isLoading, isSaving,
    formData, setFormData, currencySymbol,
    groupedConfigs, getGroupBySlug,
    handleCategoryChange, handleDayChange, togglePauseShop, handleSave,
  };
}
