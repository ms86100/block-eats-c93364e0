import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImageUpload } from '@/components/ui/image-upload';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { notifySocietyAdmins } from '@/lib/society-notifications';

export function CreateSnagSheet({ onCreated }: { onCreated: () => void }) {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('other');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!user || !profile?.society_id || !description.trim()) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('snag_tickets').insert({
        society_id: profile.society_id,
        reported_by: user.id,
        flat_number: profile.flat_number || 'N/A',
        category,
        description: description.trim(),
        photo_urls: photoUrl ? [photoUrl] : [],
      });
      if (error) throw error;

      // Notify admins
      if (profile.society_id) {
        notifySocietyAdmins(
          profile.society_id,
          '🔧 New Snag Reported',
          `${category} defect in Flat ${profile.flat_number}: ${description.trim().substring(0, 80)}`,
          { type: 'snag' }
        );
      }

      toast.success('Snag reported');
      setDescription(''); setCategory('other'); setPhotoUrl(null);
      setOpen(false);
      onCreated();
    } catch (error: any) {
      toast.error(error.message || 'Failed to report');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" className="gap-1">
          <Plus size={14} /> Report Snag
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader><SheetTitle>Report a Defect</SheetTitle></SheetHeader>
        <div className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-medium">Category</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="plumbing">Plumbing</SelectItem>
                <SelectItem value="electrical">Electrical</SelectItem>
                <SelectItem value="civil">Civil</SelectItem>
                <SelectItem value="painting">Painting</SelectItem>
                <SelectItem value="carpentry">Carpentry</SelectItem>
                <SelectItem value="lift">Lift</SelectItem>
                <SelectItem value="common_area">Common Area</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Description *</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the defect..." rows={3} />
          </div>
          <div>
            <label className="text-sm font-medium">Photo (optional)</label>
            <ImageUpload value={photoUrl} onChange={setPhotoUrl} folder="snags" userId={user?.id || ''} />
          </div>
          <Button onClick={handleSubmit} disabled={isSubmitting || !description.trim()} className="w-full">
            {isSubmitting && <Loader2 className="animate-spin mr-2" size={16} />}
            Submit Report
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
