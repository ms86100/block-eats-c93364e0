import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Check, X, Loader2, Store, Package, FileText, Eye, Clock, Shield,
  ChevronDown, ChevronUp, MapPin, Phone, Calendar, CreditCard, Truck, User,
} from 'lucide-react';
import { format } from 'date-fns';
import { useSellerApplicationReview } from '@/hooks/useSellerApplicationReview';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

function statusBadge(status: string) {
  switch (status) {
    case 'pending': return <Badge variant="outline" className="text-warning border-warning rounded-md text-[10px]"><Clock size={10} className="mr-1" /> Pending</Badge>;
    case 'approved': return <Badge variant="outline" className="text-success border-success rounded-md text-[10px]"><Check size={10} className="mr-1" /> Approved</Badge>;
    case 'rejected': return <Badge variant="outline" className="text-destructive border-destructive rounded-md text-[10px]"><X size={10} className="mr-1" /> Rejected</Badge>;
    default: return <Badge variant="outline" className="rounded-md text-[10px]">{status}</Badge>;
  }
}

export function SellerApplicationReview() {
  const s = useSellerApplicationReview();

  if (s.isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" size={20} /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Filter Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <Store size={15} className="text-emerald-600" />
          </div>
          <h3 className="text-sm font-bold text-foreground">
            {s.statusFilter === 'pending' ? `Pending Applications` : `All Sellers`}
            <span className="text-muted-foreground font-normal text-xs ml-1.5">
              ({s.statusFilter === 'pending' ? s.pendingCount : s.applications.length})
            </span>
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground font-medium">Show all</span>
          <Switch checked={s.statusFilter === 'all'} onCheckedChange={(c) => s.setStatusFilter(c ? 'all' : 'pending')} />
        </div>
      </div>

      {/* License Requirements Config */}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="w-full text-xs gap-2 rounded-xl h-9 font-semibold">
            <Shield size={14} /> License Requirements Config <ChevronDown size={14} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2.5">
          <Card className="border-0 shadow-[var(--shadow-card)] rounded-2xl"><CardContent className="p-4 space-y-2.5">
            <p className="text-[10px] text-muted-foreground font-medium">Configure which categories require sellers to upload a license.</p>
            {s.groups.map((group) => (
              <div key={group.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-sm">{group.icon}</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-xs">{group.name}</p>
                    {group.requires_license && group.license_type_name && (
                      <p className="text-[10px] text-muted-foreground truncate">{group.license_type_name}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {group.requires_license && (
                    <>
                      <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 rounded-lg"
                        onClick={() => { s.setEditingGroup(group); s.setEditForm({ license_type_name: group.license_type_name || '', license_description: group.license_description || '' }); }}>
                        Edit
                      </Button>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground">Mandatory</span>
                        <Switch checked={group.license_mandatory} onCheckedChange={(c) => s.toggleMandatory(group, c)} />
                      </div>
                    </>
                  )}
                  <Switch checked={group.requires_license} onCheckedChange={(c) => s.toggleRequiresLicense(group, c)} />
                </div>
              </div>
            ))}
          </CardContent></Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Seller Applications */}
      {s.applications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted/80 flex items-center justify-center mb-3">
            <Store size={22} className="text-muted-foreground/60" />
          </div>
          <p className="text-sm text-muted-foreground font-medium">No {s.statusFilter === 'pending' ? 'pending applications' : 'sellers found'}</p>
        </div>
      ) : (
        s.applications.map((seller, idx) => {
          const isExpanded = s.expandedId === seller.id;
          const pendingLicenses = seller.licenses.filter(l => l.status === 'pending').length;
          const totalProducts = seller.products.length;
          const approvedProducts = seller.products.filter(p => p.approval_status === 'approved').length;
          const isPending = seller.verification_status === 'pending';

          return (
            <motion.div key={seller.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
              <Card className={cn('border-0 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-md)] transition-all duration-300 rounded-2xl', isPending && 'ring-1 ring-warning/30')}>
                <CardContent className="p-0">
                  <div className="p-4 cursor-pointer" onClick={() => s.setExpandedId(isExpanded ? null : seller.id)}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {seller.profile_image_url ? (
                          <img src={seller.profile_image_url} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0" />
                        ) : (
                          <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center shrink-0"><Store size={17} className="text-muted-foreground/60" /></div>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-sm">{seller.business_name}</p>
                          <p className="text-xs text-muted-foreground">{seller.profile?.name}{seller.profile?.flat_number && ` • Flat ${seller.profile.flat_number}`}{seller.profile?.block && `, Block ${seller.profile.block}`}</p>
                          {seller.society?.name && <p className="text-[10px] text-primary font-semibold">{seller.society.name}</p>}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {statusBadge(seller.verification_status)}
                            {seller.primary_group && <Badge variant="secondary" className="text-[10px] rounded-md">{seller.primary_group.replace(/_/g, ' ')}</Badge>}
                            {pendingLicenses > 0 && <Badge variant="outline" className="text-[10px] text-warning border-warning rounded-md"><FileText size={8} className="mr-1" />{pendingLicenses} license pending</Badge>}
                            <Badge variant="outline" className="text-[10px] rounded-md"><Package size={8} className="mr-1" />{approvedProducts}/{totalProducts} products</Badge>
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 mt-1">{isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}</div>
                    </div>
                  </div>

                  {isExpanded && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="px-4 pb-4 space-y-4 border-t border-border/30 pt-4">
                      {/* Store Details */}
                      <div className="space-y-2.5">
                        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Store Details</h4>
                        {seller.description && <p className="text-xs text-muted-foreground">{seller.description}</p>}
                        {seller.cover_image_url && <img src={seller.cover_image_url} alt="Cover" className="w-full h-28 rounded-xl object-cover" />}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                          {seller.profile?.phone && <div className="flex items-center gap-1.5"><Phone size={10} className="text-muted-foreground" /> {seller.profile.phone}</div>}
                          {seller.society?.address && <div className="flex items-center gap-1.5 col-span-2"><MapPin size={10} className="text-muted-foreground" /> {seller.society.address}</div>}
                          {(seller.availability_start || seller.availability_end) && <div className="flex items-center gap-1.5"><Calendar size={10} className="text-muted-foreground" /> {seller.availability_start || '—'} – {seller.availability_end || '—'}</div>}
                          {seller.operating_days?.length > 0 && <div className="text-[10px] text-muted-foreground">{seller.operating_days.join(', ')}</div>}
                          <div className="flex items-center gap-1.5"><CreditCard size={10} className="text-muted-foreground" /> COD: {seller.accepts_cod ? '✓' : '✗'} | UPI: {seller.accepts_upi ? '✓' : '✗'}</div>
                          {seller.upi_id && <div className="text-[10px] text-muted-foreground">UPI: {seller.upi_id}</div>}
                          {seller.fulfillment_mode && <div className="flex items-center gap-1.5"><Truck size={10} className="text-muted-foreground" /> {seller.fulfillment_mode.replace(/_/g, ' ')}</div>}
                          {seller.categories?.length > 0 && <div className="col-span-2 text-[10px] text-muted-foreground">Sub-categories: {seller.categories.map(c => c.replace(/_/g, ' ')).join(', ')}</div>}
                          <div className="text-[10px] text-muted-foreground">Cross-society: {seller.sell_beyond_community ? `Yes (${seller.delivery_radius_km || 5}km)` : 'No'}</div>
                          <div className="text-[10px] text-muted-foreground">Applied: {format(new Date(seller.created_at), 'dd MMM yyyy')}</div>
                        </div>
                      </div>

                      {/* Licenses */}
                      {seller.licenses.length > 0 && (
                        <div className="space-y-2.5">
                          <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"><FileText size={12} /> Licenses ({seller.licenses.length})</h4>
                          {seller.licenses.map((lic) => (
                            <div key={lic.id} className="bg-muted/40 rounded-xl p-3.5 space-y-2.5">
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="flex items-center gap-1.5"><span className="text-xs">{(lic as any).group?.icon}</span><span className="text-xs font-semibold">{lic.license_type}</span></div>
                                  {lic.license_number && <p className="text-[10px] text-muted-foreground">#{lic.license_number}</p>}
                                  <p className="text-[10px] text-muted-foreground">Submitted {format(new Date(lic.submitted_at), 'dd MMM yyyy')}</p>
                                  <div className="mt-1">{statusBadge(lic.status)}</div>
                                </div>
                                <div className="flex gap-1">
                                  {lic.document_url && <Button size="sm" variant="outline" className="h-7 w-7 p-0 rounded-lg" onClick={(e) => { e.stopPropagation(); s.setPreviewUrl(lic.document_url); }}><Eye size={12} /></Button>}
                                </div>
                              </div>
                              {lic.status === 'pending' && (
                                <div className="space-y-2.5 pt-2.5 border-t border-border/30">
                                  <Textarea placeholder="Admin notes (optional)" value={s.licenseAdminNotes} onChange={(e) => s.setLicenseAdminNotes(e.target.value)} rows={2} className="text-xs rounded-xl" onClick={(e) => e.stopPropagation()} />
                                  <div className="flex gap-2">
                                    <Button size="sm" variant="outline" className="text-destructive flex-1 h-8 text-xs rounded-xl font-semibold" onClick={(e) => { e.stopPropagation(); s.updateLicenseStatus(lic.id, 'rejected'); }}><X size={12} className="mr-1" /> Reject</Button>
                                    <Button size="sm" className="flex-1 h-8 text-xs rounded-xl font-semibold" onClick={(e) => { e.stopPropagation(); s.updateLicenseStatus(lic.id, 'approved'); }}><Check size={12} className="mr-1" /> Approve</Button>
                                  </div>
                                </div>
                              )}
                              {lic.admin_notes && lic.status !== 'pending' && <p className="text-[10px] text-muted-foreground pt-1.5 border-t border-border/30">Note: {lic.admin_notes}</p>}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Products */}
                      {seller.products.length > 0 && (
                        <div className="space-y-2.5">
                          <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                            <Package size={12} /> Products ({seller.products.length})
                            {seller.products.filter(p => p.approval_status === 'pending').length > 0 && (
                              <Badge variant="outline" className="text-[8px] text-warning border-warning rounded-md ml-1">
                                {seller.products.filter(p => p.approval_status === 'pending').length} pending
                              </Badge>
                            )}
                          </h4>
                          <ScrollArea className="max-h-[320px]">
                            <div className="grid grid-cols-1 gap-2 pr-2">
                              {seller.products.map((prod) => (
                                <div key={prod.id} className="bg-muted/40 rounded-xl p-2.5 space-y-2">
                                  <div className="flex items-center gap-2.5">
                                    {prod.image_url ? <img src={prod.image_url} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" /> : <div className="w-9 h-9 rounded-lg bg-background flex items-center justify-center shrink-0"><Package size={13} className="text-muted-foreground/50" /></div>}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-semibold truncate">{prod.name}</p>
                                      <div className="flex items-center gap-1.5">
                                        {prod.price > 0 && <span className="text-[10px] text-primary font-bold">{s.formatPrice(prod.price)}</span>}
                                        <Badge variant="outline" className="text-[8px] px-1.5 py-0 rounded-md">{prod.category.replace(/_/g, ' ')}</Badge>
                                      </div>
                                    </div>
                                    {statusBadge(prod.approval_status)}
                                  </div>
                                  {prod.approval_status === 'pending' && (
                                    <>
                                      {s.productRejectingId === prod.id ? (
                                        <div className="space-y-2 pt-1.5 border-t border-border/30">
                                          <Textarea placeholder="Rejection reason (optional)..." value={s.productRejectionNote} onChange={(e) => s.setProductRejectionNote(e.target.value)} rows={2} className="text-xs rounded-xl" onClick={(e) => e.stopPropagation()} />
                                          <div className="flex gap-2">
                                            <Button size="sm" variant="outline" className="flex-1 h-7 text-[10px] rounded-xl" onClick={(e) => { e.stopPropagation(); s.setProductRejectingId(null); s.setProductRejectionNote(''); }}>Cancel</Button>
                                            <Button size="sm" variant="destructive" className="flex-1 h-7 text-[10px] rounded-xl font-semibold" disabled={s.productActionId === prod.id} onClick={(e) => { e.stopPropagation(); s.updateProductStatus(prod.id, 'rejected'); }}>
                                              {s.productActionId === prod.id && <Loader2 size={10} className="animate-spin mr-1" />}Confirm Reject
                                            </Button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex gap-2 pt-1.5 border-t border-border/30">
                                          <Button size="sm" variant="outline" className="text-destructive flex-1 h-7 text-[10px] rounded-xl font-semibold" onClick={(e) => { e.stopPropagation(); s.setProductRejectingId(prod.id); }} disabled={!!s.productActionId}>
                                            <X size={10} className="mr-1" /> Reject
                                          </Button>
                                          <Button size="sm" className="flex-1 h-7 text-[10px] rounded-xl font-semibold shadow-sm" onClick={(e) => { e.stopPropagation(); s.updateProductStatus(prod.id, 'approved'); }} disabled={!!s.productActionId}>
                                            {s.productActionId === prod.id && <Loader2 size={10} className="animate-spin mr-1" />}
                                            <Check size={10} className="mr-1" /> Approve
                                          </Button>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      )}

                      {/* Action Buttons */}
                      {isPending && (
                        <div className="pt-3 border-t border-border/30 space-y-2.5">
                          {s.rejectingId === seller.id ? (
                            <div className="space-y-2.5">
                              <Textarea placeholder="Rejection reason (will be shared with seller)..." value={s.rejectionNote} onChange={(e) => s.setRejectionNote(e.target.value)} rows={2} className="rounded-xl" />
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" className="flex-1 rounded-xl" onClick={() => { s.setRejectingId(null); s.setRejectionNote(''); }}>Cancel</Button>
                                <Button size="sm" variant="destructive" className="flex-1 rounded-xl font-semibold" disabled={s.actionId === seller.id} onClick={() => s.updateSellerStatus(seller, 'rejected')}>
                                  {s.actionId === seller.id && <Loader2 size={14} className="animate-spin mr-1" />}Confirm Reject
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="text-destructive flex-1 rounded-xl font-semibold" onClick={() => s.setRejectingId(seller.id)} disabled={!!s.actionId}><X size={14} className="mr-1" /> Reject Seller</Button>
                              <Button size="sm" className="flex-1 rounded-xl font-semibold shadow-sm" onClick={() => s.updateSellerStatus(seller, 'approved')} disabled={!!s.actionId}>
                                {s.actionId === seller.id && <Loader2 size={14} className="animate-spin mr-1" />}<Check size={14} className="mr-1" /> Approve Seller
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })
      )}

      {/* Document Preview Dialog */}
      <Dialog open={!!s.previewUrl} onOpenChange={() => s.setPreviewUrl(null)}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader><DialogTitle className="font-bold">License Document</DialogTitle></DialogHeader>
          {s.previewUrl && (
            s.previewUrl.match(/\.(jpg|jpeg|png|webp)$/i)
              ? <img src={s.previewUrl} alt="License" className="w-full rounded-xl" />
              : <div className="text-center py-8"><FileText size={48} className="mx-auto text-muted-foreground mb-4" /><a href={s.previewUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline font-semibold">Open Document</a></div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Group License Config Dialog */}
      <Dialog open={!!s.editingGroup} onOpenChange={() => s.setEditingGroup(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle className="font-bold">Configure License for {s.editingGroup?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">License Type Name</label>
              <Input placeholder="e.g., FSSAI Certificate" value={s.editForm.license_type_name} onChange={(e) => s.setEditForm({ ...s.editForm, license_type_name: e.target.value })} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Description for Sellers</label>
              <Textarea placeholder="Instructions for sellers..." value={s.editForm.license_description} onChange={(e) => s.setEditForm({ ...s.editForm, license_description: e.target.value })} rows={3} className="rounded-xl" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl h-10" onClick={() => s.setEditingGroup(null)}>Cancel</Button>
              <Button className="flex-1 rounded-xl h-10 font-semibold" onClick={s.saveGroupConfig}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
