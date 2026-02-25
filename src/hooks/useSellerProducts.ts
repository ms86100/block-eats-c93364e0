import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Product, ProductCategory, SellerProfile, ProductActionType } from '@/types/database';
import { useCategoryConfigs } from '@/hooks/useCategoryBehavior';
import { ParentGroup } from '@/types/categories';
import { useSubcategories } from '@/hooks/useSubcategories';
import { type BlockData } from '@/hooks/useAttributeBlocks';
import { toast } from 'sonner';
import { friendlyError } from '@/lib/utils';

export interface ProductFormData {
  name: string;
  description: string;
  price: string;
  mrp: string;
  prep_time_minutes: string;
  category: ProductCategory | '';
  is_veg: boolean;
  is_available: boolean;
  is_bestseller: boolean;
  is_recommended: boolean;
  is_urgent: boolean;
  image_url: string | null;
  action_type: ProductActionType;
  contact_phone: string;
  stock_quantity: string;
  low_stock_threshold: string;
  subcategory_id: string;
  lead_time_hours: string;
  accepts_preorders: boolean;
}

const INITIAL_FORM: ProductFormData = {
  name: '', description: '', price: '', mrp: '', prep_time_minutes: '',
  category: '', is_veg: true, is_available: true, is_bestseller: false,
  is_recommended: false, is_urgent: false, image_url: null,
  action_type: 'add_to_cart', contact_phone: '', stock_quantity: '',
  low_stock_threshold: '5', subcategory_id: '', lead_time_hours: '',
  accepts_preorders: false,
};

