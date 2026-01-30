import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { VegBadge } from '@/components/ui/veg-badge';
import { Badge } from '@/components/ui/badge';
import { ImageUpload } from '@/components/ui/image-upload';
import { useAuth } from '@/contexts/AuthContext';
import { Product, CATEGORIES, ProductCategory, SellerProfile } from '@/types/database';
import { useCategoryConfigs } from '@/hooks/useCategoryBehavior';
import { ParentGroup } from '@/types/categories';
import { ArrowLeft, Plus, Edit, Trash2, Loader2, Star, Award, Bell, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function SellerProductsPage() {
  const { user } = useAuth();
  const { groupedConfigs } = useCategoryConfigs();
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null);
  const [primaryGroup, setPrimaryGroup] = useState<ParentGroup | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: '' as ProductCategory | '',
    is_veg: true,
    is_available: true,
    is_bestseller: false,
    is_recommended: false,
    is_urgent: false,
    image_url: null as string | null,
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from('seller_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!profile) {
        setIsLoading(false);
        return;
      }

      setSellerProfile(profile as SellerProfile);
      // Get the seller's primary group for category filtering
      setPrimaryGroup((profile as any).primary_group as ParentGroup | null);

      const { data: productData } = await supabase
        .from('products')
        .select('*')
        .eq('seller_id', profile.id)
        .order('is_bestseller', { ascending: false })
        .order('created_at', { ascending: false });

      setProducts((productData || []) as Product[]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      category: '',
      is_veg: true,
      is_available: true,
      is_bestseller: false,
      is_recommended: false,
      is_urgent: false,
      image_url: null,
    });
    setEditingProduct(null);
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      category: product.category,
      is_veg: product.is_veg,
      is_available: product.is_available,
      is_bestseller: product.is_bestseller,
      is_recommended: product.is_recommended,
      is_urgent: product.is_urgent || false,
      image_url: product.image_url,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!sellerProfile || !user) return;

    if (!formData.name.trim() || !formData.price || !formData.category) {
      toast.error('Please fill in all required fields');
      return;
    }

    const price = parseFloat(formData.price);
    if (isNaN(price) || price <= 0) {
      toast.error('Please enter a valid price');
      return;
    }

    setIsSaving(true);
    try {
      const productData = {
        seller_id: sellerProfile.id,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        price,
        category: formData.category,
        is_veg: formData.is_veg,
        is_available: formData.is_available,
        is_bestseller: formData.is_bestseller,
        is_recommended: formData.is_recommended,
        is_urgent: formData.is_urgent,
        image_url: formData.image_url,
      };

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(productData as any)
          .eq('id', editingProduct.id);

        if (error) throw error;
        toast.success('Product updated');
      } else {
        const { error } = await supabase.from('products').insert(productData as any);

        if (error) throw error;
        toast.success('Product added');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Error saving product:', error);
      toast.error(error.message || 'Failed to save product');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (product: Product) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', product.id);

      if (error) throw error;
      toast.success('Product deleted');
      fetchData();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
    }
  };

  const toggleAvailability = async (product: Product) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_available: !product.is_available })
        .eq('id', product.id);

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Error updating availability:', error);
      toast.error('Failed to update');
    }
  };

  if (isLoading) {
    return (
      <AppLayout showHeader={false}>
        <div className="p-4">
          <Skeleton className="h-8 w-32 mb-4" />
          <Skeleton className="h-12 w-full mb-4" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl mb-3" />
          ))}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout showHeader={false}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-6">
          <Link to="/seller" className="flex items-center gap-2 text-muted-foreground">
            <ArrowLeft size={20} />
            <span>Back</span>
          </Link>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus size={16} className="mr-1" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingProduct ? 'Edit Product' : 'Add New Product'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                {/* Product Image Upload */}
                <div className="space-y-2">
                  <Label>Product Image</Label>
                  {user && (
                    <ImageUpload
                      value={formData.image_url}
                      onChange={(url) => setFormData({ ...formData, image_url: url })}
                      folder="products"
                      userId={user.id}
                      aspectRatio="video"
                      placeholder="Upload product photo"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Product Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Chicken Biryani"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe your product..."
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="price">Price (₹) *</Label>
                    <Input
                      id="price"
                      type="number"
                      placeholder="0"
                      value={formData.price}
                      onChange={(e) =>
                        setFormData({ ...formData, price: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) =>
                        setFormData({ ...formData, category: value as ProductCategory })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Show only categories from seller's primary group */}
                        {(primaryGroup ? groupedConfigs[primaryGroup] || [] : CATEGORIES.map(c => ({ category: c.value, displayName: c.label, icon: c.icon }))).map((config) => (
                          <SelectItem key={config.category} value={config.category}>
                            {config.icon} {config.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <VegBadge isVeg={formData.is_veg} />
                    <span className="text-sm font-medium">
                      {formData.is_veg ? 'Vegetarian' : 'Non-Vegetarian'}
                    </span>
                  </div>
                  <Switch
                    checked={formData.is_veg}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_veg: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <Star size={16} className="text-warning" />
                    <span className="text-sm font-medium">Mark as Bestseller</span>
                  </div>
                  <Switch
                    checked={formData.is_bestseller}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_bestseller: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <Award size={16} className="text-success" />
                    <span className="text-sm font-medium">Recommended</span>
                  </div>
                  <Switch
                    checked={formData.is_recommended}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_recommended: checked })
                    }
                  />
                </div>

                {/* Urgent Order Toggle */}
                <div className="flex items-center justify-between p-3 bg-warning/10 border border-warning/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Bell size={16} className="text-warning" />
                    <div>
                      <span className="text-sm font-medium block">Urgent Order Alert</span>
                      <span className="text-xs text-muted-foreground">
                        3-min timer, auto-cancel if not responded
                      </span>
                    </div>
                  </div>
                  <Switch
                    checked={formData.is_urgent}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_urgent: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">Available for order</span>
                  <Switch
                    checked={formData.is_available}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_available: checked })
                    }
                  />
                </div>

                <Button
                  className="w-full"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="animate-spin mr-2" size={18} />
                  ) : null}
                  {editingProduct ? 'Save Changes' : 'Add Product'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <h1 className="text-xl font-bold mb-4">Your Products ({products.length})</h1>

        {products.length > 0 ? (
          <div className="space-y-3">
            {products.map((product) => (
              <div
                key={product.id}
                className={`bg-card rounded-xl p-4 shadow-sm transition-opacity ${
                  !product.is_available ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 relative">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <span className="text-xl">🍽️</span>
                      </div>
                    )}
                    {!product.is_available && (
                      <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                        <span className="text-[10px] font-medium text-destructive">Out of Stock</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      <VegBadge isVeg={product.is_veg} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium truncate">{product.name}</h3>
                          {product.is_bestseller && (
                            <Badge className="bg-warning/20 text-warning-foreground text-[10px] px-1">
                              <Star size={10} className="mr-0.5 fill-warning text-warning" />
                              Bestseller
                            </Badge>
                          )}
                          {product.is_recommended && (
                            <Badge className="bg-success/20 text-success text-[10px] px-1">
                              Recommended
                            </Badge>
                          )}
                          {product.is_urgent && (
                            <Badge className="bg-destructive/20 text-destructive text-[10px] px-1">
                              <Bell size={10} className="mr-0.5" />
                              Urgent
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-primary">
                          ₹{product.price}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(product)}
                      >
                        <Edit size={14} className="mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => handleDelete(product)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <Switch
                      checked={product.is_available}
                      onCheckedChange={() => toggleAvailability(product)}
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {product.is_available ? 'In Stock' : 'Out'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-muted rounded-xl">
            <p className="text-muted-foreground mb-4">No products yet</p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus size={16} className="mr-1" />
              Add Your First Product
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
