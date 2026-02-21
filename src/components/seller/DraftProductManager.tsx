import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { VegBadge } from '@/components/ui/veg-badge';
import { ProductImageUpload } from '@/components/ui/product-image-upload';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Trash2, Loader2, Package, Percent, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCategoryConfigs } from '@/hooks/useCategoryBehavior';
import { friendlyError } from '@/lib/utils';

interface DraftProduct {
  id?: string;
  name: string;
  price: number;
  mrp?: number | null;
  discount_percentage?: number | null;
  description: string;
  category: string;
  is_veg: boolean;
  image_url: string;
  prep_time_minutes?: number | null;
}

interface DraftProductManagerProps {
  sellerId: string;
  categories: string[];
  products: DraftProduct[];
  onProductsChange: (products: DraftProduct[]) => void;
}

export function DraftProductManager({
  sellerId,
  categories,
  products,
  onProductsChange,
}: DraftProductManagerProps) {
  const { user } = useAuth();
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { configs } = useCategoryConfigs();
  const [newProduct, setNewProduct] = useState<DraftProduct>({
    name: '',
    price: 0,
    mrp: null,
    discount_percentage: null,
    description: '',
    category: categories[0] || '',
    is_veg: true,
    image_url: '',
    prep_time_minutes: null,
  });

  // Get form hints for the selected category
  const activeConfig = useMemo(() => {
    return configs.find(c => c.category === newProduct.category) || null;
  }, [configs, newProduct.category]);

  const showVegToggle = activeConfig?.formHints.showVegToggle ?? false;
  const showDurationField = activeConfig?.formHints.showDurationField ?? false;

  const requiresPrice = useMemo(() => {
    if (!activeConfig) return true;
    return activeConfig.behavior.supportsCart || !activeConfig.behavior.enquiryOnly;
  }, [activeConfig]);

  // Auto-compute discount when MRP or price changes
  const computedDiscount = useMemo(() => {
    if (newProduct.mrp && newProduct.mrp > 0 && newProduct.price > 0 && newProduct.mrp > newProduct.price) {
      return Math.round(((newProduct.mrp - newProduct.price) / newProduct.mrp) * 100);
    }
    return null;
  }, [newProduct.mrp, newProduct.price]);

  const handleAddProduct = async () => {
    if (!newProduct.name.trim()) {
      toast.error('Product name is required');
      return;
    }
    if (requiresPrice && newProduct.price <= 0) {
      toast.error('Price must be greater than 0');
      return;
    }
    if (newProduct.mrp && newProduct.mrp > 0 && newProduct.price > newProduct.mrp) {
      toast.error('Price cannot be higher than MRP');
      return;
    }
    if (!newProduct.image_url.trim()) {
      toast.error('Product image is required. Please upload or generate an image.');
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .insert({
          seller_id: sellerId,
          name: newProduct.name.trim(),
          price: newProduct.price || 0,
          mrp: newProduct.mrp && newProduct.mrp > 0 ? newProduct.mrp : null,
          description: newProduct.description.trim() || null,
          category: newProduct.category,
          is_veg: newProduct.is_veg,
          image_url: newProduct.image_url.trim() || null,
          is_available: true,
          prep_time_minutes: newProduct.prep_time_minutes || null,
        } as any)
        .select()
        .single();

      if (error) throw error;

      onProductsChange([...products, { ...newProduct, id: data.id, discount_percentage: computedDiscount }]);
      setNewProduct({
        name: '',
        price: 0,
        mrp: null,
        discount_percentage: null,
        description: '',
        category: categories[0] || '',
        is_veg: true,
        image_url: '',
        prep_time_minutes: null,
      });
      setIsAdding(false);
      toast.success('Product added');
    } catch (error: any) {
      console.error('Error adding product:', error);
      toast.error(friendlyError(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveProduct = async (index: number) => {
    const product = products[index];
    if (product.id) {
      try {
        await supabase.from('products').delete().eq('id', product.id);
      } catch (e) {
        console.error('Error deleting product:', e);
      }
    }
    const updated = products.filter((_, i) => i !== index);
    onProductsChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-base">Your Products / Services</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {products.length === 0
              ? 'Add at least one item to continue'
              : `${products.length} item${products.length !== 1 ? 's' : ''} added`}
          </p>
        </div>
        <span className="text-sm font-medium text-muted-foreground">
          {products.length} item{products.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Friendly empty state */}
      {products.length === 0 && !isAdding && (
        <div className="flex flex-col items-center justify-center py-8 px-4 rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/30 text-center">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <Package size={28} className="text-primary" />
          </div>
          <p className="font-medium text-sm mb-1">Your catalog is empty</p>
          <p className="text-xs text-muted-foreground max-w-[240px]">
            Add your first product — even one item is enough to get started!
          </p>
        </div>
      )}

      {/* Success encouragement after first product */}
      {products.length > 0 && products.length <= 2 && !isAdding && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
          <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
          <p className="text-xs text-green-700 dark:text-green-400">
            {products.length === 1
              ? "Great start! Add more items or continue to review."
              : "You're on your way! Add more or continue when ready."}
          </p>
        </div>
      )}

      {/* Existing Products */}
      {products.map((product, index) => {
        const prodConfig = configs.find(c => c.category === product.category);
        const showVeg = prodConfig?.formHints.showVegToggle ?? false;
        return (
          <Card key={product.id || index} className="bg-muted/30">
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package size={20} className="text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {showVeg && <VegBadge isVeg={product.is_veg} size="sm" />}
                    <span className="font-medium text-sm truncate">{product.name}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-sm font-bold text-primary">
                      {product.price > 0 ? `₹${product.price}` : 'Price on request'}
                    </p>
                    {product.mrp && product.mrp > product.price && (
                      <>
                        <span className="text-xs text-muted-foreground line-through">₹{product.mrp}</span>
                        <span className="text-[10px] font-bold text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded">
                          {product.discount_percentage}% OFF
                        </span>
                      </>
                    )}
                  </div>
                  {product.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                      {product.description}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  onClick={() => handleRemoveProduct(index)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Add New Product Form */}
      {isAdding ? (
        <Card className="border-primary/30">
          <CardContent className="p-4 space-y-3">
            <h4 className="font-medium text-sm">New Product / Service</h4>
            <div className="space-y-2">
              <Label htmlFor="prod-name" className="text-xs">Name *</Label>
              <Input
                id="prod-name"
                placeholder={activeConfig?.formHints.namePlaceholder || "e.g., Product Name"}
                value={newProduct.name}
                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
              />
            </div>

            {/* Price + MRP Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="prod-price" className="text-xs">
                  {activeConfig?.formHints.priceLabel || 'Selling Price'} (₹) {requiresPrice ? '*' : ''}
                </Label>
                <Input
                  id="prod-price"
                  type="number"
                  min={0}
                  placeholder={requiresPrice ? '150' : '0 = On request'}
                  value={newProduct.price || ''}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, price: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prod-mrp" className="text-xs">MRP (₹) <span className="text-muted-foreground">(optional)</span></Label>
                <Input
                  id="prod-mrp"
                  type="number"
                  min={0}
                  placeholder="e.g., 200"
                  value={newProduct.mrp || ''}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, mrp: e.target.value ? Number(e.target.value) : null })
                  }
                />
              </div>
            </div>

            {/* Auto-computed discount display */}
            {computedDiscount !== null && computedDiscount > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
                <Percent size={14} className="text-green-600" />
                <span className="text-sm font-semibold text-green-600">
                  {computedDiscount}% OFF
                </span>
                <span className="text-xs text-muted-foreground">
                  (₹{newProduct.mrp! - newProduct.price} savings)
                </span>
              </div>
            )}

            {categories.length > 1 && (
              <div className="space-y-2">
                <Label className="text-xs">Category</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={newProduct.category}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, category: e.target.value })
                  }
                >
                  {categories.map((c) => {
                    const catConfig = configs.find(cfg => cfg.category === c);
                    return (
                      <option key={c} value={c}>
                        {catConfig ? `${catConfig.icon} ${catConfig.displayName}` : c.replace(/_/g, ' ')}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="prod-desc" className="text-xs">Description</Label>
              <Textarea
                id="prod-desc"
                placeholder={activeConfig?.formHints.descriptionPlaceholder || "Short description..."}
                rows={2}
                value={newProduct.description}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, description: e.target.value })
                }
              />
            </div>
            
            {/* Product Image - now using ProductImageUpload with AI tab */}
            <div className="space-y-2">
              <Label className="text-xs">Product Image <span className="text-destructive">*</span></Label>
              {user ? (
                <ProductImageUpload
                  value={newProduct.image_url || null}
                  onChange={(url) => setNewProduct({ ...newProduct, image_url: url || '' })}
                  userId={user.id}
                  productName={newProduct.name}
                  categoryName={newProduct.category}
                  description={newProduct.description}
                />
              ) : (
                <p className="text-xs text-muted-foreground">Sign in to upload images</p>
              )}
            </div>

            {showVegToggle && (
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={newProduct.is_veg}
                  onCheckedChange={(checked) =>
                    setNewProduct({ ...newProduct, is_veg: checked as boolean })
                  }
                />
                <span className="text-sm">Vegetarian</span>
              </label>
            )}
            {showDurationField && (
              <div className="space-y-2">
                <Label htmlFor="prod-prep" className="text-xs">{activeConfig?.formHints.durationLabel || 'Prep Time (min)'}</Label>
                <Input
                  id="prod-prep"
                  type="number"
                  min={1}
                  placeholder="e.g., 30"
                  value={newProduct.prep_time_minutes || ''}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, prep_time_minutes: e.target.value ? Number(e.target.value) : null })
                  }
                />
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setIsAdding(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={handleAddProduct}
                disabled={isSaving}
              >
                {isSaving && <Loader2 size={14} className="animate-spin mr-1" />}
                Save Product
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button
          variant="outline"
          className="w-full border-dashed"
          onClick={() => setIsAdding(true)}
        >
          <Plus size={16} className="mr-2" />
          Add Product / Service
        </Button>
      )}
    </div>
  );
}
