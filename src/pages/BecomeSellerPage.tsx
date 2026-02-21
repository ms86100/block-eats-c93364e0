import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { useCategoryConfigs } from '@/hooks/useCategoryBehavior';
import { useParentGroups } from '@/hooks/useParentGroups';
import { ServiceCategory } from '@/types/categories';
import { DraftProductManager } from '@/components/seller/DraftProductManager';
import { LicenseUpload } from '@/components/seller/LicenseUpload';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Store, Loader2, ChevronRight, Settings, Shield, Save, Send, Globe, LayoutGrid, Tags, FileText, Package, CheckCircle2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Sub-category Selector ─────────────────────────────────────────────────
function SubCategorySelector({
  selectedGroup,
  selectedCategories,
  onCategorySelect,
}: {
  selectedGroup: string;
  selectedCategories: ServiceCategory[];
  onCategorySelect: (category: ServiceCategory, selected: boolean) => void;
}) {
  const { groupedConfigs, isLoading } = useCategoryConfigs();
  const categories = groupedConfigs[selectedGroup as keyof typeof groupedConfigs] || [];

  if (isLoading)
    return <div className="text-center py-4 text-muted-foreground">Loading categories...</div>;
  if (categories.length === 0)
    return <div className="text-center py-4 text-muted-foreground">No categories available</div>;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">Select your categories:</p>
      <div className="grid grid-cols-2 gap-2">
        {categories.map((config) => {
          const isSelected = selectedCategories.includes(config.category);
          return (
            <button
              key={config.category}
              onClick={() => onCategorySelect(config.category, !isSelected)}
              className={cn(
                'flex items-center gap-2 p-3 rounded-lg border transition-all text-left',
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/30'
              )}
            >
              <span className="text-lg">{config.icon}</span>
              <span className="text-sm font-medium">{config.displayName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Constants ──────────────────────────────────────────────────────────────
const TOTAL_STEPS = 5;

const STEP_META = [
  { label: 'Category', icon: LayoutGrid, title: 'What will you offer?', helper: 'This determines your store type and the tools available to you.' },
  { label: 'Specialize', icon: Tags, title: 'Specialize your store', helper: 'Select the specific categories you\'ll serve. You can add more later.' },
  { label: 'Store Details', icon: FileText, title: 'Set up your store', helper: 'These details help buyers find and trust your business.' },
  { label: 'Products', icon: Package, title: 'Add your first products', helper: 'Buyers will see these once your store is approved. Start with 1-2 items.' },
  { label: 'Review', icon: CheckCircle2, title: 'Review and submit', helper: 'Double-check everything. You can edit your store after approval too.' },
];

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function BecomeSellerPage() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { parentGroupInfos, groups, isLoading: groupsLoading } = useParentGroups();
  const { groupedConfigs } = useCategoryConfigs();

  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingExisting, setIsCheckingExisting] = useState(true);
  const [existingSeller, setExistingSeller] = useState<{
    id: string;
    business_name: string;
  } | null>(null);
  const [draftSellerId, setDraftSellerId] = useState<string | null>(null);

  const [step, setStep] = useState(1);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    business_name: '',
    description: '',
    categories: [] as string[],
    availability_start: '09:00',
    availability_end: '21:00',
    accepts_cod: true,
    sell_beyond_community: false,
    delivery_radius_km: 5,
  });
  const [draftProducts, setDraftProducts] = useState<any[]>([]);
  const [acceptedDeclaration, setAcceptedDeclaration] = useState(false);
  const [licenseStatus, setLicenseStatus] = useState<string | null>(null); // 'pending' | 'approved' | 'rejected' | null

  // ── Check for existing seller profile or draft ────────────────────────
  useEffect(() => {
    const checkExisting = async () => {
      if (!user) {
        setIsCheckingExisting(false);
        return;
      }
      try {
        const { data } = await supabase
          .from('seller_profiles')
          .select('id, business_name, primary_group, verification_status')
          .eq('user_id', user.id);

        if (data && data.length > 0) {
          // Check for a draft profile to resume
          const draft = data.find(
            (s: any) => s.verification_status === 'draft'
          );
          if (draft) {
            setDraftSellerId(draft.id);
            setSelectedGroup(draft.primary_group);
            setFormData((f) => ({ ...f, business_name: draft.business_name }));
            // Load draft products
            const { data: prods } = await supabase
              .from('products')
              .select('*')
              .eq('seller_id', draft.id);
            setDraftProducts(prods || []);
            setStep(3); // Resume at business details
          }
        }
      } catch (error) {
        console.error('Error checking existing seller:', error);
      } finally {
        setIsCheckingExisting(false);
      }
    };
    checkExisting();
  }, [user]);

  // ── Check group conflict when group selected ──────────────────────────
  useEffect(() => {
    const checkGroupConflict = async () => {
      if (!user || !selectedGroup) return;
      const { data } = await supabase
        .from('seller_profiles')
        .select('id, business_name, verification_status')
        .eq('user_id', user.id)
        .eq('primary_group', selectedGroup)
        .neq('verification_status', 'draft')
        .maybeSingle();

      if (data) {
        setExistingSeller(data);
      } else {
        setExistingSeller(null);
      }
    };
    checkGroupConflict();
  }, [user, selectedGroup]);

  // ── Fetch license status for current seller + group ───────────────────
  const fetchLicenseStatus = useCallback(async () => {
    const groupRow = groups.find((g) => g.slug === selectedGroup);
    if (!draftSellerId || !groupRow) {
      setLicenseStatus(null);
      return;
    }
    if (!(groupRow as any).requires_license) {
      setLicenseStatus(null);
      return;
    }
    try {
      const { data } = await supabase
        .from('seller_licenses')
        .select('status')
        .eq('seller_id', draftSellerId)
        .eq('group_id', groupRow.id)
        .maybeSingle();
      setLicenseStatus(data?.status || null);
    } catch {
      setLicenseStatus(null);
    }
  }, [draftSellerId, groups, selectedGroup]);

  useEffect(() => {
    fetchLicenseStatus();
  }, [fetchLicenseStatus]);

  // ── Auto-save draft when business name is filled on Step 3 (for license upload) ──
  useEffect(() => {
    if (step !== 3) return;
    if (draftSellerId) return; // Already have a draft
    if (!formData.business_name.trim()) return;
    if (!selectedGroup) return;
    // Only auto-save if the group requires a license
    const groupRow = groups.find((g) => g.slug === selectedGroup);
    if (!groupRow || !(groupRow as any).requires_license) return;

    const timer = setTimeout(async () => {
      if (!user || draftSellerId) return;
      try {
        const { data, error } = await supabase
          .from('seller_profiles')
          .insert({
            user_id: user.id,
            business_name: formData.business_name.trim(),
            description: formData.description.trim() || null,
            categories: formData.categories,
            primary_group: selectedGroup,
            availability_start: formData.availability_start,
            availability_end: formData.availability_end,
            accepts_cod: formData.accepts_cod,
            sell_beyond_community: formData.sell_beyond_community,
            delivery_radius_km: formData.delivery_radius_km,
            society_id: profile?.society_id || null,
            verification_status: 'draft' as any,
          } as any)
          .select('id')
          .single();
        if (!error && data) {
          setDraftSellerId(data.id);
        }
      } catch (err) {
        console.error('Auto-save draft failed:', err);
      }
    }, 800); // Debounce 800ms

    return () => clearTimeout(timer);
  }, [step, formData.business_name, draftSellerId, selectedGroup, groups, user, profile]);

  // ── Category change handler ───────────────────────────────────────────
  const handleCategoryChange = (category: ServiceCategory, checked: boolean) => {
    if (checked) {
      setFormData({ ...formData, categories: [...formData.categories, category] });
    } else {
      setFormData({
        ...formData,
        categories: formData.categories.filter((c) => c !== category),
      });
    }
  };

  // ── Save Draft (create or update seller profile in draft status) ──────
  const saveDraft = async (): Promise<string | null> => {
    if (!user) return null;
    if (!formData.business_name.trim()) {
      toast.error('Please enter a business name');
      return null;
    }

    setIsLoading(true);
    try {
      if (draftSellerId) {
        // Update existing draft
        const { error } = await supabase
          .from('seller_profiles')
          .update({
            business_name: formData.business_name.trim(),
            description: formData.description.trim() || null,
            categories: formData.categories,
            primary_group: selectedGroup,
            availability_start: formData.availability_start,
            availability_end: formData.availability_end,
            accepts_cod: formData.accepts_cod,
            sell_beyond_community: formData.sell_beyond_community,
            delivery_radius_km: formData.delivery_radius_km,
          } as any)
          .eq('id', draftSellerId);
        if (error) throw error;
        return draftSellerId;
      } else {
        // Create new draft
        const { data, error } = await supabase
          .from('seller_profiles')
          .insert({
            user_id: user.id,
            business_name: formData.business_name.trim(),
            description: formData.description.trim() || null,
            categories: formData.categories,
            primary_group: selectedGroup,
            availability_start: formData.availability_start,
            availability_end: formData.availability_end,
            accepts_cod: formData.accepts_cod,
            sell_beyond_community: formData.sell_beyond_community,
            delivery_radius_km: formData.delivery_radius_km,
            society_id: profile?.society_id || null,
            verification_status: 'draft' as any,
          } as any)
          .select('id')
          .single();
        if (error) throw error;
        setDraftSellerId(data.id);
        return data.id;
      }
    } catch (error: any) {
      console.error('Error saving draft:', error);
      toast.error(error.message || 'Failed to save draft');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // ── Proceed to products step (saves draft first) ──────────────────────
  const handleProceedToProducts = async () => {
    const id = await saveDraft();
    if (id) {
      setStep(4);
    }
  };

  // ── Save as draft and exit ────────────────────────────────────────────
  const handleSaveDraftAndExit = async () => {
    if (step >= 3) {
      await saveDraft();
    }
    toast.success('Draft saved! You can resume later.');
    navigate('/profile');
  };

  // ── Final submit ──────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!user || !draftSellerId) return;
    if (draftProducts.length === 0) {
      toast.error('Please add at least one product');
      return;
    }
    if (!acceptedDeclaration) {
      toast.error('Please accept the seller declaration');
      return;
    }

    setIsLoading(true);
    try {
      // Update draft → pending
      const { error } = await supabase
        .from('seller_profiles')
        .update({
          verification_status: 'pending' as any,
          business_name: formData.business_name.trim(),
          description: formData.description.trim() || null,
          categories: formData.categories,
          availability_start: formData.availability_start,
          availability_end: formData.availability_end,
          accepts_cod: formData.accepts_cod,
          sell_beyond_community: formData.sell_beyond_community,
          delivery_radius_km: formData.delivery_radius_km,
        } as any)
        .eq('id', draftSellerId);

      if (error) throw error;

      // Transition all draft products to pending for admin review
      const { error: prodError } = await supabase
        .from('products')
        .update({ approval_status: 'pending' } as any)
        .eq('seller_id', draftSellerId)
        .eq('approval_status', 'draft');

      if (prodError) console.error('Failed to transition products:', prodError);
      await refreshProfile();
      toast.success('Application submitted! Awaiting admin approval.');
      navigate('/profile');
    } catch (error: any) {
      console.error('Error submitting application:', error);
      toast.error(error.message || 'Failed to submit application');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedGroupInfo = parentGroupInfos.find((g) => g.value === selectedGroup);
  const selectedGroupRow = groups.find((g) => g.slug === selectedGroup);

  // ── Loading state ─────────────────────────────────────────────────────
  if (isCheckingExisting || groupsLoading) {
    return (
      <AppLayout showHeader={false} showNav={false}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="animate-spin" size={32} />
        </div>
      </AppLayout>
    );
  }

  // ── Already registered for this group ─────────────────────────────────
  if (existingSeller && selectedGroup) {
    return (
      <AppLayout showHeader={false} showNav={false}>
        <div className="p-4 safe-top">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground mb-6">
            <ArrowLeft size={20} />
            <span>Back</span>
          </Link>
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/20 flex items-center justify-center">
              <Store className="text-success" size={32} />
            </div>
            <h1 className="text-2xl font-bold mb-2">Already Registered!</h1>
            <p className="text-muted-foreground mb-6">
              You already have a business in this category:{' '}
              <strong>{existingSeller.business_name}</strong>
            </p>
            <div className="space-y-3">
              <Button className="w-full" size="lg" onClick={() => navigate('/seller/settings')}>
                <Settings size={18} className="mr-2" />
                Edit {existingSeller.business_name}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSelectedGroup(null);
                  setExistingSeller(null);
                  setStep(1);
                }}
              >
                Choose Different Category
              </Button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── Main Flow ─────────────────────────────────────────────────────────
  return (
    <AppLayout showHeader={false} showNav={false}>
      <div className="p-4 pb-24 safe-top">
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground">
            <ArrowLeft size={20} />
            <span>Back</span>
          </Link>
          {step >= 3 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSaveDraftAndExit}
              disabled={isLoading}
            >
              <Save size={14} className="mr-1" />
              Save Draft
            </Button>
          )}
        </div>

        {/* Step-Specific Header */}
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold">{STEP_META[step - 1].title}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {STEP_META[step - 1].helper}
          </p>
        </div>

        {/* Named Progress Stepper */}
        <div className="flex items-center justify-between mb-6 px-1">
          {STEP_META.map((meta, i) => {
            const stepNum = i + 1;
            const Icon = meta.icon;
            const isCompleted = step > stepNum;
            const isActive = step === stepNum;
            return (
              <div key={meta.label} className="flex flex-col items-center gap-1 flex-1">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center transition-all text-xs',
                    isCompleted && 'bg-primary text-primary-foreground',
                    isActive && 'bg-primary/20 text-primary ring-2 ring-primary',
                    !isCompleted && !isActive && 'bg-muted text-muted-foreground'
                  )}
                >
                  {isCompleted ? <CheckCircle2 size={16} /> : <Icon size={14} />}
                </div>
                <span className={cn(
                  'text-[10px] font-medium text-center leading-tight',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}>
                  {meta.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Persistent Context Breadcrumb (Steps 3-5) */}
        {step >= 3 && selectedGroupInfo && (
          <div className="flex items-center gap-2 px-3 py-2 mb-4 rounded-lg bg-muted/60 text-xs">
            <div className={cn('w-6 h-6 rounded flex items-center justify-center text-sm', selectedGroupInfo.color)}>
              {selectedGroupInfo.icon}
            </div>
            <span className="font-medium">{selectedGroupInfo.label}</span>
            {formData.categories.length > 0 && (
              <>
                <ChevronRight size={12} className="text-muted-foreground" />
                <span className="text-muted-foreground truncate">
                  {formData.categories.map(cat => {
                    const config = (groupedConfigs[selectedGroup as keyof typeof groupedConfigs] || []).find(c => c.category === cat);
                    return config?.displayName || cat;
                  }).join(', ')}
                </span>
              </>
            )}
            {formData.business_name.trim() && step >= 4 && (
              <>
                <span className="text-muted-foreground">|</span>
                <span className="font-medium truncate">"{formData.business_name}"</span>
              </>
            )}
          </div>
        )}

        {/* ═══════════ Step 1: Choose Category Group ════════════ */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <AnimatePresence>
                {parentGroupInfos.map(({ value, label, icon, color }) => (
                  <motion.button
                    key={value}
                    layout
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      setSelectedGroup(value);
                      setFormData({ ...formData, categories: [] });
                      // Brief "Great choice!" moment before advancing
                      setTimeout(() => setStep(2), 350);
                    }}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center',
                      selectedGroup === value
                        ? 'border-primary bg-primary/5 scale-[1.03]'
                        : 'hover:border-primary/50 hover:bg-muted/50'
                    )}
                  >
                    <div
                      className={cn(
                        'w-12 h-12 rounded-xl flex items-center justify-center text-2xl',
                        color
                      )}
                    >
                      {icon}
                    </div>
                    <span className="font-medium text-sm">{label}</span>
                    {selectedGroup === value && (
                      <motion.span
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-xs text-primary font-medium"
                      >
                        Great choice! ✨
                      </motion.span>
                    )}
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* ═══════════ Step 2: Select Sub-categories ════════════ */}
        {step === 2 && selectedGroup && (
          <div className="space-y-5">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1 text-sm text-muted-foreground"
            >
              <ArrowLeft size={16} />
              Change category
            </button>
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <div
                className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center text-2xl',
                  selectedGroupInfo?.color
                )}
              >
                {selectedGroupInfo?.icon}
              </div>
              <div>
                <h3 className="font-semibold">{selectedGroupInfo?.label}</h3>
                <p className="text-xs text-muted-foreground">
                  {selectedGroupInfo?.description}
                </p>
              </div>
            </div>
            <SubCategorySelector
              selectedGroup={selectedGroup}
              selectedCategories={formData.categories as ServiceCategory[]}
              onCategorySelect={handleCategoryChange}
            />
            {/* What's Next hint */}
            <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
              <ArrowRight size={12} />
              Next: You'll name your store and set operating hours
            </p>
            <Button
              className="w-full"
              onClick={() => setStep(3)}
              disabled={formData.categories.length === 0}
            >
              Continue
              <ChevronRight size={16} className="ml-1" />
            </Button>
          </div>
        )}

        {/* ═══════════ Step 3: Business Details + Hours ════════════ */}
        {step === 3 && (
          <div className="space-y-5">
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-1 text-sm text-muted-foreground"
            >
              <ArrowLeft size={16} />
              Change categories
            </button>

            <div className="space-y-2">
              <Label htmlFor="business_name">Business Name *</Label>
              <Input
                id="business_name"
                placeholder={
                  selectedGroup === 'food' ? "e.g., Amma's Kitchen, Fresh Bakes"
                  : selectedGroup === 'services' ? "e.g., QuickFix Repairs, Yoga with Priya"
                  : selectedGroup === 'shopping' ? "e.g., Style Corner, TechMart"
                  : "e.g., Your Store Name"
                }
                value={formData.business_name}
                onChange={(e) =>
                  setFormData({ ...formData, business_name: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Tell customers about what you offer..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Availability Hours</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="start" className="text-xs text-muted-foreground">
                    Opens at
                  </Label>
                  <Input
                    id="start"
                    type="time"
                    value={formData.availability_start}
                    onChange={(e) =>
                      setFormData({ ...formData, availability_start: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="end" className="text-xs text-muted-foreground">
                    Closes at
                  </Label>
                  <Input
                    id="end"
                    type="time"
                    value={formData.availability_end}
                    onChange={(e) =>
                      setFormData({ ...formData, availability_end: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer">
              <Checkbox
                checked={formData.accepts_cod}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, accepts_cod: checked as boolean })
                }
              />
              <div>
                <span className="font-medium">Accept Cash on Delivery</span>
                <p className="text-xs text-muted-foreground">
                  Allow customers to pay in cash
                </p>
              </div>
            </label>

            {/* Sell Beyond Community */}
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe className="text-primary" size={20} />
                  <div>
                    <p className="font-medium text-sm">Sell beyond my community</p>
                    <p className="text-xs text-muted-foreground">
                      Allow buyers from nearby societies to order
                    </p>
                  </div>
                </div>
                <Switch
                  checked={formData.sell_beyond_community}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, sell_beyond_community: checked })
                  }
                />
              </div>
              {formData.sell_beyond_community && (
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Delivery Radius</Label>
                    <span className="text-sm font-medium text-primary">
                      {formData.delivery_radius_km} km
                    </span>
                  </div>
                  <Slider
                    value={[formData.delivery_radius_km]}
                    onValueChange={([v]) =>
                      setFormData({ ...formData, delivery_radius_km: v })
                    }
                    min={1}
                    max={10}
                    step={1}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Buyers within {formData.delivery_radius_km} km of your society can order
                  </p>
                </div>
              )}
            </div>

            {/* License Upload — shown in Step 3 */}
            {selectedGroupRow && (selectedGroupRow as any).requires_license && (
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-primary" />
                  <h3 className="font-semibold text-sm">Required License</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Your category requires a verified license before you can proceed. Please upload it below.
                </p>
                {draftSellerId ? (
                  <LicenseUpload
                    sellerId={draftSellerId}
                    groupId={selectedGroupRow.id}
                    onStatusChange={(status) => {
                      setLicenseStatus(status);
                    }}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    Fill in your business name above — license upload will appear once your draft is saved.
                  </p>
                )}
                {(selectedGroupRow as any).license_mandatory && (!licenseStatus || licenseStatus === 'rejected') && (
                  <div className="bg-destructive/10 rounded-lg p-3 text-sm text-destructive flex items-center gap-2">
                    <Shield size={16} />
                    You must upload your {(selectedGroupRow as any).license_type_name || 'Business License'} before continuing.
                  </div>
                )}
              </div>
            )}

            {/* What's Next hint */}
            <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
              <ArrowRight size={12} />
              Next: Add at least one product or service to your catalog
            </p>

            <Button
              className="w-full"
              onClick={handleProceedToProducts}
              disabled={
                isLoading ||
                !formData.business_name.trim() ||
                ((selectedGroupRow as any)?.license_mandatory && (!licenseStatus || licenseStatus === 'rejected'))
              }
            >
              {isLoading ? (
                <Loader2 className="animate-spin mr-2" size={18} />
              ) : null}
              Continue to Add Products
              <ChevronRight size={16} className="ml-1" />
            </Button>
          </div>
        )}

        {/* ═══════════ Step 4: Add Products ════════════ */}
        {step === 4 && draftSellerId && (
          <div className="space-y-5">
            <button
              onClick={() => setStep(3)}
              className="flex items-center gap-1 text-sm text-muted-foreground"
            >
            <ArrowLeft size={16} />
              Edit business details
            </button>

            <DraftProductManager
              sellerId={draftSellerId}
              categories={formData.categories}
              products={draftProducts}
              onProductsChange={setDraftProducts}
            />

            {/* What's Next hint */}
            <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
              <ArrowRight size={12} />
              Next: Review everything and submit for approval
            </p>

            <Button
              className="w-full"
              onClick={() => setStep(5)}
              disabled={draftProducts.length === 0}
            >
              Review & Submit
              <ChevronRight size={16} className="ml-1" />
            </Button>
          </div>
        )}

        {/* ═══════════ Step 5: Review & Submit ════════════ */}
        {step === 5 && (
          <div className="space-y-5">
            <button
              onClick={() => setStep(4)}
              className="flex items-center gap-1 text-sm text-muted-foreground"
            >
              <ArrowLeft size={16} />
              Edit products
            </button>

            {/* Summary Card */}
            <div className="bg-muted rounded-lg p-4 space-y-3">
              <h4 className="font-semibold">Application Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Business</span>
                  <span className="font-medium">{formData.business_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Category</span>
                  <span className="font-medium">{selectedGroupInfo?.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Products</span>
                  <span className="font-medium">{draftProducts.length} item(s)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Hours</span>
                  <span className="font-medium">
                    {formData.availability_start} – {formData.availability_end}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">COD</span>
                  <span className="font-medium">
                    {formData.accepts_cod ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cross-Society</span>
                  <span className="font-medium">
                    {formData.sell_beyond_community ? `Yes (${formData.delivery_radius_km} km)` : 'No'}
                  </span>
                </div>
              </div>
            </div>

            {/* License status reminder (if required for this group) */}
            {draftSellerId && selectedGroupRow && (selectedGroupRow as any).requires_license && licenseStatus && (
              <div className={cn(
                'rounded-lg p-3 text-sm flex items-center gap-2',
                licenseStatus === 'approved' ? 'bg-success/10 text-success' :
                licenseStatus === 'pending' ? 'bg-warning/10 text-warning' :
                'bg-muted/50 text-muted-foreground'
              )}>
                <Shield size={16} className="flex-shrink-0" />
                <span>
                  {(selectedGroupRow as any).license_type_name || 'Business License'}: {
                    licenseStatus === 'approved' ? 'Verified ✓' :
                    licenseStatus === 'pending' ? 'Uploaded — awaiting admin verification' :
                    'Status: ' + licenseStatus
                  }
                </span>
              </div>
            )}

            {/* What happens next */}
            <div className="bg-muted rounded-lg p-4 text-sm">
              <h4 className="font-semibold mb-2">What happens next?</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Your full application will be reviewed by admin</li>
                <li>• Once approved, your store goes live immediately</li>
                <li>• Start receiving orders from neighbors!</li>
              </ul>
            </div>

            {/* Seller Declaration */}
            <div className="border rounded-lg p-4 space-y-3">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Shield size={16} className="text-primary" />
                Seller Declaration
              </h4>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>By submitting this application, I declare that:</p>
                <ul className="space-y-0.5 ml-3">
                  <li>
                    • I hold all necessary licenses and registrations as required
                    for my business category
                  </li>
                  <li>
                    • I am solely responsible for product/service quality and safety
                  </li>
                  <li>• I will comply with all applicable laws and regulations</li>
                  <li>• I will handle customer complaints professionally</li>
                  <li>
                    • I understand that violations may lead to account suspension
                  </li>
                </ul>
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={acceptedDeclaration}
                  onCheckedChange={(checked) =>
                    setAcceptedDeclaration(checked as boolean)
                  }
                  className="mt-0.5"
                />
                <span className="text-sm font-medium">
                  I agree to the seller declaration and community guidelines
                </span>
              </label>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={handleSubmit}
              disabled={isLoading || !acceptedDeclaration}
            >
              {isLoading ? (
                <Loader2 className="animate-spin mr-2" size={18} />
              ) : (
                <Send size={18} className="mr-2" />
              )}
              Submit Application
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
