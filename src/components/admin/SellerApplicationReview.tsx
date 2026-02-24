import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Check, X, Loader2, Store, Package, FileText, Eye, Clock, Shield,
  ChevronDown, ChevronUp, MapPin, Phone, Calendar, CreditCard, Truck, User,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCurrency } from '@/hooks/useCurrency';
import { format } from 'date-fns';
import { logAudit } from '@/lib/audit';

interface SellerApplication {
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

interface LicenseSubmission {
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

interface ProductSummary {
  id: string;
  name: string;
  price: number;
  category: string;
  image_url: string | null;
  approval_status: string;
  is_available: boolean;
}

interface GroupConfig {
  id: string;
  name: string;
  slug: string;
  icon: string;
  requires_license: boolean;
  license_type_name: string | null;
  license_description: string | null;
  license_mandatory: boolean;
}

export function SellerApplicationReview() {
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

  // License config editing
  const [editingGroup, setEditingGroup] = useState<GroupConfig | null>(null);
  const [editForm, setEditForm] = useState({ license_type_name: '', license_description: '' });

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch seller profiles
      let sellerQuery = supabase
        .from('seller_profiles')
        .select('*, profile:profiles!seller_profiles_user_id_fkey(name, phone, block, flat_number, phase), society:societies!seller_profiles_society_id_fkey(name, address)')
        .order('created_at', { ascending: false });

      if (statusFilter === 'pending') {
        sellerQuery = sellerQuery.eq('verification_status', 'pending');
      }

      const [sellersRes, groupsRes] = await Promise.all([
        sellerQuery,
        supabase.from('parent_groups').select('id, name, slug, icon, requires_license, license_type_name, license_description, license_mandatory').order('sort_order'),
      ]);

      const sellers = (sellersRes.data as any[]) || [];
      const sellerIds = sellers.map(s => s.id);

      // Fetch licenses and products for all displayed sellers in parallel
      const [licensesRes, productsRes] = await Promise.all([
        sellerIds.length > 0
          ? supabase.from('seller_licenses')
              .select('*, group:parent_groups!seller_licenses_group_id_fkey(name, icon)')
              .in('seller_id', sellerIds)
              .order('submitted_at', { ascending: false })
          : Promise.resolve({ data: [] }),
        sellerIds.length > 0
          ? supabase.from('products')
              .select('id, name, price, category, image_url, approval_status, is_available')
              .in('seller_id', sellerIds)
              .order('created_at', { ascending: false })
          : Promise.resolve({ data: [] }),
      ]);

      const licenses = (licensesRes.data as any[]) || [];
      const products = (productsRes.data as any[]) || [];

      // Group licenses and products by seller_id
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

      setApplications(enriched);
      setGroups((groupsRes.data as any) || []);
    } catch (error) {
      console.error('Error fetching seller applications:', error);
    } finally {
      setIsLoading(false);
    }
  };

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

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="text-warning border-warning"><Clock size={10} className="mr-1" /> Pending</Badge>;
      case 'approved': return <Badge variant="outline" className="text-success border-success"><Check size={10} className="mr-1" /> Approved</Badge>;
      case 'rejected': return <Badge variant="outline" className="text-destructive border-destructive"><X size={10} className="mr-1" /> Rejected</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingCount = applications.filter(a => a.verification_status === 'pending').length;

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Filter Toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          <Store size={14} />
          {statusFilter === 'pending' ? `Pending Applications (${pendingCount})` : `All Sellers (${applications.length})`}
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">Show all</span>
          <Switch checked={statusFilter === 'all'} onCheckedChange={(c) => setStatusFilter(c ? 'all' : 'pending')} />
        </div>
      </div>

