import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, Download, Plus, Trash2, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { CategoryConfig } from '@/types/categories';
import { friendlyError } from '@/lib/utils';

interface BulkRow {
  name: string;
  price: string;
  category: string;
  description: string;
  is_veg: boolean;
  prep_time_minutes: string;
  error?: string;
}

interface BulkProductUploadProps {
  isOpen: boolean;
  onClose: () => void;
  sellerId: string;
  allowedCategories: CategoryConfig[];
  onSuccess: () => void;
}

const EMPTY_ROW: BulkRow = { name: '', price: '', category: '', description: '', is_veg: true, prep_time_minutes: '' };

/** Look up the CategoryConfig for a given category slug */
function getCategoryConfig(slug: string, categories: CategoryConfig[]): CategoryConfig | undefined {
  return categories.find(c => c.category === slug);
}

export function BulkProductUpload({ isOpen, onClose, sellerId, allowedCategories, onSuccess }: BulkProductUploadProps) {
  const [rows, setRows] = useState<BulkRow[]>([{ ...EMPTY_ROW, category: allowedCategories[0]?.category || '' }]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ success: number; errors: number } | null>(null);

  const categorySlugs = useMemo(() => allowedCategories.map(c => c.category), [allowedCategories]);

  // Check if ANY allowed category has veg toggle / duration field (for column header visibility)
  const anyShowVeg = useMemo(() => allowedCategories.some(c => c.formHints.showVegToggle), [allowedCategories]);
  const anyShowDuration = useMemo(() => allowedCategories.some(c => c.formHints.showDurationField), [allowedCategories]);

  const addRow = () => {
    setRows([...rows, { ...EMPTY_ROW, category: allowedCategories[0]?.category || '' }]);
  };

  const removeRow = (index: number) => {
    if (rows.length <= 1) return;
    setRows(rows.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, field: keyof BulkRow, value: any) => {
    setRows(rows.map((r, i) => i === index ? { ...r, [field]: value, error: undefined } : r));
  };

  const generateCSVTemplate = () => {
    const headers = 'name,price,category,description,is_veg,prep_time_minutes';
    const example = `Paneer Butter Masala,250,${allowedCategories[0]?.category || 'home_food'},Rich creamy paneer dish,true,30`;
    const blob = new Blob([headers + '\n' + example + '\n'], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) {
        toast.error('CSV must have a header row and at least one data row');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const nameIdx = headers.indexOf('name');
      const priceIdx = headers.indexOf('price');
      const categoryIdx = headers.indexOf('category');
      const descIdx = headers.indexOf('description');
      const vegIdx = headers.indexOf('is_veg');
      const prepIdx = headers.indexOf('prep_time_minutes');

      if (nameIdx === -1 || priceIdx === -1) {
        toast.error('CSV must have "name" and "price" columns');
        return;
      }

      const parsed: BulkRow[] = lines.slice(1).map(line => {
        const cols = line.split(',').map(c => c.trim());
        const cat = cols[categoryIdx] || allowedCategories[0]?.category || '';
        const config = getCategoryConfig(cat, allowedCategories);
        return {
          name: cols[nameIdx] || '',
          price: cols[priceIdx] || '',
          category: cat,
          description: cols[descIdx] || '',
          // Default is_veg to true if category doesn't show veg toggle
          is_veg: config?.formHints.showVegToggle
            ? (vegIdx >= 0 ? cols[vegIdx]?.toLowerCase() === 'true' : true)
            : true,
          prep_time_minutes: config?.formHints.showDurationField
            ? (prepIdx >= 0 ? cols[prepIdx] || '' : '')
            : '',
        };
      });

      setRows(parsed);
      toast.success(`Parsed ${parsed.length} rows from CSV`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const validate = (): boolean => {
    let hasErrors = false;
    const validated = rows.map((row, idx) => {
      const errors: string[] = [];
      if (!row.name.trim()) errors.push('Name required');
      const price = parseFloat(row.price);
      if (isNaN(price) || price <= 0) errors.push('Invalid price');
      if (row.category && !categorySlugs.includes(row.category)) errors.push('Invalid category');

      // Category-aware validation
      const config = getCategoryConfig(row.category, allowedCategories);
      if (config) {
        if (!config.formHints.showVegToggle && !row.is_veg) {
          errors.push('Veg toggle not applicable for this category');
        }
      }

      // Duplicate check
      const isDupe = rows.some((other, otherIdx) =>
        otherIdx !== idx && other.name.trim().toLowerCase() === row.name.trim().toLowerCase() && other.category === row.category
      );
      if (isDupe) errors.push('Duplicate');

      if (errors.length > 0) {
        hasErrors = true;
        return { ...row, error: errors.join(', ') };
      }
      return { ...row, error: undefined };
    });

    setRows(validated);
    return !hasErrors;
  };

  const handleSave = async () => {
    if (!validate()) {
      toast.error('Fix validation errors before saving');
      return;
    }

    setIsSaving(true);
    setSaveResult(null);

    try {
      const products = rows.map(row => {
        const config = getCategoryConfig(row.category, allowedCategories);
        return {
          seller_id: sellerId,
          name: row.name.trim(),
          price: parseFloat(row.price),
          category: row.category,
          description: row.description.trim() || null,
          is_veg: config?.formHints.showVegToggle ? row.is_veg : true,
          prep_time_minutes: config?.formHints.showDurationField && row.prep_time_minutes
            ? parseInt(row.prep_time_minutes) : null,
          is_available: true,
          approval_status: 'draft',
        };
      });

      const { error } = await supabase.from('products').insert(products as any);

      if (error) throw error;

      setSaveResult({ success: products.length, errors: 0 });
      toast.success(`${products.length} products added as drafts`);
      onSuccess();

      setTimeout(() => {
        setRows([{ ...EMPTY_ROW, category: allowedCategories[0]?.category || '' }]);
        setSaveResult(null);
        onClose();
      }, 1500);
    } catch (error: any) {
      console.error('Bulk save error:', error);
      toast.error(friendlyError(error));
      setSaveResult({ success: 0, errors: rows.length });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[85vh]">
        <SheetHeader>
          <SheetTitle>Bulk Add Products</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="grid" className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="grid" className="flex-1">Multi-Row Grid</TabsTrigger>
            <TabsTrigger value="csv" className="flex-1">CSV Upload</TabsTrigger>
          </TabsList>

          <TabsContent value="csv" className="space-y-4 mt-4">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={generateCSVTemplate}>
                <Download size={14} className="mr-1" />
                Download Template
              </Button>
              <Label htmlFor="csv-upload" className="cursor-pointer">
                <Button variant="outline" size="sm" asChild>
                  <span>
                    <Upload size={14} className="mr-1" />
                    Upload CSV
                  </span>
                </Button>
              </Label>
              <input id="csv-upload" type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} />
            </div>
            <p className="text-xs text-muted-foreground">
              CSV columns: name (required), price (required), category, description, is_veg, prep_time_minutes
            </p>
          </TabsContent>

          <TabsContent value="grid" className="mt-4">
            <div className="flex justify-end mb-2">
              <Button variant="outline" size="sm" onClick={addRow}>
                <Plus size={14} className="mr-1" />
                Add Row
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <ScrollArea className="h-[calc(85vh-240px)] mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Name *</TableHead>
                <TableHead className="w-24">Price *</TableHead>
                {allowedCategories.length > 1 && <TableHead className="w-32">Category</TableHead>}
                <TableHead>Description</TableHead>
                {anyShowVeg && <TableHead className="w-16">Veg</TableHead>}
                {anyShowDuration && <TableHead className="w-24">Duration</TableHead>}
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, idx) => {
                const rowConfig = getCategoryConfig(row.category, allowedCategories);
                const rowShowVeg = rowConfig?.formHints.showVegToggle ?? false;
                const rowShowDuration = rowConfig?.formHints.showDurationField ?? false;

                return (
                  <TableRow key={idx} className={row.error ? 'bg-destructive/5' : ''}>
                    <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell>
                      <Input
                        value={row.name}
                        onChange={(e) => updateRow(idx, 'name', e.target.value)}
                        placeholder={rowConfig?.formHints.namePlaceholder || 'Product name'}
                        className="h-8 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={row.price}
                        onChange={(e) => updateRow(idx, 'price', e.target.value)}
                        placeholder="₹"
                        className="h-8 text-sm"
                      />
                    </TableCell>
                    {allowedCategories.length > 1 && (
                      <TableCell>
                        <Select value={row.category} onValueChange={(v) => updateRow(idx, 'category', v)}>
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {allowedCategories.map(c => (
                              <SelectItem key={c.category} value={c.category}>
                                {c.icon} {c.displayName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    )}
                    <TableCell>
                      <Input
                        value={row.description}
                        onChange={(e) => updateRow(idx, 'description', e.target.value)}
                        placeholder="Optional"
                        className="h-8 text-sm"
                      />
                    </TableCell>
                    {anyShowVeg && (
                      <TableCell>
                        {rowShowVeg ? (
                          <Switch
                            checked={row.is_veg}
                            onCheckedChange={(v) => updateRow(idx, 'is_veg', v)}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    {anyShowDuration && (
                      <TableCell>
                        {rowShowDuration ? (
                          <Input
                            type="number"
                            value={row.prep_time_minutes}
                            onChange={(e) => updateRow(idx, 'prep_time_minutes', e.target.value)}
                            placeholder={rowConfig?.formHints.durationLabel || 'min'}
                            className="h-8 text-sm"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeRow(idx)}
                        disabled={rows.length <= 1}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {rows.some(r => r.error) && (
            <div className="mt-3 space-y-1">
              {rows.map((r, idx) => r.error ? (
                <div key={idx} className="flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle size={14} />
                  <span>Row {idx + 1}: {r.error}</span>
                </div>
              ) : null)}
            </div>
          )}
        </ScrollArea>

        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {rows.length} product{rows.length !== 1 ? 's' : ''} to add as drafts
          </div>
          <div className="flex gap-2">
            {saveResult && (
              <Badge variant={saveResult.errors > 0 ? 'destructive' : 'default'} className="gap-1">
                {saveResult.errors > 0 ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                {saveResult.success} saved, {saveResult.errors} failed
              </Badge>
            )}
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving || rows.length === 0}>
              {isSaving && <Loader2 size={16} className="animate-spin mr-1" />}
              Save All ({rows.length})
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
