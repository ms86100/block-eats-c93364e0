import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { friendlyError } from '@/lib/utils';
import { Loader2, ShieldAlert } from 'lucide-react';
import { notifySocietyAdmins } from '@/lib/society-notifications';
import { disputeSchema, validateForm } from '@/lib/validation-schemas';
import { useSubmitGuard } from '@/hooks/useSubmitGuard';

const CATEGORIES = [
  { value: 'noise', label: 'Noise' },
  { value: 'parking', label: 'Parking' },
  { value: 'pet', label: 'Pet Related' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'other', label: 'Other' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateDisputeSheet({ open, onOpenChange, onCreated }: Props) {
  const { user, profile, viewAsSocietyId } = useAuth();
  const [category, setCategory] = useState('other');
  const [description, setDescription] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmitInner = async () => {
    if (!user || !profile?.society_id) return;

    const validation = validateForm(disputeSchema, { category, description, is_anonymous: isAnonymous });
    if (!validation.success) {
      const firstError = Object.values((validation as { success: false; errors: Record<string, string> }).errors)[0];
      toast({ title: 'Validation error', description: firstError as string, variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('dispute_tickets').insert({
        society_id: profile.society_id,
        submitted_by: user.id,
        category: validation.data.category,
        description: validation.data.description,
        is_anonymous: validation.data.is_anonymous ?? false,
      } as any);
      if (error) throw error;

      if (profile?.society_id) {
        notifySocietyAdmins(
          profile.society_id,
          '⚖️ New Dispute Filed',
          `${category} concern: ${validation.data.description.substring(0, 80)}`,
          { type: 'dispute' }
        );
      }

      toast({ title: 'Concern submitted', description: 'The committee will review within 48 hours.' });
      setDescription('');
      setCategory('other');
      setIsAnonymous(false);
      onOpenChange(false);
      onCreated();
    } catch (err: any) {
      toast({ title: 'Failed', description: friendlyError(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = useSubmitGuard(handleSubmitInner);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShieldAlert size={18} />
            Raise a Concern
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe your concern in detail..."
              rows={4}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Submit Anonymously</p>
              <p className="text-xs text-muted-foreground">Committee won't see your identity</p>
            </div>
            <Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} />
          </div>
          <Button className="w-full" onClick={handleSubmit} disabled={saving || !description.trim() || !!viewAsSocietyId}>
            {saving && <Loader2 size={16} className="animate-spin mr-2" />}
            Submit Concern
          </Button>
          {viewAsSocietyId && (
            <p className="text-xs text-muted-foreground text-center">You are viewing another society. Switch back to create content.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
