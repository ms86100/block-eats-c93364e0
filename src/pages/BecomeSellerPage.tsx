import { useState, useEffect } from 'react';
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
import { ArrowLeft, Store, Loader2, ChevronRight, Settings, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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

  if (isLoading) return <div className="text-center py-4 text-muted-foreground">Loading categories...</div>;
  if (categories.length === 0) return <div className="text-center py-4 text-muted-foreground">No categories available</div>;

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

export default function BecomeSellerPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { parentGroupInfos, isLoading: groupsLoading } = useParentGroups();
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingExisting, setIsCheckingExisting] = useState(true);
  const [existingSeller, setExistingSeller] = useState<{ id: string; business_name: string } | null>(null);
  const [step, setStep] = useState(1);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    business_name: '',
    description: '',
    categories: [] as string[],
    availability_start: '09:00',
    availability_end: '21:00',
    accepts_cod: true,
  });
  const [acceptedDeclaration, setAcceptedDeclaration] = useState(false);

  useEffect(() => {
    const checkExistingSeller = async () => {
      if (!user) {
        setIsCheckingExisting(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('seller_profiles')
          .select('id, business_name, primary_group')
          .eq('user_id', user.id);

        if (error) throw error;
        if (data && data.length > 0) {
          setExistingSeller(null);
        }
      } catch (error) {
        console.error('Error checking existing seller:', error);
      } finally {
        setIsCheckingExisting(false);
      }
    };
    checkExistingSeller();
  }, [user]);

  useEffect(() => {
    const checkGroupConflict = async () => {
      if (!user || !selectedGroup) return;
      const { data } = await supabase
        .from('seller_profiles')
        .select('id, business_name')
        .eq('user_id', user.id)
        .eq('primary_group', selectedGroup)
        .maybeSingle();

      if (data) {
        setExistingSeller(data);
      } else {
        setExistingSeller(null);
      }
    };
    checkGroupConflict();
  }, [user, selectedGroup]);

  const handleCategoryChange = (category: ServiceCategory, checked: boolean) => {
    if (checked) {
      setFormData({ ...formData, categories: [...formData.categories, category] });
    } else {
      setFormData({ ...formData, categories: formData.categories.filter((c) => c !== category) });
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!formData.business_name.trim()) {
      toast.error('Please enter a business name');
      return;
    }
    if (formData.categories.length === 0) {
      toast.error('Please select at least one category');
      return;
    }
    if (!acceptedDeclaration) {
      toast.error('Please accept the seller declaration to continue');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.from('seller_profiles').insert({
        user_id: user.id,
        business_name: formData.business_name.trim(),
        description: formData.description.trim() || null,
        categories: formData.categories,
        primary_group: selectedGroup,
        availability_start: formData.availability_start,
        availability_end: formData.availability_end,
        accepts_cod: formData.accepts_cod,
        society_id: profile?.society_id || null,
      });

      if (error) throw error;
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

  if (isCheckingExisting || groupsLoading) {
    return (
      <AppLayout showHeader={false} showNav={false}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="animate-spin" size={32} />
        </div>
      </AppLayout>
    );
  }

  if (existingSeller && selectedGroup) {
    return (
      <AppLayout showHeader={false} showNav={false}>
        <div className="p-4">
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
              You already have a business in this category: <strong>{existingSeller.business_name}</strong>
            </p>
            <p className="text-sm text-muted-foreground mb-8">
              You can add more categories to your existing business or choose a different category group.
            </p>
            <div className="space-y-3">
              <Button className="w-full" size="lg" onClick={() => navigate('/seller/settings')}>
                <Settings size={18} className="mr-2" />
                Edit {existingSeller.business_name}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => { setSelectedGroup(null); setExistingSeller(null); setStep(1); }}
              >
                Choose Different Category
              </Button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout showHeader={false} showNav={false}>
      <div className="p-4">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft size={20} />
          <span>Back</span>
        </Link>

        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
            <Store className="text-secondary-foreground" size={32} />
          </div>
          <h1 className="text-2xl font-bold">Become a Seller</h1>
          <p className="text-muted-foreground mt-2">Share your skills & products with your neighbors</p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div key={s} className={cn('w-8 h-1 rounded-full transition-colors', s <= step ? 'bg-primary' : 'bg-muted')} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-5">
            <div className="text-center mb-4">
              <h2 className="font-semibold text-lg">What do you want to offer?</h2>
              <p className="text-sm text-muted-foreground">Select the type of service or product</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {parentGroupInfos.map(({ value, label, icon, color }) => (
                <button
                  key={value}
                  onClick={() => { setSelectedGroup(value); setFormData({ ...formData, categories: [] }); setStep(2); }}
                  className={cn('flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center', 'hover:border-primary/50 hover:bg-muted/50')}
                >
                  <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center text-2xl', color)}>
                    {icon}
                  </div>
                  <span className="font-medium text-sm">{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && selectedGroup && (
          <div className="space-y-5">
            <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-muted-foreground">
              <ArrowLeft size={16} />
              Change category
            </button>
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center text-2xl', selectedGroupInfo?.color)}>
                {selectedGroupInfo?.icon}
              </div>
              <div>
                <h3 className="font-semibold">{selectedGroupInfo?.label}</h3>
                <p className="text-xs text-muted-foreground">{selectedGroupInfo?.description}</p>
              </div>
            </div>
            <SubCategorySelector
              selectedGroup={selectedGroup}
              selectedCategories={formData.categories as ServiceCategory[]}
              onCategorySelect={handleCategoryChange}
            />
            <Button className="w-full" onClick={() => setStep(3)} disabled={formData.categories.length === 0}>
              Continue
              <ChevronRight size={16} className="ml-1" />
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <button onClick={() => setStep(2)} className="flex items-center gap-1 text-sm text-muted-foreground">
              <ArrowLeft size={16} />
              Change categories
            </button>
            <div className="space-y-2">
              <Label htmlFor="business_name">Business Name *</Label>
              <Input id="business_name" placeholder="e.g., Amma's Kitchen, Home Tutors" value={formData.business_name} onChange={(e) => setFormData({ ...formData, business_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" placeholder="Tell customers about what you offer..." value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Availability Hours</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="start" className="text-xs text-muted-foreground">Opens at</Label>
                  <Input id="start" type="time" value={formData.availability_start} onChange={(e) => setFormData({ ...formData, availability_start: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="end" className="text-xs text-muted-foreground">Closes at</Label>
                  <Input id="end" type="time" value={formData.availability_end} onChange={(e) => setFormData({ ...formData, availability_end: e.target.value })} />
                </div>
              </div>
            </div>
            <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer">
              <Checkbox checked={formData.accepts_cod} onCheckedChange={(checked) => setFormData({ ...formData, accepts_cod: checked as boolean })} />
              <div>
                <span className="font-medium">Accept Cash on Delivery</span>
                <p className="text-xs text-muted-foreground">Allow customers to pay in cash</p>
              </div>
            </label>
            <div className="bg-muted rounded-lg p-4 text-sm">
              <h4 className="font-semibold mb-2">What happens next?</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Your application will be reviewed by admin</li>
                <li>• Once approved, you can add your offerings</li>
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
                  <li>• I hold all necessary licenses and registrations required for my business (including FSSAI for food-related categories)</li>
                  <li>• I am solely responsible for product/service quality and safety</li>
                  <li>• I will comply with all applicable laws and regulations</li>
                  <li>• I will handle customer complaints professionally</li>
                  <li>• I understand that violations may lead to account suspension</li>
                </ul>
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox 
                  checked={acceptedDeclaration} 
                  onCheckedChange={(checked) => setAcceptedDeclaration(checked as boolean)}
                  className="mt-0.5"
                />
                <span className="text-sm font-medium">I agree to the seller declaration and community guidelines</span>
              </label>
            </div>

            <Button className="w-full" size="lg" onClick={handleSubmit} disabled={isLoading || !acceptedDeclaration}>
              {isLoading ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
              Submit Application
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
