import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { LiveCameraCapture } from './LiveCameraCapture';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { logAudit } from '@/lib/audit';
import { friendlyError } from '@/lib/utils';

const DEFAULT_TYPES = ['maid', 'cook', 'driver', 'nanny', 'gardener', 'electrician', 'plumber', 'caretaker', 'other'];
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
  const [workerType, setWorkerType] = useState('maid');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [shiftStart, setShiftStart] = useState('06:00');
  const [shiftEnd, setShiftEnd] = useState('18:00');
  const [activeDays, setActiveDays] = useState<string[]>([...DAYS]);
  const [entryFrequency, setEntryFrequency] = useState('daily');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [flatNumbers, setFlatNumbers] = useState('');
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleDay = (day: string) => {
    setActiveDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const handlePhotoCapture = (blob: Blob) => {
    setPhotoBlob(blob);
    setPhotoPreview(URL.createObjectURL(blob));
  };

  const handleSubmit = async () => {
    if (!name.trim() || !user || !effectiveSocietyId || !photoBlob) {
      toast.error(!photoBlob ? 'Live photo is required' : 'Please fill required fields');
      return;
    }
    setIsSubmitting(true);

    try {
      // Upload photo to storage
      const fileName = `workers/${effectiveSocietyId}/${Date.now()}_${name.replace(/\s/g, '_')}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('app-images')
        .upload(fileName, photoBlob, { contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('app-images').getPublicUrl(fileName);

      // Create worker record — user_id is the registrant (security/admin), not a worker user account
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
      }).select('id').single();

      if (error) throw error;

      // Create flat assignments
      if (flatNumbers.trim() && worker) {
        const flats = flatNumbers.split(',').map(f => f.trim()).filter(Boolean);
        const assignments = flats.map(flat => ({
          worker_id: worker.id,
          society_id: effectiveSocietyId,
          flat_number: flat,
          assigned_by: user.id,
        }));
        await supabase.from('worker_flat_assignments').insert(assignments);
      }

      await logAudit('worker_registered', 'society_worker', worker?.id || '', effectiveSocietyId, {
        worker_type: workerType, name: name.trim(),
      });

      toast.success('Worker registered successfully');
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      console.error(err);
      toast.error(friendlyError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setName(''); setPhone(''); setWorkerType('maid');
    setCategoryId(null); setShiftStart('06:00'); setShiftEnd('18:00');
    setActiveDays([...DAYS]); setEntryFrequency('daily');
    setEmergencyPhone(''); setFlatNumbers('');
    setPhotoBlob(null); setPhotoPreview(null);
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
              onClear={() => { setPhotoBlob(null); setPhotoPreview(null); }}
            />
          </div>

          {/* Name & Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Name *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Worker name" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91..." />
            </div>
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
                <Select value={workerType} onValueChange={setWorkerType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEFAULT_TYPES.map(t => (
                      <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              <Input type="time" value={shiftEnd} onChange={e => setShiftEnd(e.target.value)} />
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
            <Input value={emergencyPhone} onChange={e => setEmergencyPhone(e.target.value)} placeholder="+91..." />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || !photoBlob || isSubmitting}
            className="w-full"
          >
            {isSubmitting ? 'Registering...' : 'Register Worker'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
