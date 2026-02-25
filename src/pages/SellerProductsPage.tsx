import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { VegBadge } from '@/components/ui/veg-badge';
import { Badge } from '@/components/ui/badge';
import { ProductImageUpload } from '@/components/ui/product-image-upload';
import { ProductCategory } from '@/types/database';
import { SellerSwitcher } from '@/components/seller/SellerSwitcher';
import { ArrowLeft, Plus, Edit, Trash2, Loader2, Star, Award, Bell, AlertTriangle, Store, ShieldAlert, Upload, Send, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { BulkProductUpload } from '@/components/seller/BulkProductUpload';
import { useCurrency } from '@/hooks/useCurrency';
import { AttributeBlockBuilder } from '@/components/seller/AttributeBlockBuilder';
import { useSellerProducts } from '@/hooks/useSellerProducts';

export default function SellerProductsPage() {
  const sp = useSellerProducts();
  const { formatPrice, currencySymbol } = useCurrency();

  if (sp.isLoading) {
    return <AppLayout showHeader={false}><div className="p-4"><Skeleton className="h-8 w-32 mb-4" /><Skeleton className="h-12 w-full mb-4" />{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl mb-3" />)}</div></AppLayout>;
  }

  return (
    <AppLayout showHeader={false}>
      <div className="p-4 safe-top">
        <div className="flex items-center justify-between mb-6">
          <Link to="/seller" className="flex items-center gap-2 text-muted-foreground"><span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-muted shrink-0"><ArrowLeft size={18} /></span><span>Back</span></Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => sp.setIsBulkOpen(true)}><Upload size={16} className="mr-1" />Bulk Add</Button>
            <Dialog open={sp.isDialogOpen} onOpenChange={(open) => { sp.setIsDialogOpen(open); if (!open) sp.resetForm(); }}>
              <DialogTrigger asChild><Button><Plus size={16} className="mr-1" />Add Product</Button></DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{sp.editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
                  {sp.sellerProfile && <div className="flex items-center gap-2 mt-2 p-2 bg-primary/5 border border-primary/20 rounded-lg"><Store size={14} className="text-primary" /><span className="text-xs text-primary font-medium">Adding to: {sp.sellerProfile.business_name}</span></div>}
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2"><Label>Product Image</Label>{sp.user && <ProductImageUpload value={sp.formData.image_url} onChange={(url) => sp.setFormData({ ...sp.formData, image_url: url })} userId={sp.user.id} productName={sp.formData.name} categoryName={sp.activeCategoryConfig?.displayName || sp.formData.category || undefined} description={sp.formData.description || undefined} />}</div>
                  <div className="space-y-2"><Label htmlFor="name">Product Name *</Label><Input id="name" placeholder={sp.activeCategoryConfig?.formHints.namePlaceholder || "e.g., Product Name"} value={sp.formData.name} onChange={(e) => sp.setFormData({ ...sp.formData, name: e.target.value })} /></div>
                  <div className="space-y-2"><Label htmlFor="description">Description</Label><Textarea id="description" placeholder={sp.activeCategoryConfig?.formHints.descriptionPlaceholder || "Describe your product..."} value={sp.formData.description} onChange={(e) => sp.setFormData({ ...sp.formData, description: e.target.value })} rows={2} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label htmlFor="price">{sp.activeCategoryConfig?.formHints.priceLabel || 'Price'} ({currencySymbol}) *</Label><Input id="price" type="number" placeholder="0" value={sp.formData.price} onChange={(e) => sp.setFormData({ ...sp.formData, price: e.target.value })} /></div>
                    <div className="space-y-2"><Label htmlFor="mrp">MRP ({currencySymbol})</Label><Input id="mrp" type="number" placeholder="Original price" value={sp.formData.mrp} onChange={(e) => sp.setFormData({ ...sp.formData, mrp: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">{sp.formData.mrp && sp.formData.price && parseFloat(sp.formData.mrp) > parseFloat(sp.formData.price) && <p className="text-[10px] text-green-600 font-medium">{Math.round(((parseFloat(sp.formData.mrp) - parseFloat(sp.formData.price)) / parseFloat(sp.formData.mrp)) * 100)}% OFF</p>}</div>
                    {sp.showDurationField && <div className="space-y-2"><Label htmlFor="prep_time">{sp.activeCategoryConfig?.formHints.durationLabel || 'Duration (min)'}</Label><Input id="prep_time" type="number" placeholder="e.g. 30" value={sp.formData.prep_time_minutes} onChange={(e) => sp.setFormData({ ...sp.formData, prep_time_minutes: e.target.value })} /></div>}
                    {sp.allowedCategories.length > 1 ? <div className="space-y-2"><Label htmlFor="category">Category *</Label><Select value={sp.formData.category} onValueChange={(value) => sp.setFormData({ ...sp.formData, category: value as ProductCategory })}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{sp.allowedCategories.map((config) => <SelectItem key={config.category} value={config.category}>{config.icon} {config.displayName}</SelectItem>)}</SelectContent></Select></div> : sp.allowedCategories.length === 1 ? <div className="space-y-2"><Label>Category</Label><div className="flex items-center gap-2 p-2 bg-muted rounded-md text-sm"><span>{sp.allowedCategories[0].icon}</span><span>{sp.allowedCategories[0].displayName}</span></div></div> : null}
                  </div>
                  {sp.subcategories.length > 0 && <div className="space-y-2"><Label>Subcategory</Label><Select value={sp.formData.subcategory_id || 'none'} onValueChange={(v) => sp.setFormData({ ...sp.formData, subcategory_id: v === 'none' ? '' : v })}><SelectTrigger><SelectValue placeholder="Select subcategory (optional)" /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem>{sp.subcategories.map(sub => <SelectItem key={sub.id} value={sub.id}>{sub.icon || '📂'} {sub.display_name}</SelectItem>)}</SelectContent></Select></div>}
                  <div className="p-3 bg-muted rounded-lg space-y-3"><div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label className="text-xs">Hours in advance</Label><Input type="number" min="0" placeholder="e.g. 2" value={sp.formData.lead_time_hours} onChange={(e) => sp.setFormData({ ...sp.formData, lead_time_hours: e.target.value })} /></div></div><div className="flex items-center justify-between pt-2 border-t"><div><span className="text-sm font-medium block">Accept Pre-orders</span><span className="text-xs text-muted-foreground">Allow buyers to order for future dates</span></div><Switch checked={sp.formData.accepts_preorders} onCheckedChange={(checked) => sp.setFormData({ ...sp.formData, accepts_preorders: checked })} /></div></div>
                  {sp.showVegToggle && <div className="flex items-center justify-between p-3 bg-muted rounded-lg"><div className="flex items-center gap-2"><VegBadge isVeg={sp.formData.is_veg} /><span className="text-sm font-medium">{sp.formData.is_veg ? 'Vegetarian' : 'Non-Vegetarian'}</span></div><Switch checked={sp.formData.is_veg} onCheckedChange={(checked) => sp.setFormData({ ...sp.formData, is_veg: checked })} /></div>}
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg"><div className="flex items-center gap-2"><Star size={16} className="text-warning" /><span className="text-sm font-medium">Mark as Bestseller</span></div><Switch checked={sp.formData.is_bestseller} onCheckedChange={(checked) => sp.setFormData({ ...sp.formData, is_bestseller: checked })} /></div>
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg"><div className="flex items-center gap-2"><Award size={16} className="text-success" /><span className="text-sm font-medium">Recommended</span></div><Switch checked={sp.formData.is_recommended} onCheckedChange={(checked) => sp.setFormData({ ...sp.formData, is_recommended: checked })} /></div>
                  <div className="flex items-center justify-between p-3 bg-warning/10 border border-warning/30 rounded-lg"><div className="flex items-center gap-2"><Bell size={16} className="text-warning" /><div><span className="text-sm font-medium block">Urgent Order Alert</span><span className="text-xs text-muted-foreground">3-min timer, auto-cancel if not responded</span></div></div><Switch checked={sp.formData.is_urgent} onCheckedChange={(checked) => sp.setFormData({ ...sp.formData, is_urgent: checked })} /></div>
                  <div className="p-3 bg-muted rounded-lg space-y-3"><div className="flex items-center justify-between"><div><span className="text-sm font-medium block">Track Stock Quantity</span><span className="text-xs text-muted-foreground">Auto-marks unavailable when stock hits zero</span></div><Switch checked={sp.formData.stock_quantity !== ''} onCheckedChange={(checked) => sp.setFormData({ ...sp.formData, stock_quantity: checked ? '10' : '' })} /></div>{sp.formData.stock_quantity !== '' && <div className="grid grid-cols-2 gap-3 pt-2 border-t"><div className="space-y-1"><Label className="text-xs">Current Stock</Label><Input type="number" min="0" value={sp.formData.stock_quantity} onChange={(e) => sp.setFormData({ ...sp.formData, stock_quantity: e.target.value })} /></div><div className="space-y-1"><Label className="text-xs">Low Stock Alert</Label><Input type="number" min="1" value={sp.formData.low_stock_threshold} onChange={(e) => sp.setFormData({ ...sp.formData, low_stock_threshold: e.target.value })} /></div></div>}</div>
                  <AttributeBlockBuilder category={sp.formData.category || null} value={sp.attributeBlocks} onChange={sp.setAttributeBlocks} />
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg"><span className="text-sm font-medium">Available for order</span><Switch checked={sp.formData.is_available} onCheckedChange={(checked) => sp.setFormData({ ...sp.formData, is_available: checked })} /></div>
                  <Button className="w-full" onClick={sp.handleSave} disabled={sp.isSaving}>{sp.isSaving && <Loader2 className="animate-spin mr-2" size={18} />}{sp.editingProduct ? 'Save Changes' : 'Add Product'}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {sp.sellerProfile && <BulkProductUpload isOpen={sp.isBulkOpen} onClose={() => sp.setIsBulkOpen(false)} sellerId={sp.sellerProfile.id} allowedCategories={sp.allowedCategories} onSuccess={() => sp.sellerProfile && sp.fetchData(sp.sellerProfile.id)} />}

        {sp.sellerProfile && (
          <div className="mb-4 p-3 bg-card rounded-xl shadow-sm border"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"><Store size={18} className="text-primary" /></div><div><h2 className="font-semibold text-sm">{sp.sellerProfile.business_name}</h2><p className="text-xs text-muted-foreground capitalize">{sp.primaryGroup?.replace('_', ' ')} • {sp.products.length} products</p></div></div>{sp.sellerProfiles.length > 1 && <SellerSwitcher />}</div></div>
        )}

        {sp.licenseBlocked?.blocked && (
          <div className={`mb-4 p-3 rounded-xl border flex items-start gap-3 ${sp.licenseBlocked.status === 'rejected' ? 'bg-destructive/10 border-destructive/30' : 'bg-warning/10 border-warning/30'}`}>
            <ShieldAlert size={20} className={sp.licenseBlocked.status === 'rejected' ? 'text-destructive mt-0.5' : 'text-warning mt-0.5'} />
            <div><p className={`text-sm font-semibold ${sp.licenseBlocked.status === 'rejected' ? 'text-destructive' : 'text-warning'}`}>{sp.licenseBlocked.status === 'rejected' ? `${sp.licenseBlocked.licenseName} Rejected` : sp.licenseBlocked.status === 'pending' ? `${sp.licenseBlocked.licenseName} Pending Verification` : `${sp.licenseBlocked.licenseName} Required`}</p><p className="text-xs text-muted-foreground mt-0.5">{sp.licenseBlocked.status === 'rejected' ? 'Your license was rejected. Please re-upload from Seller Settings.' : sp.licenseBlocked.status === 'pending' ? 'Your license is being reviewed.' : 'You need to upload your license from Seller Settings.'}</p></div>
          </div>
        )}

        <h1 className="text-xl font-bold mb-4">Your Products ({sp.products.length})</h1>

        {sp.products.some(p => (p as any).approval_status === 'draft') && (
          <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-xl flex items-center justify-between">
            <div><p className="text-sm font-medium">{sp.products.filter(p => (p as any).approval_status === 'draft').length} draft product(s) ready</p><p className="text-xs text-muted-foreground">Submit for admin review to make them visible to buyers</p></div>
            <Button size="sm" onClick={async () => { const draftIds = sp.products.filter(p => (p as any).approval_status === 'draft').map(p => p.id); const { error } = await supabase.from('products').update({ approval_status: 'pending' } as any).in('id', draftIds); if (error) { toast.error('Failed to submit'); return; } toast.success(`${draftIds.length} product(s) submitted for approval`); if (sp.sellerProfile) sp.fetchData(sp.sellerProfile.id); }}><Send size={14} className="mr-1" />Submit All for Approval</Button>
          </div>
        )}

        {sp.products.length > 0 ? (
          <div className="space-y-3">
            {sp.products.map((product) => {
              const approvalStatus = (product as any).approval_status || 'approved';
              const isEditable = approvalStatus !== 'pending';
              return (
                <div key={product.id} className={`bg-card rounded-xl p-4 shadow-sm transition-opacity ${!product.is_available ? 'opacity-60' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 relative">
                      {product.image_url ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-muted flex items-center justify-center"><span className="text-xl">{sp.configs.find(c => c.category === product.category)?.icon || '📦'}</span></div>}
                      {!product.is_available && <div className="absolute inset-0 bg-background/70 flex items-center justify-center"><span className="text-[10px] font-medium text-destructive">Out of Stock</span></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 flex-wrap">
                        {(() => { const c = sp.configs.find(c => c.category === product.category); return (c?.formHints.showVegToggle ?? false) && <VegBadge isVeg={product.is_veg} size="sm" />; })()}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium truncate">{product.name}</h3>
                            {approvalStatus === 'draft' && <Badge variant="outline" className="text-[10px] px-1 gap-0.5 border-muted-foreground/30"><Clock size={10} /> Draft</Badge>}
                            {approvalStatus === 'pending' && <Badge className="bg-warning/20 text-warning-foreground text-[10px] px-1 gap-0.5"><Clock size={10} /> Pending</Badge>}
                            {approvalStatus === 'rejected' && <Badge variant="destructive" className="text-[10px] px-1 gap-0.5"><XCircle size={10} /> Rejected</Badge>}
                            {approvalStatus === 'approved' && <Badge className="bg-success/20 text-success text-[10px] px-1 gap-0.5"><CheckCircle2 size={10} /> Live</Badge>}
                            {product.is_bestseller && <Badge className="bg-warning/20 text-warning-foreground text-[10px] px-1"><Star size={10} className="mr-0.5 fill-warning text-warning" />Bestseller</Badge>}
                          </div>
                          <p className="text-sm font-semibold text-primary">{formatPrice(product.price)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        {isEditable ? (<><Button size="sm" variant="outline" onClick={() => sp.openEditDialog(product)}><Edit size={14} className="mr-1" />Edit</Button><Button size="sm" variant="ghost" className="text-destructive" onClick={() => sp.setDeleteTarget(product)}><Trash2 size={14} /></Button>{approvalStatus === 'draft' && <Button size="sm" variant="secondary" onClick={async () => { const { error } = await supabase.from('products').update({ approval_status: 'pending' } as any).eq('id', product.id); if (error) { toast.error('Failed to submit'); return; } toast.success('Submitted for approval'); if (sp.sellerProfile) sp.fetchData(sp.sellerProfile.id); }}><Send size={14} className="mr-1" />Submit</Button>}</>) : <span className="text-xs text-muted-foreground italic">Awaiting admin review</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-1"><Switch checked={product.is_available} onCheckedChange={() => sp.toggleAvailability(product)} /><span className="text-[10px] text-muted-foreground">{product.is_available ? 'In Stock' : 'Out'}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 bg-muted rounded-xl"><p className="text-muted-foreground mb-4">No products yet</p><Button onClick={() => sp.setIsDialogOpen(true)}><Plus size={16} className="mr-1" />Add Your First Product</Button></div>
        )}
      </div>

      <AlertDialog open={!!sp.deleteTarget} onOpenChange={(open) => !open && sp.setDeleteTarget(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete "{sp.deleteTarget?.name}"?</AlertDialogTitle><AlertDialogDescription>This product will be permanently removed.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep Product</AlertDialogCancel><AlertDialogAction onClick={sp.confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