      {/* License Requirements Config (collapsible) */}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="w-full text-xs gap-2">
            <Shield size={14} /> License Requirements Config <ChevronDown size={14} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <Card>
            <CardContent className="p-3 space-y-2">
              <p className="text-[10px] text-muted-foreground">Configure which categories require sellers to upload a license.</p>
              {groups.map((group) => (
                <div key={group.id} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm">{group.icon}</span>
                    <div className="min-w-0">
                      <p className="font-medium text-xs">{group.name}</p>
                      {group.requires_license && group.license_type_name && (
                        <p className="text-[10px] text-muted-foreground truncate">{group.license_type_name}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {group.requires_license && (
                      <>
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2"
                          onClick={() => { setEditingGroup(group); setEditForm({ license_type_name: group.license_type_name || '', license_description: group.license_description || '' }); }}>
                          Edit
                        </Button>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">Mandatory</span>
                          <Switch checked={group.license_mandatory} onCheckedChange={(c) => toggleMandatory(group, c)} />
                        </div>
                      </>
                    )}
                    <Switch checked={group.requires_license} onCheckedChange={(c) => toggleRequiresLicense(group, c)} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Seller Applications */}
      {applications.length === 0 ? (
        <p className="text-center text-muted-foreground py-8 text-sm">No {statusFilter === 'pending' ? 'pending applications' : 'sellers found'}</p>
      ) : (
        applications.map((seller) => {
          const isExpanded = expandedId === seller.id;
          const pendingLicenses = seller.licenses.filter(l => l.status === 'pending').length;
          const totalProducts = seller.products.length;
          const approvedProducts = seller.products.filter(p => p.approval_status === 'approved').length;
          const isPending = seller.verification_status === 'pending';

          return (
            <Card key={seller.id} className={isPending ? 'border-warning/40' : ''}>
              <CardContent className="p-0">
                {/* Header - always visible */}
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : seller.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {seller.profile_image_url ? (
                        <img src={seller.profile_image_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <Store size={16} className="text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-sm">{seller.business_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {seller.profile?.name}
                          {seller.profile?.flat_number && ` • Flat ${seller.profile.flat_number}`}
                          {seller.profile?.block && `, Block ${seller.profile.block}`}
                        </p>
                        {seller.society?.name && (
                          <p className="text-[10px] text-primary">{seller.society.name}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {statusBadge(seller.verification_status)}
                          {seller.primary_group && (
                            <Badge variant="secondary" className="text-[10px]">{seller.primary_group.replace(/_/g, ' ')}</Badge>
                          )}
                          {pendingLicenses > 0 && (
                            <Badge variant="outline" className="text-[10px] text-warning border-warning">
                              <FileText size={8} className="mr-1" />{pendingLicenses} license pending
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[10px]">
                            <Package size={8} className="mr-1" />{approvedProducts}/{totalProducts} products
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-4 border-t pt-4">
                    {/* Store Details Section */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Store Details</h4>
                      {seller.description && (
                        <p className="text-xs text-muted-foreground">{seller.description}</p>
                      )}
                      {seller.cover_image_url && (
                        <img src={seller.cover_image_url} alt="Cover" className="w-full h-24 rounded-lg object-cover" />
                      )}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        {seller.profile?.phone && (
                          <div className="flex items-center gap-1"><Phone size={10} className="text-muted-foreground" /> {seller.profile.phone}</div>
                        )}
                        {seller.society?.address && (
                          <div className="flex items-center gap-1 col-span-2"><MapPin size={10} className="text-muted-foreground" /> {seller.society.address}</div>
                        )}
                        {(seller.availability_start || seller.availability_end) && (
                          <div className="flex items-center gap-1"><Calendar size={10} className="text-muted-foreground" /> {seller.availability_start || '—'} – {seller.availability_end || '—'}</div>
                        )}
                        {seller.operating_days?.length > 0 && (
                          <div className="text-[10px] text-muted-foreground">{seller.operating_days.join(', ')}</div>
                        )}
                        <div className="flex items-center gap-1"><CreditCard size={10} className="text-muted-foreground" /> COD: {seller.accepts_cod ? '✓' : '✗'} | UPI: {seller.accepts_upi ? '✓' : '✗'}</div>
                        {seller.upi_id && <div className="text-[10px] text-muted-foreground">UPI: {seller.upi_id}</div>}
                        {seller.fulfillment_mode && (
                          <div className="flex items-center gap-1"><Truck size={10} className="text-muted-foreground" /> {seller.fulfillment_mode.replace(/_/g, ' ')}</div>
                        )}
                        {seller.categories?.length > 0 && (
                          <div className="col-span-2 text-[10px] text-muted-foreground">
                            Sub-categories: {seller.categories.map(c => c.replace(/_/g, ' ')).join(', ')}
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground">
                          Cross-society: {seller.sell_beyond_community ? `Yes (${seller.delivery_radius_km || 5}km)` : 'No'}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          Applied: {format(new Date(seller.created_at), 'dd MMM yyyy')}
                        </div>
                      </div>
                    </div>

                    {/* Licenses Section */}
                    {seller.licenses.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <FileText size={12} /> Licenses ({seller.licenses.length})
                        </h4>
                        {seller.licenses.map((lic) => (
                          <div key={lic.id} className="bg-muted rounded-lg p-3 space-y-2">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-1">
                                  <span className="text-xs">{(lic as any).group?.icon}</span>
                                  <span className="text-xs font-medium">{lic.license_type}</span>
                                </div>
                                {lic.license_number && <p className="text-[10px] text-muted-foreground">#{lic.license_number}</p>}
                                <p className="text-[10px] text-muted-foreground">
                                  Submitted {format(new Date(lic.submitted_at), 'dd MMM yyyy')}
                                </p>
                                <div className="mt-1">{statusBadge(lic.status)}</div>
                              </div>
                              <div className="flex gap-1">
                                {lic.document_url && (
                                  <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); setPreviewUrl(lic.document_url); }}>
                                    <Eye size={12} />
                                  </Button>
                                )}
                              </div>
                            </div>
                            {lic.status === 'pending' && (
                              <div className="space-y-2 pt-2 border-t border-border/50">
                                <Textarea
                                  placeholder="Admin notes (optional)"
                                  value={licenseAdminNotes}
                                  onChange={(e) => setLicenseAdminNotes(e.target.value)}
                                  rows={2}
                                  className="text-xs"
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <div className="flex gap-2">
                                  <Button size="sm" variant="outline" className="text-destructive flex-1 h-7 text-xs"
                                    onClick={(e) => { e.stopPropagation(); updateLicenseStatus(lic.id, 'rejected'); }}>
                                    <X size={12} className="mr-1" /> Reject
                                  </Button>
                                  <Button size="sm" className="flex-1 h-7 text-xs"
                                    onClick={(e) => { e.stopPropagation(); updateLicenseStatus(lic.id, 'approved'); }}>
                                    <Check size={12} className="mr-1" /> Approve
                                  </Button>
                                </div>
                              </div>
                            )}
                            {lic.admin_notes && lic.status !== 'pending' && (
                              <p className="text-[10px] text-muted-foreground pt-1 border-t border-border/50">Note: {lic.admin_notes}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Products Section */}
                    {seller.products.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <Package size={12} /> Products ({seller.products.length})
                        </h4>
                        <div className="grid grid-cols-1 gap-2">
                          {seller.products.slice(0, 6).map((prod) => (
                            <div key={prod.id} className="flex items-center gap-2 bg-muted rounded-lg p-2">
                              {prod.image_url ? (
                                <img src={prod.image_url} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded bg-background flex items-center justify-center shrink-0">
                                  <Package size={12} className="text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{prod.name}</p>
                                <div className="flex items-center gap-1">
                                  {prod.price > 0 && <span className="text-[10px] text-primary font-semibold">{formatPrice(prod.price)}</span>}
                                  <Badge variant="outline" className="text-[8px] px-1 py-0">{prod.category.replace(/_/g, ' ')}</Badge>
                                </div>
                              </div>
                              {statusBadge(prod.approval_status)}
                            </div>
                          ))}
                          {seller.products.length > 6 && (
                            <p className="text-[10px] text-muted-foreground text-center">+{seller.products.length - 6} more products</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    {isPending && (
                      <div className="pt-2 border-t space-y-2">
                        {rejectingId === seller.id ? (
                          <div className="space-y-2">
                            <Textarea
                              placeholder="Rejection reason (will be shared with seller)..."
                              value={rejectionNote}
                              onChange={(e) => setRejectionNote(e.target.value)}
                              rows={2}
                            />
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="flex-1" onClick={() => { setRejectingId(null); setRejectionNote(''); }}>Cancel</Button>
                              <Button size="sm" variant="destructive" className="flex-1" disabled={actionId === seller.id}
                                onClick={() => updateSellerStatus(seller, 'rejected')}>
                                {actionId === seller.id && <Loader2 size={14} className="animate-spin mr-1" />}
                                Confirm Reject
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="text-destructive flex-1" onClick={() => setRejectingId(seller.id)} disabled={!!actionId}>
                              <X size={14} className="mr-1" /> Reject Seller
                            </Button>
                            <Button size="sm" className="flex-1" onClick={() => updateSellerStatus(seller, 'approved')} disabled={!!actionId}>
                              {actionId === seller.id && <Loader2 size={14} className="animate-spin mr-1" />}
                              <Check size={14} className="mr-1" /> Approve Seller
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Document Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>License Document</DialogTitle></DialogHeader>
          {previewUrl && (
            previewUrl.match(/\.(jpg|jpeg|png|webp)$/i)
              ? <img src={previewUrl} alt="License" className="w-full rounded-lg" />
              : <div className="text-center py-8">
                  <FileText size={48} className="mx-auto text-muted-foreground mb-4" />
                  <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">Open Document</a>
                </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Group License Config Dialog */}
      <Dialog open={!!editingGroup} onOpenChange={() => setEditingGroup(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Configure License for {editingGroup?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">License Type Name</label>
              <Input placeholder="e.g., FSSAI Certificate" value={editForm.license_type_name}
                onChange={(e) => setEditForm({ ...editForm, license_type_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description for Sellers</label>
              <Textarea placeholder="Instructions for sellers..." value={editForm.license_description}
                onChange={(e) => setEditForm({ ...editForm, license_description: e.target.value })} rows={3} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditingGroup(null)}>Cancel</Button>
              <Button className="flex-1" onClick={saveGroupConfig}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
