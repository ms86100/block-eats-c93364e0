import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logAudit } from '@/lib/audit';
import { useCurrency } from '@/hooks/useCurrency';

export interface SellerApplication {
  id: string;
  user_id: string;
  business_name: string;
  description: string | null;
  primary_group: string | null;
  categories: string[];
  cover_image_url: string | null;
  profile_image_url: string | null;
  is_available: boolean;
  availability_start: string | null;
  availability_end: string | null;
  operating_days: string[];
  accepts_cod: boolean;
  accepts_upi: boolean;
  upi_id: string | null;
  verification_status: string;
  society_id: string | null;
  fulfillment_mode: string | null;
  sell_beyond_community: boolean;
  delivery_radius_km: number | null;
  created_at: string;
  updated_at: string;
  profile?: { name: string; phone: string | null; block: string | null; flat_number: string | null; phase: string | null };
  society?: { name: string; address: string | null };
  licenses: LicenseSubmission[];
  products: ProductSummary[];
}

export interface LicenseSubmission {
  id: string;
  license_type: string;
  license_number: string | null;
  document_url: string;
  status: string;
  admin_notes: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  group?: { name: string; icon: string };
}

export interface ProductSummary {
  id: string;
  name: string;
  price: number;
  category: string;
  image_url: string | null;
  approval_status: string;
  is_available: boolean;
}

export interface GroupConfig {
  id: string;
  name: string;
  slug: string;
  icon: string;
  requires_license: boolean;
  license_type_name: string | null;
  license_description: string | null;
  license_mandatory: boolean;
}

