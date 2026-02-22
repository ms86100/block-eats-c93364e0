import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LiveCameraCapture } from './LiveCameraCapture';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { logAudit } from '@/lib/audit';
import { friendlyError } from '@/lib/utils';
import { workerRegistrationSchema, validateForm } from '@/lib/validation-schemas';
import { useQuery } from '@tanstack/react-query';

// Worker types loaded from categories prop — no hardcoded defaults used when categories available
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface WorkerRegistrationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  categories?: { id: string; name: string; entry_type: string }[];
}

export function WorkerRegistrationSheet({ open, onOpenChange, onSuccess, categories = [] }: WorkerRegistrationSheetProps) {
  const { user, profile, effectiveSocietyId } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [workerType, setWorkerType] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [shiftStart, setShiftStart] = useState('06:00');
  const [shiftEnd, setShiftEnd] = useState('18:00');
  const [activeDays, setActiveDays] = useState<string[]>([...DAYS]);
  const [entryFrequency, setEntryFrequency] = useState('daily');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [flatNumbers, setFlatNumbers] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('');
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Fetch supported languages from DB
  const { data: languages = [] } = useQuery({
    queryKey: ['supported-languages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supported_languages')
        .select('code, name, native_name')
        .eq('is_active', true)
        .order('display_order');
      if (error) {
        console.error('Error fetching languages:', error);
        return [];
      }
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  const toggleDay = (day: string) => {
    setActiveDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const handlePhotoCapture = (blob: Blob) => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoBlob(blob);
    setPhotoPreview(URL.createObjectURL(blob));
  };

  const clearPhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoBlob(null);
    setPhotoPreview(null);
  };

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const handleSubmit = async () => {
    if (!user || !effectiveSocietyId) {
      toast.error('Please log in and select a society');
      return;
    }

    const validation = validateForm(workerRegistrationSchema, {
      name,
      phone,
      workerType,
      shiftStart,
      shiftEnd,
      entryFrequency,
      emergencyPhone,
      flatNumbers,
      preferredLanguage,
    });

    if (!validation.success) {
      const errors = (validation as { success: false; errors: Record<string, string> }).errors;
      setFieldErrors(errors);
      const firstError = Object.values(errors)[0];
      toast.error(firstError as string);
      return;
    }

    if (!photoBlob) {
      toast.error('Live photo is required');
      return;
    }

    if (activeDays.length === 0) {
      toast.error('Select at least one active day');
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const sanitizedName = name.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `workers/${effectiveSocietyId}/${Date.now()}_${sanitizedName}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('app-images')
        .upload(fileName, photoBlob, { contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('app-images').getPublicUrl(fileName);

      const { data: worker, error } = await supabase.from('society_workers').insert({
        user_id: user.id,
        society_id: effectiveSocietyId,
        worker_type: workerType,
        photo_url: publicUrl,
        allowed_shift_start: shiftStart,
        allowed_shift_end: shiftEnd,
        active_days: activeDays,
        entry_frequency: entryFrequency,
        emergency_contact_phone: emergencyPhone || null,
        category_id: categoryId || null,
        registered_by: user.id,
        skills: { name: name.trim(), phone: phone || null },
        languages: [],
        preferred_language: preferredLanguage,
      }).select('id').single();

      if (error) throw error;

      if (flatNumbers.trim() && worker) {
        const flats = flatNumbers.split(',').map(f => f.trim()).filter(Boolean);
        if (flats.length > 0) {
          const assignments = flats.map(flat => ({
            worker_id: worker.id,
            society_id: effectiveSocietyId,
            flat_number: flat,
            assigned_by: user.id,
          }));
          const { error: flatError } = await supabase.from('worker_flat_assignments').insert(assignments);
          if (flatError) {
            console.error('Flat assignment error:', flatError);
            toast.error('Worker registered but flat assignments failed');
          }
        }
      }

      await logAudit('worker_registered', 'society_worker', worker?.id || '', effectiveSocietyId, {
        worker_type: workerType, name: name.trim(),
      });

      toast.success('Worker registered successfully');
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast.error(friendlyError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setName(''); setPhone(''); setWorkerType('');
    setCategoryId(null); setShiftStart('06:00'); setShiftEnd('18:00');
    setActiveDays([...DAYS]); setEntryFrequency('daily');
    setEmergencyPhone(''); setFlatNumbers('');
    setPreferredLanguage('');
    setPhotoBlob(null); setPhotoPreview(null);
    setFieldErrors({});
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Register Worker</SheetTitle>
          <SheetDescription>Live photo capture required. No gallery uploads.</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {/* Live Photo */}
          <div>
            <Label className="mb-2 block">Photo (Live Capture Only) *</Label>
            <LiveCameraCapture
              onCapture={handlePhotoCapture}
              capturedPreview={photoPreview}
              onClear={clearPhoto}
            />
          </div>

          {/* Name & Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Name *</Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Worker name"
                className={fieldErrors.name ? 'border-destructive' : ''}
              />
              {fieldErrors.name && <p className="text-xs text-destructive mt-1">{fieldErrors.name}</p>}
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="9876543210"
                inputMode="tel"
                className={fieldErrors.phone ? 'border-destructive' : ''}
              />
              {fieldErrors.phone && <p className="text-xs text-destructive mt-1">{fieldErrors.phone}</p>}
            </div>
          </div>

          {/* Preferred Language */}
          <div>
            <Label>Preferred Language *</Label>
            <Select value={preferredLanguage} onValueChange={setPreferredLanguage}>
              <SelectTrigger>
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {languages.length > 0 ? (
                  languages.map((lang: any) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.native_name} ({lang.name})
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="" disabled>No languages configured</SelectItem>
                )}
              </SelectContent>
            </Select>
            {languages.length === 0 && (
              <p className="text-xs text-destructive mt-1">⚠️ No languages configured. Contact admin.</p>
            )}
            <p className="text-[10px] text-muted-foreground mt-1">Job summaries will be read in this language</p>
          </div>

          {/* Category / Type */}
          <div className="grid grid-cols-2 gap-3">
            {categories.length > 0 ? (
              <div>
                <Label>Category</Label>
                <Select value={categoryId || ''} onValueChange={v => setCategoryId(v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label>Type</Label>
                <p className="text-xs text-destructive mt-1">⚠️ No worker categories configured. Contact admin.</p>
              </div>
            )}
            <div>
              <Label>Entry Frequency</Label>
              <Select value={entryFrequency} onValueChange={setEntryFrequency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="occasional">Occasional</SelectItem>
                  <SelectItem value="per_visit">Per Visit Approval</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Shift */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Shift Start</Label>
              <Input type="time" value={shiftStart} onChange={e => setShiftStart(e.target.value)} />
            </div>
            <div>
              <Label>Shift End</Label>
              <Input
                type="time"
                value={shiftEnd}
                onChange={e => setShiftEnd(e.target.value)}
                className={fieldErrors.shiftEnd ? 'border-destructive' : ''}
              />
              {fieldErrors.shiftEnd && <p className="text-xs text-destructive mt-1">{fieldErrors.shiftEnd}</p>}
            </div>
          </div>

          {/* Active Days */}
          <div>
            <Label className="mb-2 block">Active Days</Label>
            <div className="flex gap-1 flex-wrap">
              {DAYS.map(day => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    activeDays.includes(day)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          {/* Flat Assignments */}
          <div>
            <Label>Assigned Flats (comma separated)</Label>
            <Input
              value={flatNumbers}
              onChange={e => setFlatNumbers(e.target.value)}
              placeholder="e.g. 301, 402, 505"
            />
          </div>

          {/* Emergency Contact */}
          <div>
            <Label>Emergency Contact</Label>
            <Input
              value={emergencyPhone}
              onChange={e => setEmergencyPhone(e.target.value)}
              placeholder="9876543210"
              inputMode="tel"
              className={fieldErrors.emergencyPhone ? 'border-destructive' : ''}
            />
            {fieldErrors.emergencyPhone && <p className="text-xs text-destructive mt-1">{fieldErrors.emergencyPhone}</p>}
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || !photoBlob || !preferredLanguage || languages.length === 0 || isSubmitting}
            className="w-full"
          >
            {isSubmitting ? 'Registering...' : 'Register Worker'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