export function useSellerProducts() {
  const { user, sellerProfiles, currentSellerId } = useAuth();
  const { groupedConfigs, configs } = useCategoryConfigs();

  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null);
  const [primaryGroup, setPrimaryGroup] = useState<ParentGroup | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [licenseBlocked, setLicenseBlocked] = useState<{ blocked: boolean; status: string; licenseName: string } | null>(null);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [attributeBlocks, setAttributeBlocks] = useState<BlockData[]>([]);
  const [formData, setFormData] = useState<ProductFormData>(INITIAL_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const activeCategoryConfig = useMemo(() => {
    if (!formData.category) return null;
    return configs.find(c => c.category === formData.category) || null;
  }, [formData.category, configs]);

  const activeCategoryConfigId = activeCategoryConfig?.id || null;
  const { data: subcategories = [] } = useSubcategories(activeCategoryConfigId);

  // Find selected subcategory to cascade its overrides
  const activeSubcategory = useMemo(() => {
    if (!formData.subcategory_id) return null;
    return subcategories.find(s => s.id === formData.subcategory_id) || null;
  }, [formData.subcategory_id, subcategories]);

  // Subcategory overrides parent when non-null
  const showVegToggle = activeSubcategory?.show_veg_toggle ?? activeCategoryConfig?.formHints.showVegToggle ?? false;
  const showDurationField = activeSubcategory?.show_duration_field ?? activeCategoryConfig?.formHints.showDurationField ?? false;

  const allowedCategories = useMemo(() => {
    if (!primaryGroup || !groupedConfigs[primaryGroup]) return [];
    return groupedConfigs[primaryGroup];
  }, [primaryGroup, groupedConfigs]);




  useEffect(() => {
    if (user && currentSellerId) fetchData(currentSellerId);
    else if (user && sellerProfiles.length > 0) fetchData(sellerProfiles[0].id);
  }, [user, currentSellerId, sellerProfiles]);

  const fetchData = async (sellerId: string) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data: profile } = await supabase.from('seller_profiles').select('*').eq('id', sellerId).single();
      if (!profile) { setIsLoading(false); setSellerProfile(null); return; }
      setSellerProfile(profile as SellerProfile);
      setPrimaryGroup((profile as any).primary_group as ParentGroup | null);
      const { data: productData } = await supabase.from('products').select('*').eq('seller_id', profile.id).order('is_bestseller', { ascending: false }).order('created_at', { ascending: false });
      setProducts((productData || []) as Product[]);

      if ((profile as any).primary_group) {
        const { data: groupData } = await supabase.from('parent_groups').select('id, requires_license, license_mandatory, license_type_name').eq('slug', (profile as any).primary_group).eq('requires_license', true).eq('license_mandatory', true).maybeSingle();
        if (groupData) {
          const { data: licenseData } = await supabase.from('seller_licenses').select('status').eq('seller_id', profile.id).eq('group_id', groupData.id).maybeSingle();
          const status = licenseData?.status || 'none';
          setLicenseBlocked(status !== 'approved' ? { blocked: true, status, licenseName: groupData.license_type_name || 'License' } : null);
        } else { setLicenseBlocked(null); }
      }
    } catch (error) { console.error('Error fetching data:', error); }
    finally { setIsLoading(false); }
  };

  const resetForm = () => {
    const defaultCategory = allowedCategories.length === 1 ? allowedCategories[0].category as ProductCategory : '';
    setFormData({ ...INITIAL_FORM, category: defaultCategory });
    setEditingProduct(null);
    setAttributeBlocks([]);
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name, description: product.description || '', price: product.price.toString(),
      mrp: (product as any).mrp?.toString() || '', prep_time_minutes: (product as any).prep_time_minutes?.toString() || '',
      category: product.category, is_veg: product.is_veg, is_available: product.is_available,
      is_bestseller: product.is_bestseller, is_recommended: product.is_recommended, is_urgent: product.is_urgent || false,
      image_url: product.image_url, action_type: (product as any).action_type || 'add_to_cart',
      contact_phone: (product as any).contact_phone || '', stock_quantity: (product as any).stock_quantity?.toString() || '',
      low_stock_threshold: (product as any).low_stock_threshold?.toString() || '5',
      subcategory_id: (product as any).subcategory_id || '', lead_time_hours: (product as any).lead_time_hours?.toString() || '',
      accepts_preorders: (product as any).accepts_preorders || false,
    });
    const specs = (product as any).specifications;
    setAttributeBlocks(specs?.blocks && Array.isArray(specs.blocks) ? specs.blocks as BlockData[] : []);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!sellerProfile || !user) return;
    if (!formData.name.trim() || !formData.category) { toast.error('Please fill in all required fields'); return; }
    const price = parseFloat(formData.price);
    const actionNeedsPrice = !['contact_seller', 'request_quote', 'make_offer'].includes(formData.action_type);
    if (actionNeedsPrice && (isNaN(price) || price <= 0)) { toast.error('Please enter a valid price'); return; }
    if (formData.action_type === 'contact_seller' && !formData.contact_phone.trim()) { toast.error('Phone number is required for Contact Seller action'); return; }
    if (formData.contact_phone.trim() && !/^[\d+\-\s()]{7,15}$/.test(formData.contact_phone.trim())) { toast.error('Please enter a valid phone number'); return; }

    setIsSaving(true);
    try {
      const prepTime = formData.prep_time_minutes ? parseInt(formData.prep_time_minutes) : null;
      const mrp = formData.mrp ? parseFloat(formData.mrp) : null;
      const stockQty = formData.stock_quantity ? parseInt(formData.stock_quantity) : null;
      const lowStockThreshold = formData.low_stock_threshold ? parseInt(formData.low_stock_threshold) : 5;
      const productData = {
        seller_id: sellerProfile.id, name: formData.name.trim(), description: formData.description.trim() || null,
        price: isNaN(price) ? 0 : price, mrp: (mrp && !isNaN(mrp) && mrp > 0) ? mrp : null,
        prep_time_minutes: (prepTime && !isNaN(prepTime) && prepTime > 0) ? prepTime : null,
        category: formData.category, is_veg: formData.is_veg, is_available: formData.is_available,
        is_bestseller: formData.is_bestseller, is_recommended: formData.is_recommended, is_urgent: formData.is_urgent,
        image_url: formData.image_url, action_type: formData.action_type, contact_phone: formData.contact_phone.trim() || null,
        stock_quantity: (stockQty !== null && !isNaN(stockQty) && stockQty >= 0) ? stockQty : null,
        low_stock_threshold: lowStockThreshold, subcategory_id: formData.subcategory_id || null,
        lead_time_hours: formData.lead_time_hours ? parseInt(formData.lead_time_hours) : null,
        accepts_preorders: formData.accepts_preorders,
        specifications: attributeBlocks.length > 0 ? { blocks: attributeBlocks } : null,
        ...(editingProduct
          ? {
              // Only reset to pending if content-significant fields changed
              approval_status: (() => {
                const ep = editingProduct as any;
                const contentChanged =
                  formData.name.trim() !== ep.name ||
                  (formData.description.trim() || null) !== (ep.description || null) ||
                  parseFloat(formData.price) !== ep.price ||
                  formData.category !== ep.category ||
                  formData.image_url !== ep.image_url ||
                  formData.action_type !== (ep.action_type || 'add_to_cart') ||
                  formData.subcategory_id !== (ep.subcategory_id || '');
                return contentChanged ? 'pending' : ep.approval_status;
              })(),
            }
          : { approval_status: 'draft' }),
      };
      if (editingProduct) {
        const { error } = await supabase.from('products').update(productData as any).eq('id', editingProduct.id);
        if (error) throw error;
        toast.success('Product updated');
      } else {
        const { error } = await supabase.from('products').insert(productData as any);
        if (error) throw error;
        toast.success('Product added');
      }
      setIsDialogOpen(false);
      resetForm();
      if (sellerProfile) fetchData(sellerProfile.id);
    } catch (error: any) {
      console.error('Error saving product:', error);
      toast.error(friendlyError(error));
    } finally { setIsSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success('Product deleted');
      if (sellerProfile) fetchData(sellerProfile.id);
    } catch (error) { console.error('Error deleting product:', error); toast.error(friendlyError(error)); }
    finally { setDeleteTarget(null); }
  };

  const toggleAvailability = async (product: Product) => {
    try {
      const { error } = await supabase.from('products').update({ is_available: !product.is_available }).eq('id', product.id);
      if (error) throw error;
      if (sellerProfile) fetchData(sellerProfile.id);
    } catch (error) { console.error('Error updating availability:', error); toast.error('Failed to update'); }
  };

  return {
    user, sellerProfile, primaryGroup, products, isLoading, isDialogOpen, setIsDialogOpen,
    editingProduct, isSaving, licenseBlocked, isBulkOpen, setIsBulkOpen,
    attributeBlocks, setAttributeBlocks, formData, setFormData, deleteTarget, setDeleteTarget,
    activeCategoryConfig, showVegToggle, showDurationField, allowedCategories, subcategories,
    configs, sellerProfiles, resetForm, openEditDialog, handleSave, confirmDelete,
    toggleAvailability, fetchData,
  };
}