export function useSellerApplicationReview() {
  const { formatPrice } = useCurrency();
  const [applications, setApplications] = useState<SellerApplication[]>([]);
  const [groups, setGroups] = useState<GroupConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [rejectionNote, setRejectionNote] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [licenseAdminNotes, setLicenseAdminNotes] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'all'>('pending');
  const [editingGroup, setEditingGroup] = useState<GroupConfig | null>(null);
  const [editForm, setEditForm] = useState({ license_type_name: '', license_description: '' });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      let sellerQuery = supabase
        .from('seller_profiles')
        .select('*, profile:profiles!seller_profiles_user_id_fkey(name, phone, block, flat_number, phase), society:societies!seller_profiles_society_id_fkey(name, address)')
        .order('created_at', { ascending: false });

      const [sellersRes, groupsRes] = await Promise.all([
        sellerQuery,
        supabase.from('parent_groups').select('id, name, slug, icon, requires_license, license_type_name, license_description, license_mandatory').order('sort_order'),
      ]);

      const sellers = (sellersRes.data as any[]) || [];
      const sellerIds = sellers.map(s => s.id);

      const [licensesRes, productsRes] = await Promise.all([
        sellerIds.length > 0
          ? supabase.from('seller_licenses').select('*, group:parent_groups!seller_licenses_group_id_fkey(name, icon)').in('seller_id', sellerIds).order('submitted_at', { ascending: false })
          : Promise.resolve({ data: [] }),
        sellerIds.length > 0
          ? supabase.from('products').select('id, name, price, category, image_url, approval_status, is_available').in('seller_id', sellerIds).order('created_at', { ascending: false })
          : Promise.resolve({ data: [] }),
      ]);

      const licenses = (licensesRes.data as any[]) || [];
      const products = (productsRes.data as any[]) || [];

      const licensesBySeller: Record<string, LicenseSubmission[]> = {};
      licenses.forEach(l => {
        if (!licensesBySeller[l.seller_id]) licensesBySeller[l.seller_id] = [];
        licensesBySeller[l.seller_id].push(l);
      });

      const productsBySeller: Record<string, ProductSummary[]> = {};
      products.forEach(p => {
        if (!productsBySeller[p.seller_id]) productsBySeller[p.seller_id] = [];
        productsBySeller[p.seller_id].push(p);
      });

      const enriched: SellerApplication[] = sellers.map(s => ({
        ...s,
        licenses: licensesBySeller[s.id] || [],
        products: productsBySeller[s.id] || [],
      }));

      const filtered = statusFilter === 'pending'
        ? enriched.filter((s) =>
            s.verification_status === 'pending' ||
            s.licenses.some((l) => l.status === 'pending') ||
            s.products.some((p) => p.approval_status === 'pending')
          )
        : enriched;

      setApplications(filtered);
      setGroups((groupsRes.data as any) || []);
    } catch (error) {
      console.error('Error fetching seller applications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateSellerStatus = async (seller: SellerApplication, status: 'approved' | 'rejected') => {
    setActionId(seller.id);
    try {
      await supabase.from('seller_profiles').update({ verification_status: status }).eq('id', seller.id);
      await logAudit(`seller_${status}`, 'seller_profile', seller.id, '', { status, note: rejectionNote || undefined });

      if (status === 'approved') {
        await supabase.from('user_roles').insert({ user_id: seller.user_id, role: 'seller' });
        await supabase.from('products').update({ approval_status: 'approved' } as any).eq('seller_id', seller.id).in('approval_status', ['pending', 'draft']);
        await supabase.from('user_notifications').insert({
          user_id: seller.user_id,
          title: '🎉 Congratulations! Your store is approved!',
          body: 'Your store has been approved and is now live. Start selling to your neighbors!',
          type: 'seller_approved',
          is_read: false,
        });
      } else if (status === 'rejected') {
        await supabase.from('user_roles').delete().eq('user_id', seller.user_id).eq('role', 'seller');
      }

      toast.success(`Seller ${status}`);
      setRejectingId(null);
      setRejectionNote('');
      fetchData();
    } catch (error) {
      toast.error('Failed to update seller status');
    } finally {
      setActionId(null);
    }
  };

  const updateLicenseStatus = async (licenseId: string, status: 'approved' | 'rejected') => {
    try {
      await supabase.from('seller_licenses').update({
        status,
        reviewed_at: new Date().toISOString(),
        admin_notes: licenseAdminNotes.trim() || null,
      } as any).eq('id', licenseId);
      toast.success(`License ${status}`);
      setLicenseAdminNotes('');
      fetchData();
    } catch (error) {
      toast.error('Failed to update license');
    }
  };

  const toggleRequiresLicense = async (group: GroupConfig, checked: boolean) => {
    await supabase.from('parent_groups').update({ requires_license: checked } as any).eq('id', group.id);
    toast.success(checked ? `License enabled for ${group.name}` : `License disabled for ${group.name}`);
    fetchData();
  };

  const toggleMandatory = async (group: GroupConfig, checked: boolean) => {
    await supabase.from('parent_groups').update({ license_mandatory: checked } as any).eq('id', group.id);
    toast.success(checked ? 'License now mandatory' : 'License now optional');
    fetchData();
  };

  const saveGroupConfig = async () => {
    if (!editingGroup) return;
    await supabase.from('parent_groups').update({
      license_type_name: editForm.license_type_name.trim() || null,
      license_description: editForm.license_description.trim() || null,
    } as any).eq('id', editingGroup.id);
    toast.success('License config updated');
    setEditingGroup(null);
    fetchData();
  };

  const pendingCount = applications.filter(a => a.verification_status === 'pending').length;
  const pendingProductCount = applications.reduce((sum, a) => sum + a.products.filter(p => p.approval_status === 'pending').length, 0);

  const [productActionId, setProductActionId] = useState<string | null>(null);
  const [productRejectingId, setProductRejectingId] = useState<string | null>(null);
  const [productRejectionNote, setProductRejectionNote] = useState('');

  const updateProductStatus = async (productId: string, status: 'approved' | 'rejected') => {
    setProductActionId(productId);
    try {
      const { error } = await supabase.from('products').update({ approval_status: status } as any).eq('id', productId);
      if (error) { toast.error(`Failed to ${status} product`); return; }
      await logAudit(`product_${status}`, 'product', productId, '', { reason: productRejectionNote || undefined });
      toast.success(`Product ${status}`);
      setProductRejectingId(null);
      setProductRejectionNote('');
      fetchData();
    } catch {
      toast.error('Failed to update product');
    } finally {
      setProductActionId(null);
    }
  };

  return {
    applications, groups, isLoading, expandedId, setExpandedId,
    actionId, rejectionNote, setRejectionNote, rejectingId, setRejectingId,
    licenseAdminNotes, setLicenseAdminNotes, previewUrl, setPreviewUrl,
    statusFilter, setStatusFilter, editingGroup, setEditingGroup,
    editForm, setEditForm, pendingCount, pendingProductCount, formatPrice,
    updateSellerStatus, updateLicenseStatus, toggleRequiresLicense,
    toggleMandatory, saveGroupConfig,
    productActionId, productRejectingId, setProductRejectingId,
    productRejectionNote, setProductRejectionNote, updateProductStatus,
  };
}
